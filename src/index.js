import { EventEmitter } from "events";
import {
  buildMirrors,
  startMirrorsUpdates,
  stopMirrorsUpdates,
} from "./gitRepos/mirrors.js";
import { databaseInitialize, gitContext, logger } from "./config.js";
import jobRules from "./jobs/rules.js";

let mirrors = {};
let db = { close: () => {} };
let context = {};

const init = async () => {
  // logger.debug(process.env);
  db = await databaseInitialize(process.env);
  context = {
    ...gitContext(process.env),
    db,
    emitter: new EventEmitter(),
  };
  mirrors = await buildMirrors(context);
};

const main = async () => {
  jobRules(context, mirrors);
  startMirrorsUpdates(context, mirrors);
};

init()
  .then(main)
  .then(() => {
    // stopMirrorsUpdates(mirrors);
    db.close();
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });

// Respond to 'Ctrl+C'
process.on("SIGINT", () => {
  stopMirrorsUpdates(mirrors);
  db.close();
  process.exit(0);
});
// shutting down
process.on("SIGTERM", () => {
  stopMirrorsUpdates(mirrors);
  db.close();
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  logger.error("Termination due to an uncaught exception!");
  logger.error(err);
  process.exit(1);
});
