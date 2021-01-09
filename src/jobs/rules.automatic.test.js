import test from "ava";
import kefir from "kefir";
import { automaticJobs } from "./rules.js";

test.cb(
  "guard.jobs: 'prepare->finished' should start 'automatic' but only if on head commit",
  (t) => {
    const branchMock = kefir.sequentially(50, [
      {
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
          jobs: { id: "guard.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
      },
      {
        heads: [
          {
            branch: "master",
            commitId: "62460fa",
            message: "add jobs",
            tags: ["0.0.1"],
          },
          {
            branch: "feature/foo",
            commitId: "a2656de",
            message: "new head",
            tags: [],
          },
        ],
        gitId: {
          jobs: { id: "guard.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
      },
    ]);
    const jobChangeEvents = kefir.merge([
      kefir.later(70, {
        trigger: {
          status: "finished",
          job: "prepare",
          commitId: "62460fa",
          branch: "master",
          gitId: { id: "guard.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
        state: {
          master: { prepare: "finished" },
        },
      }),
      kefir.later(150, {
        trigger: {
          status: "finished",
          job: "prepare",
          commitId: "f1460ac",
          branch: "feature/foo",
          gitId: { id: "guard.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
        state: {
          master: { prepare: "finished" },
        },
      }),
    ]);
    t.plan(1);
    automaticJobs(branchMock, jobChangeEvents)
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
                jobs: { id: "guard.jobs", url: "/app/.dmakr/.mirrors/jobs" },
              },
              type: "automatic",
            },
          ]);
        },
        end() {
          t.end();
        },
      });
  }
);

test.cb(
  "guard.jobs: 'prepare:indirectly->finished' should start 'automatic:indirectly' but only if on head commit",
  (t) => {
    const branchMock = kefir.sequentially(50, [
      {
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
          jobs: { id: "guard.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
      },
      {
        heads: [
          {
            branch: "master",
            commitId: "62460fa",
            message: "add jobs",
            tags: ["0.0.1"],
          },
          {
            branch: "feature/foo",
            commitId: "a2656de",
            message: "new head",
            tags: [],
          },
        ],
        gitId: {
          jobs: { id: "guard.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
      },
    ]);
    const jobChangeEvents = kefir.merge([
      kefir.later(70, {
        trigger: {
          status: "finished",
          job: "prepare:indirectly",
          commitId: "62460fa",
          branch: "master",
          gitId: { id: "guard.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
        state: {
          master: { prepare: "finished" },
        },
      }),
      kefir.later(150, {
        trigger: {
          status: "finished",
          job: "prepare:indirectly",
          commitId: "f1460ac",
          branch: "feature/foo",
          gitId: { id: "guard.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
        state: {
          master: { prepare: "finished" },
        },
      }),
    ]);
    t.plan(1);
    automaticJobs(branchMock, jobChangeEvents)
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
                jobs: { id: "guard.jobs", url: "/app/.dmakr/.mirrors/jobs" },
              },
              type: "automatic",
            },
          ]);
        },
        end() {
          t.end();
        },
      });
  }
);

test.cb(
  "watched jobs: 'prepare->finished' should start 'automatic' but only if on head commit",
  (t) => {
    const branchMock = kefir.sequentially(50, [
      {
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
          jobs: { id: "watched.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
      },
      {
        heads: [
          {
            branch: "master",
            commitId: "62460fa",
            message: "add jobs",
            tags: ["0.0.1"],
          },
          {
            branch: "feature/foo",
            commitId: "a2656de",
            message: "new head",
            tags: [],
          },
        ],
        gitId: {
          jobs: { id: "watched.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
      },
    ]);
    const jobChangeEvents = kefir.merge([
      kefir.later(70, {
        trigger: {
          status: "finished",
          job: "prepare",
          commitId: "62460fa",
          branch: "master",
          gitId: { id: "watched.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
        state: {
          master: { prepare: "finished" },
        },
      }),
      kefir.later(150, {
        trigger: {
          status: "finished",
          job: "prepare",
          commitId: "f1460ac",
          branch: "feature/foo",
          gitId: { id: "watched.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
        state: {
          master: { prepare: "finished" },
        },
      }),
    ]);
    t.plan(1);
    automaticJobs(branchMock, jobChangeEvents)
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
                jobs: { id: "watched.jobs", url: "/app/.dmakr/.mirrors/jobs" },
              },
              type: "automatic",
            },
          ]);
        },
        end() {
          t.end();
        },
      });
  }
);

test.cb(
  "watched jobs: 'prepare:indirectly->finished' should start 'automatic:indirectly' but only if on head commit",
  (t) => {
    const branchMock = kefir.sequentially(50, [
      {
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
          jobs: { id: "watched.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
      },
      {
        heads: [
          {
            branch: "master",
            commitId: "62460fa",
            message: "add jobs",
            tags: ["0.0.1"],
          },
          {
            branch: "feature/foo",
            commitId: "a2656de",
            message: "new head",
            tags: [],
          },
        ],
        gitId: {
          jobs: { id: "watched.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
      },
    ]);
    const jobChangeEvents = kefir.merge([
      kefir.later(70, {
        trigger: {
          status: "finished",
          job: "prepare:indirectly",
          commitId: "62460fa",
          branch: "master",
          gitId: { id: "watched.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
        state: {
          master: { prepare: "finished" },
        },
      }),
      kefir.later(150, {
        trigger: {
          status: "finished",
          job: "prepare:indirectly",
          commitId: "f1460ac",
          branch: "feature/foo",
          gitId: { id: "watched.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
        state: {
          master: { prepare: "finished" },
        },
      }),
    ]);
    t.plan(1);
    automaticJobs(branchMock, jobChangeEvents)
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
                jobs: { id: "watched.jobs", url: "/app/.dmakr/.mirrors/jobs" },
              },
              type: "automatic",
            },
          ]);
        },
        end() {
          t.end();
        },
      });
  }
);

test.cb(
  "watched jobs: 'prepare:forward->finished' should start 'automatic:forward' but only if on head commit",
  (t) => {
    const branchMock = kefir.sequentially(50, [
      {
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
          jobs: { id: "watched.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
      },
      {
        heads: [
          {
            branch: "master",
            commitId: "62460fa",
            message: "add jobs",
            tags: ["0.0.1"],
          },
          {
            branch: "feature/foo",
            commitId: "a2656de",
            message: "new head",
            tags: [],
          },
        ],
        gitId: {
          jobs: { id: "watched.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
      },
    ]);
    const jobChangeEvents = kefir.merge([
      kefir.later(70, {
        trigger: {
          status: "finished",
          job: "prepare:forward",
          commitId: "62460fa",
          branch: "master",
          gitId: { id: "watched.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
        state: {
          master: { prepare: "finished" },
        },
      }),
      kefir.later(150, {
        trigger: {
          status: "finished",
          job: "prepare:forward",
          commitId: "f1460ac",
          branch: "feature/foo",
          gitId: { id: "watched.jobs", url: "/app/.dmakr/.mirrors/jobs" },
        },
        state: {
          master: { prepare: "finished" },
        },
      }),
    ]);
    t.plan(1);
    automaticJobs(branchMock, jobChangeEvents)
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
                jobs: { id: "watched.jobs", url: "/app/.dmakr/.mirrors/jobs" },
              },
              type: "automatic",
            },
          ]);
        },
        end() {
          t.end();
        },
      });
  }
);
