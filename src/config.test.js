import test from "ava";
import sinon from "sinon";
import dotenv from "dotenv";
import { gitContext, logger } from "./config.js";

test("Env vars for git with WATCHED_REPOS", (t) => {
  const env = dotenv.parse`
    WATCHED_REPOS={"app": "https://mygit.test/app", "api": "git://example.com/api"}
    WATCHED_REPOS_CREDENTIALS={"app": {"user": "achmet", "pass": "dsjshu#+"}, "api": {"user": "doris", "pass": "dshf745jshu$Ä"}}
    JOBS_REPO="https://mygit.test/jobs"
    JOBS_REPO_CREDENTIALS={"user": "michael", "pass": "dshf745jshu$%"}
  `;
  // logger.debug(env);
  t.like(
    gitContext(env),

    {
      logger,
      dataPath: `${process.cwd()}/.dmakr`,
      jobRepo: "https://mygit.test/jobs",
      credentials: { user: "michael", pass: "dshf745jshu$%25" },
      watchedRepos: [
        {
          id: "app",
          url: "https://mygit.test/app",
          credentials: { user: "achmet", pass: "dsjshu#+" },
        },
        {
          id: "api",
          url: "git://example.com/api",
          credentials: { user: "doris", pass: "dshf745jshu$%C3%84" },
        },
      ],
    }
  );
});

test("Env vars only for JOBS without WATCHED_REPOS", (t) => {
  const env = dotenv.parse`
    JOBS_REPO="https://mygit.test/jobs"
    JOBS_REPO_CREDENTIALS={"user": "michael", "pass": "dshf745jshu$%"}
  `;
  env.logger = { error: sinon.spy() };
  t.like(
    gitContext(env),

    {
      jobRepo: "https://mygit.test/jobs",
      credentials: { user: "michael", pass: "dshf745jshu$%25" },
      watchedRepos: [],
    }
  );
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
    WATCHED_REPOS_CREDENTIALS={"app": {"user": "achmet", "pass": "dsjshu#+"}, "api": {"user": "doris", "pass": "dshf745jshu$Ä"}}
    JOBS_REPO="https://mygit.test/jobs"
    JOBS_REPO_CREDENTIALS={"user": "michael", "pass": "dshf745jshu$%"}
  `;
  env.logger = { debug: sinon.spy(), error: sinon.spy() };
  t.throws(() => gitContext(env));
});

test("Corrupted WATCHED_REPOS_CREDENTIALS throws error", (t) => {
  const env = dotenv.parse`
    WATCHED_REPOS={"app": "https://mygit.test/app"}
    WATCHED_REPOS_CREDENTIALS={"app": {"user": "achmet"
    JOBS_REPO="https://mygit.test/jobs"
    JOBS_REPO_CREDENTIALS={"user": "michael", "pass": "dshf745jshu$%"}
  `;
  env.logger = { debug: sinon.spy(), error: sinon.spy() };
  t.throws(() => gitContext(env));
});

test("Should work without WATCHED_REPOS_CREDENTIALS", (t) => {
  const env = dotenv.parse`
    WATCHED_REPOS={"app": "https://mygit.test/app"}
    JOBS_REPO="https://mygit.test/jobs"
    JOBS_REPO_CREDENTIALS={"user": "michael", "pass": "dshf745jshu$%"}
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
        },
      ],
    }
  );
});