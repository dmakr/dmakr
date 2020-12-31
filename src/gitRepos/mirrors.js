import { ok, strictEqual } from "assert";
import { exec } from "child_process";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import simpleGit from "simple-git";
import gitRemote from "./gitRemote.js";

const GUARD_ID = "guard.jobs";
const watchedId = (id) => `watched.${id}`;
/**
 * @typedef {Object} MirrorRepo
 * @property {SimpleGit} git
 * @property {number} intervalId
 */
/**  @type { Map<string, MirrorRepo>} */
const repos = new Map();

/**
 * @param {string} url
 * @param {string} gitPath
 * @returns {import("simple-git").SimpleGit}
 * @throws If the repo does not exists
 */
const isClonedRepo = async (url, gitPath) => {
  const git = simpleGit(gitPath);
  ok(await git.checkIsRepo("root"), `buildMirrors: No git repo at: ${gitPath}`);
  ok(
    await git.checkIsRepo("bare"),
    `buildMirrors: No bare git repo at: ${gitPath}`
  );
  strictEqual((await git.getRemotes(true))[0]?.refs?.fetch, url);
  return git;
};

/**
 * @param {import("../typedefs").Logger} log
 * @param {string} id
 * @param {string} mirrorPath
 * @param {string} remoteUrl
 * @param {import("../typedefs.js").Credentials} credentials
 * @returns {Promise<import("simple-git").SimpleGit>}
 */
const getMirror = (log, id, mirrorPath, remoteUrl, credentials = {}) =>
  isClonedRepo(gitRemote(remoteUrl, credentials), mirrorPath).catch(
    async (err) => {
      log.info(`[${id}] ${err}`);
      log.info(`[${id}] buildMirrors: Trying to repair ...`);
      try {
        await rm(mirrorPath, { recursive: true, force: true });
      } catch (error) {
        log.error(error);
      }
      await simpleGit().mirror(gitRemote(remoteUrl, credentials), mirrorPath);
      log.info(`[${id}] buildMirrors: The repair was successful.`);
      const mirror = simpleGit(mirrorPath);
      await mirror
        .addConfig("user.name", "Mirror Dmakr")
        .addConfig("user.email", "dmakr@only.local")
        .addConfig("uploadpack.allowAnySHA1InWant", "true");
      return mirror;
    }
  );

/**
 * @param  {import("../typedefs").Context} ctx
 * @returns {Promise<import("../typedefs.js").MirrorIds>}
 */
export const buildMirrors = async (ctx) => {
  const {
    dataPath,
    logger: curLogger,
    jobRepo,
    credentials,
    watchedRepos,
  } = ctx;
  const mirrorPath = join(dataPath, ".mirrors");
  const jobPath = join(mirrorPath, "jobs");
  await mkdir(mirrorPath, { recursive: true });
  const git = await getMirror(
    curLogger,
    GUARD_ID,
    jobPath,
    jobRepo,
    credentials
  );
  repos.set(GUARD_ID, {
    git,
  });
  const watched = await Promise.all(
    watchedRepos.map(async ({ id, url, credentials: cred }) => ({
      [id]: await getMirror(
        curLogger,
        watchedId(id),
        join(mirrorPath, "watched", id),
        url,
        cred
      ).then((watchedGit) => {
        repos.set(watchedId(id), {
          git: watchedGit,
        });
        return { id: watchedId(id), url: join(mirrorPath, "watched", id) };
      }),
    }))
  );

  return {
    guard: { id: GUARD_ID, url: jobPath },
    watched: watched.reduce((prev, repo) => ({ ...prev, ...repo }), {}),
  };
};

/**
 * Build a workspace with checked-out resource
 * @param {import("../typedefs.js").Context} ctx Environment related context
 * @param {import("../typedefs.js").JobEvent} job Current job object
 */
