import test from "ava";
import { join } from "path";
import { EventEmitter } from "events";
import { mkdirSync, rmdirSync } from "fs";
import simpleGit from "simple-git";
import Loki from "lokijs";
import sinon from "sinon";

import { buildMirrors } from "../mirrors.js";

/**
 * @type {import("../../typedefs.js").Context}
 */
let context = {};
const { LokiMemoryAdapter } = Loki;
const db = new Loki("sandbox.db", { adapter: new LokiMemoryAdapter() });
const logger = { info: sinon.spy() };
const MOCK_REPO_EMPTY = "/data/mock/repo-empty";

test.before(async () => {
  mkdirSync(MOCK_REPO_EMPTY, { recursive: true });
  const repoEmpty = simpleGit(MOCK_REPO_EMPTY);
  await repoEmpty.init();
  delete process.env.DATA_PATH;
  delete process.env.JOB_REPO;
});

test.beforeEach(() => {
  sinon.reset();
  context = {
    dataPath: "/data/createMirrorsTest",
    jobRepo: "wrongUrl",
    watchedRepos: [],
    logger,
    db,
    emitter: new EventEmitter(),
  };
});

test.serial("Clone fails on wrong URL", async (t) => {
  rmdirSync(join(context.dataPath, ".mirrors", "jobs"), { recursive: true });

  await t.throwsAsync(buildMirrors(context), {
    instanceOf: simpleGit.GitError,
  });
  t.is(
    logger.info.args[0][0],
    "[guard.jobs] Error: Cannot use simple-git on a directory that does not exist"
  );
  t.is(
    logger.info.args[1][0],
    "[guard.jobs] buildMirrors: Trying to repair ..."
  );
  t.is(logger.info.callCount, 2);
});

test.serial("Clone successful despite blocking folder", async (t) => {
  context.jobRepo = MOCK_REPO_EMPTY;
  const mirrorPath = join(context.dataPath, ".mirrors", "jobs");
  rmdirSync(mirrorPath, { recursive: true });
  mkdirSync(mirrorPath, { recursive: true });

  await buildMirrors(context);
  t.is(
    logger.info.args[0][0],
    "[guard.jobs] AssertionError [ERR_ASSERTION]: buildMirrors: No git repo at: /data/createMirrorsTest/.mirrors/jobs"
  );
  t.is(
    logger.info.args[2][0],
    "[guard.jobs] buildMirrors: The repair was successful."
  );
  t.is(logger.info.callCount, 3);
  const detectRepo = simpleGit(mirrorPath);
  t.like(await detectRepo.branch(), { all: [] });
});

test.serial(
  "Clone successful despite git repo was a non bare one",
  async (t) => {
    context.jobRepo = MOCK_REPO_EMPTY;
    const mirrorPath = join(context.dataPath, ".mirrors", "jobs");
    rmdirSync(mirrorPath, { recursive: true });
    mkdirSync(mirrorPath, { recursive: true });
    await simpleGit(mirrorPath).init();

    t.deepEqual(await buildMirrors(context), {
      guard: { id: "guard.jobs", url: mirrorPath },
      watched: {},
    });
    t.is(
      logger.info.args[0][0],
      "[guard.jobs] AssertionError [ERR_ASSERTION]: buildMirrors: No bare git repo at: /data/createMirrorsTest/.mirrors/jobs"
    );
  }
);

test.serial("Get the existing git repo", async (t) => {
  context.jobRepo = MOCK_REPO_EMPTY;
  const mirrorPath = join(context.dataPath, ".mirrors", "jobs");
  const gitIds = await buildMirrors(context);
  t.deepEqual(gitIds, {
    guard: { id: "guard.jobs", url: mirrorPath },
    watched: {},
  });

  t.truthy(logger.info.notCalled);
});

test.serial("Create additionally watched repos", async (t) => {
  context.jobRepo = MOCK_REPO_EMPTY;
  context.watchedRepos = [
    { id: "app", url: MOCK_REPO_EMPTY },
    { id: "api", url: MOCK_REPO_EMPTY },
  ];
  const mirrorPath = join(context.dataPath, ".mirrors", "watched");
  rmdirSync(mirrorPath, { recursive: true });
  mkdirSync(mirrorPath, { recursive: true });

  const gitIds = await buildMirrors(context);
  t.deepEqual(gitIds, {
    guard: {
      id: "guard.jobs",
      url: join(context.dataPath, ".mirrors", "jobs"),
    },
    watched: {
      app: { id: "watched.app", url: join(mirrorPath, "app") },
      api: { id: "watched.api", url: join(mirrorPath, "api") },
    },
  });
  const detectRepoApp = simpleGit(join(mirrorPath, "app"));
  t.like(await detectRepoApp.branch(), { all: [] });
  const detectRepoApi = simpleGit(join(mirrorPath, "api"));
  t.like(await detectRepoApi.branch(), { all: [] });
});
