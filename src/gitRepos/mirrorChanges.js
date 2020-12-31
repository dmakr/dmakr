import kefir from "kefir";
import hash from "object-hash";

/**
 * @typedef {import("../typedefs").Context} Context
 * @typedef {import("../typedefs").JobEvent} JobEvent
 * @typedef {import("../typedefs").MirrorId} MirrorId
 * @typedef {import("../typedefs").MirrorIds} MirrorIds
 * @typedef {import("../typedefs").CommitInfo} CommitInfo
 * @typedef {import("../typedefs").BranchHeads} BranchHeads
 */

/**
 * @param {MirrorId} gitId
 * @param {EventEmitter} emitter
 * @returns {import("kefir").Stream<BranchHeads>}
 */
export const subscribeRepo = (gitId, emitter) =>
  kefir
    .fromEvents(emitter, "updateMirror")
    .filter((event) => event.gitId?.id === gitId.id);

/**
 *
 * @typedef {Object} SubscribeMirrors
 * @property {import("kefir").Stream<BranchHeads>} guard
 * @property {Object.<string, import("kefir").Stream<BranchHeads>>} watched
 *
 * @param {MirrorIds} mirrors
 * @param {Context} ctx  App context
 * @returns {SubscribeMirrors}
 */
export const mirrorStateChanges = ({ guard, watched }, { emitter }) => ({
  guard: subscribeRepo(guard, emitter),
  watched: Object.keys(watched).reduce(
    (prev, id) => ({ ...prev, [id]: subscribeRepo(watched[id], emitter) }),
    {}
  ),
});

/**
 * @param {import("kefir").Stream<BranchHeads, Error>} branchHeadsStream
 * @param {Object.<string, any} ctx
 * @returns {import("kefir").Stream<JobEvent, Error>}
 */
export const streamOfChangedAndRemoved = (branchHeadsStream, ctx) => {
  const branchFilter = ctx?.branchFilter ?? [
    "master",
    "main",
    "feature/",
    "release/",
    "production",
  ];
  return (
    branchHeadsStream
      .map((x) => ({
        gitId: x.gitId,
        heads: x.heads.filter((branch) =>
          branchFilter.find((pattern) => branch.branch.startsWith(pattern))
        ),
      }))
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
      .flatten()
  );
  // .spy()
};
