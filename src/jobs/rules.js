import kefir from "kefir";
import { logger } from "../config.js";
import {
  streamOfChangedAndRemoved,
  subscribeRepo,
} from "../gitRepos/mirrorChanges.js";
import { jobStateChanges } from "../jobStates/jobState.js";
import { agentRunner } from "./agentRunner.js";
import { forwardRunner } from "./forwardRunner.js";
import indirectRunner from "./indirectRunner.js";
import { generatePrepareForWatched } from "./rules.prepare.js";
/**
 * @typedef {import("../typedefs").Context} Context
 * @typedef {import("../typedefs").JobEvent} JobEvent
 * @typedef {import("../typedefs").MirrorIds} MirrorIds
 * @typedef {import("../typedefs").BranchHeads} BranchHeads
 * @typedef {import("../typedefs").JobStateChanged} JobStateChanged
 */
/*
agents                e  e                        e  e
guardEvent     -c-----p--a----------------ci------pi-a---
                \    /                   /  \    /
watchedEvent   --pi-a-------------c--p--a----------------
watchedEvent   --pi-a------------------------pi-a--------
agents           e  e                e  e   [e][e]

c = changed | p = prepare | a = automatic | i = indirectly | e = exec
*/

/**
 * @param {Context} ctx
 * @param {import("kefir").Stream<JobEvent, Error>} jobEvents
 */
// const removeJobs = (ctx, jobEvents) =>
//   jobEvents.filter(({ type }) => type === "removed");

/**
 * @param {import("kefir").Stream<BranchHeads, Error>} mirrorHeads
 * @param {import("kefir").Stream<JobStateChanged, Error>} jobStateChanged
 * @returns {import("kefir").Stream<JobEvent, Error>}
 */
export const automaticJobs = (mirrorHeads, jobStateChanged) => {
  const automaticFilter = jobStateChanged.filter(
    (jobStates) =>
      jobStates.trigger.status === "finished" &&
      [
        "prepare",
        "prepare:forward",
        "prepare:indirectly",
        "prepare:indirectly:forward",
      ].includes(jobStates.trigger.job)
  );
  return mirrorHeads
    .sampledBy(automaticFilter, (branches, jobStates) =>
      branches.heads
        .filter(
          ({ commitId, branch }) =>
            commitId === jobStates.trigger.commitId &&
            branch === jobStates.trigger.branch
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
  const forwardFilter = jobStateChanged.filter(
    (jobStates) => jobStates.trigger.status === "forward"
  );
  return guardChanges
    .sampledBy(forwardFilter, (branches, jobStates) => {
      const branchSelection = Array.from(
        new Set([jobStates.trigger.branch, ...ctx.jobRepoOptions.defaultBranch])
      );
      return branches.heads
        .filter(({ branch }) => branchSelection.includes(branch))
        .sort(
          (a, b) =>
            branchSelection.indexOf(a.branch) -
            branchSelection.indexOf(b.branch)
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

/**
 * @function rules
 * @param {Context} ctx
 * @param {MirrorIds} mirrors
 */
export default (ctx, mirrors) => {
  // console.log(ctx.watchedRepos.map((x) => x.options));
  kefir
    .merge(
      generatePrepareForWatched(
        ctx,
        Object.keys(mirrors.watched).map((key) =>
          subscribeRepo(ctx, mirrors.watched[key])
        ),
        kefir.merge(
          Object.keys(ctx.ruleOptions).map((key) =>
            streamOfChangedAndRemoved(subscribeRepo(ctx, { id: key }))
          )
        )
      )
    )
    // .spy()
    .flatMapConcat(indirectRunner(ctx))
    .observe({ value: logger.debug, error: logger.error });

  // Object.keys(mirrors.watched).map((key) =>
  //   prepareJobs(
  //     ctx,
  //     streamOfChangedAndRemoved(
  //       subscribeRepo(ctx, mirrors.watched[key])
  //     )
  //   )
  //     .flatMapConcat(agentRunner(ctx, mirrors.watched[key]))
  //     .observe({ value: logger.debug, error: logger.error })
  // );

  // removeJobs(streamOfChangedAndRemoved(subscribeRepo(mirrors.guard)))
  //   .flatMapConcat(agentRunner(ctx, mirrors.guard))
  //   .observe({ value: logger.debug, error: logger.error });

  automaticJobs(
    subscribeRepo(ctx, mirrors.guard),
    jobStateChanges(ctx, mirrors.guard)
  )
    .flatMapConcat(agentRunner(ctx, mirrors.guard))
    .observe({ value: logger.debug, error: logger.error });

  Object.keys(mirrors.watched).map((key) =>
    automaticJobs(
      subscribeRepo(ctx, mirrors.watched[key]),
      jobStateChanges(ctx, mirrors.watched[key])
    )
      .flatMapConcat(agentRunner(ctx, mirrors.watched[key]))
      .observe({ value: logger.debug, error: logger.error })
  );

  forwardJobs(
    ctx,
    subscribeRepo(ctx, mirrors.guard),
    kefir.merge(
      Object.keys(mirrors.watched).map((key) =>
        jobStateChanges(ctx, mirrors.watched[key])
      )
    )
  )
    .flatMapConcat(forwardRunner(ctx, mirrors.guard))
    .observe({ value: logger.debug, error: logger.error });
};
