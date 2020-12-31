import Loki from "lokijs";

/**
 * @param {Loki} db Persistence Layer object
 * @param {string} repo Unique identifier of the collection (dmakr internal git repo Id)
 * @returns {Collection}
 */
const getCollection = (db, repo) =>
  db.getCollection(repo) || db.addCollection(repo, { unique: ["commitId"] });

/**
 * @typedef {Object} DmakrCommitState
 * @property {string} commitId
 * @property {Object} jobs
 */
/**
 * Fetch a new initial or persisted version of DmakrCommitState
 * @param {Collection} coll Persistence collection object
 * @param {string} commitId Unique identifier (shortened git Id)
 * @returns {DmakrCommitState}
 */
const getByCommitFn = (db) => (collName, commitId) =>
  getCollection(db, collName).by("commitId", commitId) ?? { commitId };

/**
 * Set and persist a DmakrCommitState
 * @param {Loki} db Db collection for a git repository
 * @param {Collection} coll Db collection for a git repository
 * @param {string} commitId
 * @param {Object} doc
 */
const setByCommitFn = (db) => async (collName, commitId, doc) => {
  const coll = getCollection(db, collName);
  const exists = coll.findOne({ commitId });
  if (exists) {
    coll.update(doc);
  } else {
    coll.insert(doc);
  }
  return new Promise((resolve, reject) => {
    db.save((err) => {
      if (err) reject(err);
      resolve();
    });
  });
};

/**
 * @returns {import("../typedefs").PersistenceAdapter}
 */
export default (dbName, options) => {
  const db = new Loki(dbName, options ?? {});
  return {
    close: () => db.close(),
    loadDb: (opt, cb) => db.loadDatabase(opt, cb),
    getByCommit: getByCommitFn(db),
    setByCommit: setByCommitFn(db),
  };
};
