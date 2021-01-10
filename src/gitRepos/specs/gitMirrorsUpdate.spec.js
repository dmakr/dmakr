/* eslint-disable no-param-reassign */
import test from "ava";
import { join } from "path";
import { EventEmitter } from "events";
import { mkdirSync, rmdirSync } from "fs";
import { writeFile } from "fs/promises";
import simpleGit from "simple-git";
import Loki from "lokijs";
import sinon from "sinon";
import { buildMirrors, updateMirror } from "../mirrors.js";
import { subscribeRepo } from "../mirrorChanges.js";
import { gitContext } from "../../config.js";

const REPO_REMOTE = "/data/test/start-repo";
const DATA_PATH = "/data/updateSpec";
const { LokiMemoryAdapter } = Loki;
const db = new Loki("sandbox.db", { adapter: new LokiMemoryAdapter() });
const context = {
  ...gitContext({
    JOBS_REPO: REPO_REMOTE,
    logger: { info: sinon.spy(), error: sinon.spy(), debug: sinon.spy() },
    db,
  }),
  dataPath: DATA_PATH,
  emitter: new EventEmitter(),
};

test.before(async (t) => {
  rmdirSync(REPO_REMOTE, { recursive: true });
  mkdirSync(REPO_REMOTE, { recursive: true });
  rmdirSync(DATA_PATH, { recursive: true });
  mkdirSync(join(DATA_PATH), { recursive: true });
  t.context.remote = simpleGit(REPO_REMOTE);
  await t.context.remote
    .init()
    .addConfig("user.name", "Some One")
    .addConfig("user.email", "some@one.com");

  t.context.MirrorIds = await buildMirrors(context);
  t.context.update = simpleGit(t.context.MirrorIds.guard.url);
  await Promise.all([
    writeFile(join(REPO_REMOTE, "file1.txt"), "file1"),
    writeFile(join(REPO_REMOTE, "file2.txt"), "file2"),
  ]);
  t.context.guard = subscribeRepo(context, t.context.MirrorIds.guard);
});

test.serial("Updating new commits from remote", async (t) => {
  const { update, remote } = t.context;
  await remote.add("file1.txt").commit("initial");
  t.plan(2);
  const subscription = t.context.guard.skip(1).observe({
    value(value) {
      t.like(value.heads[0], { branch: "master" });
    },
  });
  await updateMirror(t.context.MirrorIds.guard, context);
  const first = await update.log();
  t.like(first, { total: 1, latest: { message: "initial" } });
  subscription.unsubscribe();
});

test.serial("Updating new branches from remote", async (t) => {
  const { update, remote } = t.context;
  await remote
    .checkoutBranch("feature/foo", "master")
    .add("file2.txt")
    .commit("foo stuff");
  await updateMirror(t.context.MirrorIds.guard, context);
  const refs = await update.branch();
  t.like(refs, { all: ["feature/foo", "master"] });
});

test.serial("Updating new tags from remote", async (t) => {
  const { update, remote } = t.context;
  await remote.addTag("v1.0.0");
  t.plan(2);
  const subscription = t.context.guard.observe({
    value(value) {
      t.like(value.heads[0], { tags: ["v1.0.0"] });
    },
  });
  await updateMirror(t.context.MirrorIds.guard, context);
  const { all } = await update.tags();
  t.true(all.includes("v1.0.0"));
  subscription.unsubscribe();
});
