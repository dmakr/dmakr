import deepMerge from "deepmerge";
import kefir from "kefir";
import hash from "object-hash";
/** @typedef {import("../typedefs").Context} Context */
/** @typedef {import("../typedefs").MirrorId} MirrorId */
/** @typedef {import("../typedefs").JobEvent} JobEvent */
/** @typedef {import("../typedefs").ModifyJobState} ModifyJobState */
/** @typedef {import("../typedefs").JobStateChanged} JobStateChanged */

/**
 * modifyJobState event
 * @event jobState#jobStateChanged
 * @type {JobStateChanged}
 */
/**
 * @param {Context} ctx
 * @param {MirrorId} gitId
 * @listens jobState#jobStateChanged
 * @returns {import("kefir").Stream<JobStateChanged, Error>}
 */
export const jobStateChanges = (ctx, gitId) =>
  kefir
    .fromEvents(ctx.emitter, "jobStateChanged")
    .filter((event) => event.trigger.gitId?.id === gitId.id);

/**
 * @param {Context} ctx
 * @param {ModifyJobState} jobStatus
 * @fires jobState#jobStateChanged
 */
export const modifyJobState = async (ctx, jobStatus) => {
  const { gitId, commitId, branch, job, status } = jobStatus;
  const doc = ctx.db.getByCommit(gitId.id, commitId);
  const oldStatus = doc.jobs ?? {};
  const oldHash = hash(oldStatus);
  const newStatus = {
    [branch]: {
      [job]: {
        status,
      },
    },
  };
  const merged = deepMerge(oldStatus, newStatus);
  const newHash = hash(merged);
  if (newHash !== oldHash) {
    await ctx.db.setByCommit(gitId.id, commitId, {
      ...doc,
      jobs: merged,
    });
    ctx.emitter.emit("jobStateChanged", {
      trigger: jobStatus,
      state: merged,
    });
  }
};

/**
 * @param {Context} ctx
 * @param {JobEvent} job
 * @param {string} ws  Workspace path of cloned sources
 * @fires jobState#jobStateChanged
 */
export const registerIndirectlyRunner = async (ctx, job, ws) => {
  const { commit, parent, gitId, type } = job;
  const doc = ctx.db.getByCommit(parent.gitId.id, parent.commit.commitId);
  await ctx.db.setByCommit(
    parent.gitId.id,
    parent.commit.commitId,
    deepMerge(doc, {
      indirectlyRunner: {
        [parent.commit.branch]: {
          [parent.type]: {
            [gitId.id]: {
              status: "running",
              count: ctx.watchedRepos.length,
              type,
              ws,
              commitId: commit.commitId,
              branch: commit.branch,
            },
          },
        },
      },
    })
  );
};

/**
 * @param {Context} ctx
 * @param {JobEvent} job
 * @fires jobState#jobStateChanged
 */
export const finishIndirectlyRunner = async (ctx, job) => {
  const { parent, gitId } = job;
  const doc = ctx.db.getByCommit(parent.gitId.id, parent.commit.commitId);
  await ctx.db.setByCommit(
    parent.gitId.id,
    parent.commit.commitId,
    deepMerge(doc, {
      indirectlyRunner: {
        [parent.commit.branch]: {
          [parent.type]: {
            [gitId.id]: {
              status: "finished",
            },
          },
        },
      },
    })
  );
};
