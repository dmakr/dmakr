import test from "ava";
import { EventEmitter } from "events";
import sinon from "sinon";
import { modifyJobState } from "./jobState.js";

test.beforeEach(() => {
  sinon.reset();
});

test("Same state should be ignored", async (t) => {
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
  };
  await modifyJobState(context, {
    gitId: { id: "foo" },
    branch: "feature/baz",
    job: "prepare",
    status: "something",
  });
  t.false(context.db.setByCommit.called);
});

test("State changes should be saved and fire event", async (t) => {
  const context = {
    emitter: new EventEmitter(),
    db: {
      getByCommit: sinon.stub().returns({ jobs: { test: "foo" } }),
      setByCommit: sinon.spy(),
    },
  };
  context.emitter.on("jobStateChanged", (event) => {
    t.like(event, {
      trigger: { branch: "main" },
      state: { main: { prepare: { status: "something" } } },
    });
  });
  await modifyJobState(context, {
    gitId: { id: "foo" },
    branch: "main",
    job: "prepare",
    status: "something",
  });
  t.true(context.db.setByCommit.called);
});
