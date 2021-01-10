import test from "ava";
import sinon from "sinon";
import dotenv from "dotenv";
import { gitContext, logger } from "./config.js";

test("Env vars mapping", (t) => {
  const env = dotenv.parse`
    DATA_PATH="config"
    WATCHED_REPOS={"app": "https://mygit.test/app", "api": "git://example.com/api"}
    WATCHED_REPOS_OPTIONS={"app": {"user": "achmet", "pass": "dsjshu#+", "branchFilter": "main, feature,dev"}, "api": {"defaultBranch": "test", "user": "doris", "pass": "dshf745jshu$Ä"}}
    JOBS_REPO="https://mygit.test/jobs"
    JOBS_REPO_OPTIONS={"user": "michael", "pass": "dshf745jshu$%"}
  `;
  // logger.debug(env);
  t.like(
    gitContext(env),

    {
      logger,
      dataPath: `${process.cwd()}/config`,
      jobRepo: "https://mygit.test/jobs",
      credentials: { user: "michael", pass: "dshf745jshu$%25" },
      jobRepoOptions: {
        defaultBranch: ["main", "master"],
        branchFilter: ["master", "main", "feature/", "release/", "production"],
        interval: 30000,
      },
      ruleOptions: {
        "guard.jobs": {
          defaultBranch: ["main", "master"],
          branchFilter: [
            "master",
            "main",
            "feature/",
            "release/",
            "production",
            "feature",
            "dev",
          ],
        },
        "watched.app": {
          defaultBranch: ["main", "master"],
          branchFilter: ["main", "feature", "dev"],
        },
        "watched.api": {
          defaultBranch: ["test"],
          branchFilter: [
            "master",
            "main",
            "feature/",
            "release/",
            "production",
          ],
        },
      },
      watchedRepos: [
        {
          id: "app",
          url: "https://mygit.test/app",
          credentials: { user: "achmet", pass: "dsjshu#+" },
          options: {
            interval: 40000,
            branchFilter: ["main", "feature", "dev"],
            defaultBranch: ["main", "master"],
          },
        },
        {
          id: "api",
          url: "git://example.com/api",
          credentials: { user: "doris", pass: "dshf745jshu$%C3%84" },
          options: {
            interval: 40000,
            branchFilter: [
              "master",
              "main",
              "feature/",
              "release/",
              "production",
            ],
            defaultBranch: ["test"],
          },
        },
      ],
    }
  );
});

test("Env vars only for JOBS without WATCHED_REPOS", (t) => {
  const env = dotenv.parse`
    JOBS_REPO="https://mygit.test/jobs"
    JOBS_REPO_OPTIONS={"interval": 30, "user": "michael", "pass": "dshf745jshu$%", "defaultBranch": "test"}
  `;
  env.logger = { error: sinon.spy() };
  t.like(gitContext(env), {
    jobRepo: "https://mygit.test/jobs",
    credentials: { user: "michael", pass: "dshf745jshu$%25" },
    watchedRepos: [],
    jobRepoOptions: { defaultBranch: ["test"], interval: 30000 },
  });
});

test("Throws error if required JOBS repo is missing", (t) => {
  const env = dotenv.parse`
  `;
  env.logger = { debug: sinon.spy(), error: sinon.spy() };
  t.throws(() => gitContext(env));
});

test("Corrupted WATCHED_REPOS throws error", (t) => {
  const env = dotenv.parse`
    WATCHED_REPOS={"app": "https://mygit.test/app}
    WATCHED_REPOS_OPTIONS={"app": {"user": "achmet", "pass": "dsjshu#+"}, "api": {"user": "doris", "pass": "dshf745jshu$Ä"}}
    JOBS_REPO="https://mygit.test/jobs"
    JOBS_REPO_OPTIONS={"user": "michael", "pass": "dshf745jshu$%"}
  `;
  env.logger = { debug: sinon.spy(), error: sinon.spy() };
  t.throws(() => gitContext(env));
});

test("Corrupted WATCHED_REPOS_OPTIONS throws error", (t) => {
  const env = dotenv.parse`
    WATCHED_REPOS={"app": "https://mygit.test/app"}
    WATCHED_REPOS_OPTIONS={"app": {"user": "achmet"
    JOBS_REPO="https://mygit.test/jobs"
    JOBS_REPO_OPTIONS={"user": "michael", "pass": "dshf745jshu$%"}
  `;
  env.logger = { debug: sinon.spy(), error: sinon.spy() };
  t.throws(() => gitContext(env));
});

test("Should work without WATCHED credentials", (t) => {
  const env = dotenv.parse`
    WATCHED_REPOS={"app": "https://mygit.test/app"}
    JOBS_REPO="https://mygit.test/jobs"
    JOBS_REPO_OPTIONS={"user": "michael", "pass": "dshf745jshu$%"}
  `;
  env.logger = { debug: sinon.spy(), error: sinon.spy() };
  t.like(
    gitContext(env),

    {
      dataPath: `${process.cwd()}/.dmakr`,
      jobRepo: "https://mygit.test/jobs",
      credentials: { user: "michael", pass: "dshf745jshu$%25" },
      watchedRepos: [
        {
          id: "app",
          url: "https://mygit.test/app",
          credentials: undefined,
          options: {
            defaultBranch: ["main", "master"],
            interval: 40000,
            branchFilter: [
              "master",
              "main",
              "feature/",
              "release/",
              "production",
            ],
          },
        },
      ],
    }
  );
});
