import logger from "loglevel";
import dotenv from "dotenv";
import path, { join } from "path";
import { pathToFileURL } from "url";
import lokiAdapter from "./jobStates/lokiAdapter.js";
/** @typedef {import("./typedefs").Logger} Logger */
/** @typedef {import("./typedefs").Context} Context */
/** @typedef {import("./typedefs").Credentials} Credentials */
/** @typedef {import("./typedefs").WatchedRepos} WatchedRepos */

dotenv.config();

logger.setLevel(
  process.env.NODE_ENV === "production"
    ? logger.levels.WARN
    : logger.levels.TRACE
);
export { logger };

const buildDataPath = (env) => path.resolve(env.DATA_PATH || ".dmakr");

const buildRepoUrl = (urlSource, id) => {
  let url;
  try {
    try {
      url = new URL(urlSource);
    } catch (err) {
      url = pathToFileURL(path.resolve(urlSource));
    }
  } catch (err) {
    throw new Error(`[config] Check your git repo configuration for ${id}`);
  }
  return url.toString();
};

/**
 * @param {Object<string, string>} env
 * @returns {Promise<lokiAdapter>}
 */
export const databaseInitialize = (env) =>
  new Promise((resolve, reject) => {
    const db = lokiAdapter(join(buildDataPath(env), "dmakr.db.json"), {});
    db.loadDb({}, (err) => {
      if (err) reject(err);
      resolve(db);
    });
  });

/**
 * @param {Object|string} opts
 * @returns {Credentials | undefined}
 */
const buildCredentials = (opts) => {
  try {
    const jsonCreds = typeof opts === "string" ? JSON.parse(opts) : opts;
    return Object.keys(jsonCreds)
      .filter((key) => key === "user" || key === "pass")
      .reduce(
        (prev, key) => ({
          ...prev,
          [key]: encodeURI(jsonCreds[key]),
        }),
        {}
      );
  } catch {
    return undefined;
  }
};

/**
 * @param {Object|string} opts
 * @returns {Credentials | undefined}
 */
const buildOptions = (opts) => {
  try {
    const jsonOpts = typeof opts === "string" ? JSON.parse(opts) : opts;
    return Object.keys(jsonOpts)
      .filter((key) => !(key === "user" || key === "pass"))
      .reduce(
        (prev, key) => ({
          ...prev,
          [key]: jsonOpts[key].split(",").map((x) => x.trim()),
        }),
        {}
      );
  } catch {
    return {};
  }
};

/**
 *
 * @param {Object.<string, string>} env
 * @param {Logger} log
 * @returns {WatchedRepos[]}
 */
const buildWatched = (env, log = logger) => {
  if (!env.WATCHED_REPOS) {
    log.error("[config] Skip Watched-Repos due to missing configuration.");
    return [];
  }
  try {
    const watchedRepos = JSON.parse(env.WATCHED_REPOS);
    const watchedOptions = JSON.parse(env.WATCHED_REPOS_OPTIONS || "{}");
    return Object.keys(watchedRepos).map((key) => ({
      id: key,
      url: buildRepoUrl(watchedRepos[key], key),
      credentials: buildCredentials(watchedOptions[key]),
      options: buildOptions(watchedOptions[key]),
    }));
  } catch (err) {
    log.error("[config] Error in WATCHED_REPOS* configuration found.");
    log.debug(err);
    throw err;
  }
};

/**
 * @param {Object.<string, string>} env
 * @returns {Context}
 */
export const gitContext = (env) => ({
  logger: env.logger || logger,
  intervalJobs: env.INTERVAL_JOBS * 1000 || 20000,
  intervalWatched: env.INTERVAL_WATCHED * 1000 || 30000,
  dataPath: buildDataPath(env),
  jobRepo: buildRepoUrl(env.JOBS_REPO, "jobs"),
  jobRepoOptions: buildOptions(env.JOBS_REPO_OPTIONS),
  credentials: buildCredentials(env.JOBS_REPO_OPTIONS),
  watchedRepos: buildWatched(env, env.logger),
  db: env.db,
});
