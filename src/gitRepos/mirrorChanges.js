import kefir from "kefir";
import hash from "object-hash";
import { fetchMirrorHeads } from "./mirrors.js";
/**
 * @typedef {import("../typedefs").Context} Context
 * @typedef {import("../typedefs").JobEvent} JobEvent
 * @typedef {import("../typedefs").MirrorId} MirrorId
 * @typedef {import("../typedefs").BranchHeads} BranchHeads
 */

/**
 * @param {Context} ctx
 * @param {MirrorId} gitId
 * @returns {import("kefir").Stream<BranchHeads>}
 */
export const subscribeRepo = (ctx, gitId) => {
  const { branchFilter } = ctx.ruleOptions[gitId.id];
  return kefir
    .fromEvents(ctx.emitter, "updateMirror")
    .filter((event) => event.gitId?.id === gitId.id)
    .merge(kefir.fromPromise(fetchMirrorHeads(gitId)))
    .map((x) => ({
      gitId: x.gitId,
      heads: x.heads.filter((branch) =>
        branchFilter.find((pattern) => branch.branch.startsWith(pattern))
      ),
    }));
};

/**
 * @param {import("kefir").Stream<BranchHeads, Error>} branchHeadsStream
 * @returns {import("kefir").Stream<JobEvent, Error>}
 */
export const streamOfChangedAndRemoved = (branchHeadsStream) =>
  branchHeadsStream
    .diff(
      (prev, cur) => [
        ...cur.heads
          .filter((commit) => {
            return (
              hash(commit) !==
              hash(prev.heads.find((x) => x.branch === commit.branch) || {})
            );
          })
          .map((commit) => ({
            gitId: cur.gitId,
            commit,
            type: "changed",
          })),
        ...prev.heads
          .filter(
            (commit) =>
              !cur.heads.find((newHead) => newHead.branch === commit.branch)
          )
          .map((commit) => ({ gitId: prev.gitId, commit, type: "removed" })),
      ],
      { heads: [] }
    )
    // .skip(1) // first diff was compared with empty init value
    .filter((x) => x.length)
    .flatten();
