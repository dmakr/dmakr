import kefir from "kefir";
import { logger } from "../config.js";
import {
  mirrorStateChanges,
  streamOfChangedAndRemoved,
} from "../gitRepos/mirrorChanges.js";
import { jobStateChanges } from "../jobStates/jobState.js";
import { agentRunner } from "./agentRunner.js";
import { forwardRunner } from "./forwardRunner.js";
/**
 * @typedef {import("../typedefs").Context} Context
 * @typedef {import("../typedefs").JobEvent} JobEvent
 * @typedef {import("../typedefs").MirrorId} MirrorId
 * @typedef {import("../typedefs").MirrorIds} MirrorIds
 * @typedef {import("../typedefs").CommitInfo} CommitInfo
 * @typedef {import("../typedefs").BranchHeads} BranchHeads
 * @typedef {import("../typedefs").JobStateChanged} JobStateChanged
 */

/*
agents             o
guardEvent     -p-----Fa----F--------p-----Fa-----F---
                \  
watchedEvent   --p--a-F-----------------------
watchedEvent   --p--a-F-----------------------
agents           o==o==

p = prepare | a = automatic | F = finished
*/

/**
 * @param {Context} ctx
 * @param {import("kefir").Stream<JobEvent, Error>} jobEvents
 */
const prepareJobs = (ctx, jobEvents) =>
  jobEvents
    .filter(({ type }) => type === "changed")
    .filter(({ commit: { branch, commitId }, gitId }) => {
      const status = ctx.db.getByCommit(gitId.id, commitId);
      return status.jobs?.[branch]?.prepare === undefined;
    })
    .map((x) => ({ ...x, type: "prepare" }));

/**
 * @param {Context} ctx
 * @param {import("kefir").Stream<JobEvent, Error>} jobEvents
 */
const removeJobs = (ctx, jobEvents) =>
  jobEvents
    .filter(({ type }) => type === "removed")
    .filter(({ commit: { branch, commitId }, gitId }) => {
      const status = ctx.db.getByCommit(gitId.id, commitId);
      return status.jobs?.[branch]?.prepare === undefined;
    });

/**
 * @param {import("kefir").Stream<BranchHeads, Error>} mirrorChanges
 * @param {import("kefir").Stream<JobStateChanged, Error>} jobStateChanged
 * @returns {import("kefir").Stream<JobEvent, Error>}
 */
export const automaticJobs = (mirrorChanges, jobStateChanged) => {
  const automaticSampler = jobStateChanged.filter(
    (jobStates) =>
      jobStates.trigger.status === "finished" &&
      ["prepare", "prepare:forward"].includes(jobStates.trigger.job)
  );
  return mirrorChanges
    .sampledBy(automaticSampler, (branches, jobStates) =>
      branches.heads
        .filter(
          ({ commitId, branch }) =>
            commitId === jobStates.trigger.commitId &&
            branch === jobStates.trigger.branch &&
            jobStates.state[branch]?.automatic === undefined
        )
        .reduce(
          (prev, commit) => ({
            commit,
            gitId: branches.gitId,
            type: "automatic",
          }),
          false
        )
    )
    .filter();
};

/**
 * @param {Context} ctx
 * @param {import("kefir").Stream<BranchHeads, Error>} guardChanges
 * @param {import("kefir").Stream<JobStateChanged, Error>} jobStateChanged
 * @returns {import("kefir").Stream<JobEvent, Error>}
 */
const forwardJobs = (ctx, guardChanges, jobStateChanged) => {
  const forwardSampler = jobStateChanged.filter(
    (jobStates) => jobStates.trigger.status === "forward"
  );
  return guardChanges
    .sampledBy(forwardSampler, (branches, jobStates) => {
      const branchSelection = Array.from(
        new Set([
          jobStates.trigger.branch,
          ...(ctx.fallbackBranch ?? ["main", "master"]),
        ])
      );
      return branches.heads
        .filter(({ branch }) => branchSelection.includes(branch))
        .sort(
          (a, b) => branchSelection.findIndex(a) - branchSelection.findIndex(b)
        )
        .slice(0, 1)
        .reduce(
          (prev, commit) => ({
            commit,
            gitId: branches.gitId,
            type: jobStates.trigger.job,
            source: jobStates.trigger,
          }),
          false
        );
    })
    .filter();
};

export default (ctx, mirrors) => {
  prepareJobs(
    ctx,
    streamOfChangedAndRemoved(mirrorStateChanges(mirrors, ctx).guard)
  )
    .flatMapConcat(agentRunner(ctx, mirrors.guard))
    .observe({ value: logger.debug, error: logger.error });

  Object.keys(mirrors.watched).map((key) =>
    prepareJobs(
      ctx,
      streamOfChangedAndRemoved(mirrorStateChanges(mirrors, ctx).watched[key])
    )
      .flatMapConcat(agentRunner(ctx, mirrors.watched[key]))
      .observe({ value: logger.debug, error: logger.error })
  );

  removeJobs(
    ctx,
    streamOfChangedAndRemoved(mirrorStateChanges(mirrors, ctx).guard)
  )
    .flatMapConcat(agentRunner(ctx, mirrors.guard))
    .observe({ value: logger.debug, error: logger.error });

  automaticJobs(
    mirrorStateChanges(mirrors, ctx).guard,
    jobStateChanges(ctx, mirrors.guard)
  )
    .flatMapConcat(agentRunner(ctx, mirrors.guard))
    .observe({ value: logger.debug, error: logger.error });

  Object.keys(mirrors.watched).map((key) =>
    automaticJobs(
      mirrorStateChanges(mirrors, ctx).watched[key],
      jobStateChanges(ctx, mirrors.watched[key])
    )
      .flatMapConcat(agentRunner(ctx, mirrors.watched[key]))
      .observe({ value: logger.debug, error: logger.error })
  );

  forwardJobs(
    ctx,
    mirrorStateChanges(mirrors, ctx).guard,
    kefir.merge(
      Object.keys(mirrors.watched).map((key) =>
        jobStateChanges(ctx, mirrors.watched[key])
      )
    )
  )
    .flatMapConcat(forwardRunner(ctx, mirrors.guard))
    .observe({ value: logger.debug, error: logger.error });
};
