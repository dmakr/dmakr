/* eslint-disable no-param-reassign */
import test from "ava";
import { join } from "path";
import { EventEmitter } from "events";
import { writeFile, rmdir, mkdir } from "fs/promises";
import simpleGit from "simple-git";
import Loki from "lokijs";
import sinon from "sinon";
import { buildMirrors, scanMirror, updateMirror } from "../mirrors.js";
import { jobStateChanges, modifyJobState } from "../../jobStates/jobState.js";
import lokiAdapter from "../../jobStates/lokiAdapter.js";

const REPO_REMOTE = "/data/mock/scanMirrorRepo";
const DATA_PATH = "/data/test/scan-mirror-repo";
const logger = { info: sinon.spy(), error: sinon.spy(), debug: sinon.spy() };
const { LokiMemoryAdapter } = Loki;
const db = lokiAdapter("sandbox.db", { adapter: new LokiMemoryAdapter() });
const emitter = new EventEmitter();

test.before(async (t) => {
  await Promise.all([
    rmdir(REPO_REMOTE, { recursive: true }),
    rmdir(DATA_PATH, { recursive: true }),
  ]);
  await Promise.all([
    mkdir(REPO_REMOTE, { recursive: true }),
    mkdir(DATA_PATH, { recursive: true }),
  ]);
  t.context.remote = simpleGit(REPO_REMOTE);
  await t.context.remote
    .init()
    .addConfig("user.name", "Some One")
    .addConfig("user.email", "some@one.com");
  await simpleGit().mirror(REPO_REMOTE, DATA_PATH);
  const context = {
    dataPath: DATA_PATH,
    jobRepo: REPO_REMOTE,
    watchedRepos: [],
    logger: { info: sinon.spy() },
    db,
  };
  t.context.gitId = await buildMirrors(context);
  t.context.scanrep = simpleGit(DATA_PATH)
    .addConfig("user.name", "Some Test")
    .addConfig("user.email", "some@test.ever");
  await Promise.all([
    writeFile(join(REPO_REMOTE, "file1.txt"), "file1"),
    writeFile(join(REPO_REMOTE, "file2.txt"), "file2"),
    writeFile(join(REPO_REMOTE, "file3.txt"), "file3"),
    writeFile(join(REPO_REMOTE, "file4.txt"), "file4"),
  ]);
  await t.context.remote.add("file1.txt").commit("initial");
  t.context.mainBranch = (await t.context.remote.branchLocal()).current;
  await t.context.remote
    .checkoutBranch("feature/foo", "HEAD")
    .add("file2.txt")
    .commit("foo stuff")
    .add("file3.txt")
    .commit("finished feature")
    .addAnnotatedTag(
      "noDmakr",
      `
      status:
        - Something is constantly changing
    `
    );
  await t.context.remote
    .checkout(t.context.mainBranch)
    .add("file4.txt")
    .commit("main goes further ahead");
});

// Remote branch structure at start
//  A-----D   main (master)
//   \
//    B--C    feature/foo

test.serial("Scan an empty mirror repo", async (t) => {
  const { guard } = t.context.gitId;
  t.deepEqual(await scanMirror(guard), []);
});

test.serial("Scan branch heads after update", async (t) => {
  const { guard } = t.context.gitId;
  await updateMirror(guard, { logger, emitter });
  const branches = await scanMirror(guard);
  const { commitId } = branches[0];
  t.deepEqual(branches[0], {
    branch: "feature/foo",
    commitId,
    message: "finished feature",
    tags: ["noDmakr"],
  });
  const { commitId: coIdMain } = branches[1];
  t.like(branches[1], {
    branch: t.context.mainBranch,
    commitId: coIdMain,
    message: "main goes further ahead",
    tags: [],
  });
});

test.serial("Update status information", async (t) => {
  const { guard } = t.context.gitId;
  const branches = await scanMirror(guard);
  const { commitId } = branches[1];
  db.setByCommit("guard.jobs", commitId, {
    commitId,
    abc: { init: "2020-10-20T22:13:13.019" },
  });
  t.plan(4);
  jobStateChanges({ emitter }, guard)
    .take(1)
    .onValue((x) => {
      t.like(x, {
        trigger: { commitId },
        state: {
          foo: { prepare: { status: "running" } },
        },
      });
    });
  jobStateChanges({ emitter }, guard)
    .skip(1)
    .onValue((x) => {
      t.like(x, {
        trigger: { commitId },
        state: {
          foo: {
            prepare: { status: "finished" },
          },
        },
      });
    });
  // simple add a job entry
  await modifyJobState(
    { db, emitter },
    {
      gitId: guard,
      commitId,
      branch: "foo",
      job: "prepare",
      status: "running",
    }
  );
  const newBranches = await scanMirror(guard);
  t.like(newBranches[1], {
    branch: t.context.mainBranch,
    message: "main goes further ahead",
    commitId,
    tags: [],
  });
  // insert and merge into an existing entry
  await modifyJobState(
    { db, emitter },
    {
      gitId: guard,
      commitId,
      branch: "foo",
      job: "prepare",
      status: "finished",
    }
  );
  const updated = await scanMirror(guard);
  t.like(updated[1], {
    branch: t.context.mainBranch,
    message: "main goes further ahead",
    commitId,
    tags: [],
  });
});

test.serial("Write new job status into an empty one", async (t) => {
  const { guard } = t.context.gitId;
  const branches = await scanMirror(guard);
  const { commitId } = branches[0];
  t.plan(2);
  jobStateChanges({ emitter }, guard)
    .take(1)
    .onValue((x) => {
      t.like(x, {
        trigger: { commitId },
        state: {
          master: { prepare: { status: "running" } },
        },
      });
    });
  await modifyJobState(
    { db, emitter },
    {
      gitId: guard,
      commitId,
      branch: "master",
      job: "prepare",
      status: "running",
    }
  );
  const newBranches = await scanMirror(guard);
  t.like(newBranches[0], {
    branch: "feature/foo",
    message: "finished feature",
    commitId,
    tags: ["noDmakr"],
  });
});