export const cloneWorkspace = async (ctx, job) => {
  const { dataPath } = ctx;
  const { git: mirror } = repos.get(job.gitId.id);
  const wsJobPath = join(
    dataPath,
    job.gitId.id,
    job.commit.branch,
    job.commit.commitId
  );

  await mkdir(wsJobPath, { recursive: true });
  const git = simpleGit(wsJobPath);
  if (!(await git.checkIsRepo("root"))) {
    await git.init().addRemote("origin", job.gitId.url);
  }
  await git
    .fetch([
      "--depth",
      1,
      "origin",
      await mirror.revparse([job.commit.commitId]),
    ])
    .checkout([job.commit.commitId]);
  return wsJobPath;
};

/**
 * updateMirror event
 *
 * @event git#updateMirror
 * @type {import("../typedefs.js").BranchHeads}
 */

/**
 * @param {import("../typedefs.js").MirrorId} gitId
 * @returns {Promise<import("../typedefs.js").CommitInfo[]>}
 */
export const scanMirror = async (gitId) => {
  const { git } = repos.get(gitId.id);
  const branchList = await git.branch();
  return Promise.all(
    Object.keys(branchList.branches).map(async (branch) => {
      const { name, label, commit } = branchList.branches[branch];
      const tags = await git.tags(["--points-at", commit]);

      return {
        branch: name,
        commitId: commit,
        message: label,
        tags: tags.all,
      };
    })
  );
};

/**
 * @param {import("../typedefs.js").MirrorId} gitId
 * @param  {import("../typedefs").Context} ctx
 * @fires git#updateMirror
 */
export const updateMirror = (gitId, ctx) =>
  new Promise((resolve, reject) => {
    try {
      const update = exec("git remote update --prune", {
        timeout: 600,
        cwd: gitId.url,
        // shell: true,
        windowsHide: true,
      });
      const done = async () => {
        ctx.emitter.emit("updateMirror", {
          gitId,
          heads: await scanMirror(gitId),
        });
        update.stdout.removeAllListeners("error");
        update.removeAllListeners("error");
        update.removeAllListeners("exit");
        resolve();
      };
      update.stdout.on("error", ctx.logger.error);
      update.once("exit", done);
      update.once("error", reject);
    } catch (error) {
      reject(error);
    }
  });

/**
 * @param {number} interval Refresh of the repo
 * @param {import("../typedefs.js").MirrorId} mirrorId
 * @param  {import("../typedefs").Context} ctx
 * @throws {AssertionError}
 */
const restartUpdateStream = (interval, mirrorId, ctx) => {
  ok(repos.has(mirrorId.id), "[git] You must init the mirrors first!");
  if (repos.get(mirrorId.id).intervalId) {
    clearInterval(repos.get(mirrorId.id).intervalId);
  }
  repos.get(mirrorId.id).intervalId = setInterval(() => {
    updateMirror(mirrorId, ctx).catch(ctx.logger.debug);
  }, interval);
  ctx.logger.warn(
    `[git] Update started: ${interval / 1e3}s interval for ${mirrorId.id}`
  );
};

/**
 * @param {import("../typedefs.js").MirrorIds} mirrorIds
 * @throws {AssertionError}
 */
export const stopMirrorsUpdates = (mirrorIds) => {
  ok(repos.has(GUARD_ID), "[git] You must init the mirrors first!");
  if (repos.get(GUARD_ID).intervalId) {
    clearInterval(repos.get(GUARD_ID).intervalId);
  }
  Object.keys(mirrorIds.watched).forEach((repoId) =>
    clearInterval(repos.get(mirrorIds.watched[repoId].id).intervalId)
  );
};

/**
 * @param {import("../typedefs.js").MirrorIds} mirrorIds
 * @param {import("../typedefs.js").Context>} ctx
 */
export const startMirrorsUpdates = (mirrorIds, ctx) => {
  restartUpdateStream(ctx.intervalJobs, mirrorIds.guard, ctx);
  Object.keys(mirrorIds.watched).forEach((repoId) => {
    restartUpdateStream(ctx.intervalWatched, mirrorIds.watched[repoId], ctx);
  });
};
