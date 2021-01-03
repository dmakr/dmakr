import test from "ava";
import kefir from "kefir";
import { streamOfChangedAndRemoved } from "./mirrorChanges.js";

test.cb(
  "Prepare should be fired on startup regardless of the state but only for default approved branches",
  (t) => {
    const branchMock = kefir.sequentially(10, [
      {
        gitId: { id: "guard.jobs", url: "/foo" },
        heads: [
          {
            branch: "main",
            commitId: "62460fa",
            message: "add jobs",
            tags: ["0.0.1"],
          },
          {
            branch: "dev/only",
            commitId: "f1460ac",
            message: "trying something different",
            tags: [],
          },
        ],
      },
    ]);
    streamOfChangedAndRemoved(branchMock)
      .bufferWhile()
      .observe({
        value(x) {
          t.deepEqual(x, [
            {
              type: "changed",
              gitId: { id: "guard.jobs", url: "/foo" },
              commit: {
                branch: "main",
                commitId: "62460fa",
                tags: ["0.0.1"],
                message: "add jobs",
              },
            },
          ]);
        },
        end() {
          t.end();
        },
      });
  }
);

test.cb("Should be handle empty beats", (t) => {
  const branchMock = kefir.sequentially(10, []);
  t.plan(1);
  streamOfChangedAndRemoved(branchMock)
    .beforeEnd(() => "testDummy")
    .bufferWhile()
    .observe({
      value(x) {
        t.deepEqual(x, ["testDummy"]);
      },
      end() {
        t.end();
      },
    });
});

test.cb("Default behavior for repo changes over time", (t) => {
  const branchMock = kefir.sequentially(10, [
    { gitId: { id: "guard.jobs", url: "/foo" }, heads: [] },
    {
      gitId: { id: "guard.jobs", url: "/foo" },
      heads: [
        {
          branch: "master",
          commitId: "62460fa",
          message: "add jobs",
          tags: ["0.0.1"],
        },
        {
          branch: "feature/foo",
          commitId: "f1460ac",
          message: "next small thing",
          tags: [],
        },
      ],
    },
    {
      gitId: { id: "guard.jobs", url: "/foo" },
      heads: [
        {
          branch: "master",
          commitId: "2323fa7",
          message: "merge feature/foo",
          tags: [],
        },
      ],
    },
    {
      gitId: { id: "guard.jobs", url: "/foo" },
      heads: [
        {
          branch: "master",
          commitId: "2323fa7",
          message: "merge feature/foo",
          tags: [],
        },
      ],
    },
  ]);
  t.plan(1);
  streamOfChangedAndRemoved(branchMock, {})
    .bufferWhile()
    .observe({
      value(x) {
        t.deepEqual(x, [
          {
            type: "changed",
            gitId: { id: "guard.jobs", url: "/foo" },
            commit: {
              branch: "master",
              commitId: "62460fa",
              tags: ["0.0.1"],
              message: "add jobs",
            },
          },
          {
            type: "changed",
            gitId: { id: "guard.jobs", url: "/foo" },
            commit: {
              branch: "feature/foo",
              commitId: "f1460ac",
              tags: [],
              message: "next small thing",
            },
          },
          {
            type: "changed",
            gitId: { id: "guard.jobs", url: "/foo" },
            commit: {
              branch: "master",
              commitId: "2323fa7",
              tags: [],
              message: "merge feature/foo",
            },
          },
          {
            type: "removed",
            gitId: { id: "guard.jobs", url: "/foo" },
            commit: {
              branch: "feature/foo",
              commitId: "f1460ac",
              tags: [],
              message: "next small thing",
            },
          },
        ]);
      },
      end() {
        t.end();
      },
    });
});
