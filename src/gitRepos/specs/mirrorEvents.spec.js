import test from "ava";
import { join } from "path";
import { EventEmitter } from "events";
import { mkdir, rmdir, writeFile } from "fs/promises";
import simpleGit from "simple-git";
import Loki from "lokijs";
import sinon from "sinon";
import { buildMirrors, updateMirror } from "../mirrors.js";
import {
  mirrorStateChanges,
  streamOfChangedAndRemoved,
} from "../mirrorChanges.js";

const MOCK_REPO = "/data/mock/repo-jobGraph";
const { LokiMemoryAdapter } = Loki;
const db = new Loki("sandbox.db", { adapter: new LokiMemoryAdapter() });
const logger = { info: sinon.spy(), error: sinon.spy(), debug: sinon.spy() };
const context = {
  dataPath: "/data/jobBuildGraph",
  jobRepo: MOCK_REPO,
  watchedRepos: [],
  logger,
  db,
  emitter: new EventEmitter(),
};

test.before(async () => {
  await rmdir(MOCK_REPO, { recursive: true });
  await mkdir(MOCK_REPO, { recursive: true });
  await Promise.all([
    writeFile(join(MOCK_REPO, "dmakr.prepare.sh"), "sleep .5 && ls -la"),
    writeFile(join(MOCK_REPO, "dmakr.automatic.sh"), 'echo "CD ftw"'),
    writeFile(join(MOCK_REPO, "README"), "TEST"),
  ]);
});

test("New commits should fire 'prepare' events", async (t) => {
  const commitIds = new Map();
  const remote = simpleGit(MOCK_REPO);
  await remote
    .init()
    .addConfig("user.name", "Some One")
    .addConfig("user.email", "some@one.com");

  const mirrors = await buildMirrors(context);
  const jobStream = streamOfChangedAndRemoved(
    mirrorStateChanges(mirrors, context).guard,
    context
  )
    .take(2)
    .bufferWhile();
  const expectedEvents = () => [
    {
      type: "changed",
      commit: {
        branch: "master",
        message: "add jobs",
        commitId: commitIds.get("first"),
        tags: [],
      },
      gitId: {
        id: "guard.jobs",
        url: "/data/jobBuildGraph/.mirrors/jobs",
      },
    },
    {
      type: "changed",
      commit: {
        branch: "master",
        message: "add readme",
        commitId: commitIds.get("second"),
        tags: [],
      },
      gitId: {
        id: "guard.jobs",
        url: "/data/jobBuildGraph/.mirrors/jobs",
      },
    },
  ];
  const sub = jobStream.observe((x) => {
    // console.log(commitIds);
    t.deepEqual(x, expectedEvents());
  });

  /* Over time
    source:      ---1---2----
    mirror:      ----1---2---
    repoEvent:   ----p1--p2---
  */

  await updateMirror(mirrors.guard, context);

  const co = await remote.add("dmakr*").commit("add jobs");
  commitIds.set("first", co.commit);
  await updateMirror(mirrors.guard, context);

  const co2 = await remote.add("README").commit("add readme");
  commitIds.set("second", co2.commit);
  const response = jobStream.toPromise();
  await updateMirror(mirrors.guard, context);
  return response.then(sub.unsubscribe);
});
