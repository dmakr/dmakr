import test from "ava";
import kefir from "kefir";
import { EventEmitter } from "events";
import sinon from "sinon";
import { generatePrepareForWatched } from "./rules.prepare.js";

test.beforeEach(() => {
  sinon.reset();
});

test.cb("Multiple WATCHED", (t) => {
  const context = {
    emitter: new EventEmitter(),
    db: {
      getByCommit: sinon.stub().callsFake((_, commitId) => ({
        commitId,
      })),
      setByCommit: sinon.spy(),
    },
    ruleOptions: {
      "guard.jobs": {
        defaultBranch: ["main", "master"],
        branchFilter: ["master", "main", "feature/", "dev"],
      },
      "watched.app": {
        defaultBranch: ["main", "master"],
        branchFilter: ["main", "feature/", "dev"],
      },
      "watched.service": {
        defaultBranch: ["master"],
        branchFilter: ["master", "main", "feature/"],
      },
    },
    watchedRepos: [
      {
        id: "app",
      },
      {
        id: "service",
      },
    ],
  };
  const changedMock = kefir.sequentially(50, [
    {
      commit: {
        branch: "feature/foo",
        commitId: "44557fa",
        message: "new new",
        tags: [],
      },
      gitId: {
        id: "watched.app",
        url: "/app/.dmakr/.mirrors/watched/app",
      },
      type: "changed",
    },
    {
      commit: {
        branch: "main",
        commitId: "44557fa",
        message: "new new",
        tags: [],
      },
      gitId: {
        id: "guard.jobs",
        url: "/app/.dmakr/.mirrors/jobs",
      },
      type: "changed",
    },
  ]);
  const watchedMock = ["service", "app"].map((id) =>
    kefir.constant({
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
      gitId: {
        id: `watched.${id}`,
        url: `/app/.dmakr/.mirrors/watched/${id}`,
      },
    })
  );
  t.plan(2);
  let endCounter = 0;
  return generatePrepareForWatched(context, watchedMock, changedMock).map(
    (stream) =>
      stream
        .bufferWhile()
        // .spy()
        .observe({
          value(x) {
            t.deepEqual(x, [
              {
                commit: {
                  branch: "feature/foo",
                  commitId: "f1460ac",
                  message: "next small thing",
                  tags: [],
                },
                gitId: x[0]?.gitId,
                type: "prepare",
                parent: {
                  commit: {
                    branch: "feature/foo",
                    commitId: "44557fa",
                    message: "new new",
                    tags: [],
                  },
                  gitId: {
                    id: "watched.app",
                    url: "/app/.dmakr/.mirrors/watched/app",
                  },
                  type: "changed",
                },
              },
              {
                commit: {
                  branch: "master",
                  commitId: "62460fa",
                  message: "add jobs",
                  tags: ["0.0.1"],
                },
                gitId: x[1]?.gitId,
                type: "prepare",
                parent: {
                  commit: {
                    branch: "main",
                    commitId: "44557fa",
                    message: "new new",
                    tags: [],
                  },
                  gitId: {
                    id: "guard.jobs",
                    url: "/app/.dmakr/.mirrors/jobs",
                  },
                  type: "changed",
                },
              },
            ]);
          },
          end() {
            endCounter += 1;
            if (endCounter === 2) {
              t.end();
            }
          },
        })
  );
});

test("Race condition: first guard change before the initial branch-heads", (t) => {
  const context = {
    emitter: new EventEmitter(),
    db: {
      getByCommit: sinon.stub().callsFake((_, commitId) => ({
        commitId,
      })),
      setByCommit: sinon.spy(),
    },
  };
  const guardMock = kefir.constant({
    commit: {
      branch: "feature/foo",
      commitId: "44557fa",
      message: "new new",
      tags: [],
    },
    gitId: {
      id: "guard.jobs",
      url: "/app/.dmakr/.mirrors/jobs",
    },
    type: "changed",
  });
  const branchMock = ["service", "app"].map((id) =>
    kefir.later(50, {
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
      gitId: {
        id: `watched.${id}`,
        url: `/app/.dmakr/.mirrors/watched/${id}`,
      },
    })
  );
  t.plan(2);
  generatePrepareForWatched(context, branchMock, guardMock).map((stream) =>
    stream.observe({
      value() {
        t.fail();
      },
      end() {
        t.pass();
      },
    })
  );
});

test.cb("One WATCHED", (t) => {
  const context = {
    emitter: new EventEmitter(),
    db: {
      getByCommit: sinon.stub().returns({
        jobs: {
          "feature/baz": { prepare: { status: "something" } },
        },
      }),
      setByCommit: sinon.spy(),
    },
    ruleOptions: {
      "guard.jobs": {
        defaultBranch: ["main", "master"],
        branchFilter: ["master", "main", "feature/", "dev"],
      },
      "watched.service": {
        defaultBranch: ["master"],
        branchFilter: ["master", "main", "feature/"],
      },
    },
    watchedRepos: [
      {
        id: "service",
      },
    ],
  };
  const guardMock = kefir.sequentially(70, [
    {
      commit: {
        branch: "feature/foo",
        commitId: "44557fa",
        message: "new new",
        tags: [],
      },
      gitId: {
        id: "guard.jobs",
        url: "/app/.dmakr/.mirrors/jobs",
      },
      type: "changed",
    },
  ]);
  const branchMock = kefir.sequentially(50, [
    {
      heads: [
        {
          branch: "master",
          commitId: "62460fa",
          message: "add jobs",
          tags: ["0.0.1"],
        },
      ],
      gitId: {
        id: "watched.service",
        url: "/app/.dmakr/.mirrors/watched/service",
      },
    },
  ]);
  t.plan(1);
  generatePrepareForWatched(context, [branchMock], guardMock)[0]
    .bufferWhile()
    .observe({
      value(x) {
        t.deepEqual(x, [
          {
            commit: {
              branch: "master",
              commitId: "62460fa",
              message: "add jobs",
              tags: ["0.0.1"],
            },
            gitId: {
              id: "watched.service",
              url: "/app/.dmakr/.mirrors/watched/service",
            },
            type: "prepare",
            parent: {
              commit: {
                branch: "feature/foo",
                commitId: "44557fa",
                message: "new new",
                tags: [],
              },
              gitId: {
                id: "guard.jobs",
                url: "/app/.dmakr/.mirrors/jobs",
              },
              type: "changed",
            },
          },
        ]);
      },
      end() {
        t.end();
      },
    });
});
