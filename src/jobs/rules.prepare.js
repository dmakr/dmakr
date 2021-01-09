/**
 * @typedef {import("../typedefs").Context} Context
 * @typedef {import("../typedefs").JobEvent} JobEvent
 * @typedef {import("../typedefs").MirrorIds} MirrorIds
 * @typedef {import("../typedefs").BranchHeads} BranchHeads
 * @typedef {import("../typedefs").JobStateChanged} JobStateChanged
 */

/**
 * @param {Context} ctx
 * @param {import("kefir").Stream<JobEvent, Error>} jobEvents
 */
export const prepareJobs = (ctx, jobEvents) =>
  jobEvents
    .filter(({ type }) => type === "changed")
    .filter(({ commit: { branch, commitId }, gitId }) => {
      const status = ctx.db.getByCommit(gitId.id, commitId);
      return status.jobs?.[branch]?.changed === undefined;
    })
    .map((x) => ({ ...x, type: "prepare" }));

/**
 * @param {Context} ctx
 * @param {import("kefir").Stream<BranchHeads, Error>[]} mirrorHeads
 * @param {import("kefir").Stream<JobEvent, Error>} changedEvents
 */
export const generatePrepareForWatched = (ctx, mirrorHeads, changedEvents) => {
  const trigger = changedEvents
    .delay(100)
    .filter(({ type }) => type === "changed");
  return mirrorHeads.map((watched) =>
    watched
      .sampledBy(trigger, (branches, jobEvent) => {
        const branchSelection = Array.from(
          new Set([
            jobEvent.commit.branch,
            ...ctx.ruleOptions[branches.gitId.id].defaultBranch,
          ])
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
              type: "prepare",
              parent: jobEvent,
            }),
            false
          );
      })
      .filter()
  );
};
