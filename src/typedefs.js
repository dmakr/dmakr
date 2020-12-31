/**
 * @typedef {Object} Logger
 * @property {function(string):string} info
 * @property {function(string):string} error
 * @property {function(string):string} debug
 */
/**
 * @typedef {Object} WatchedRepos
 * @property {string} id
 * @property {string} url
 * @property {Credentials} credentials
 */
/**
 * @typedef {Object} MirrorId
 * @property {string} id
 * @property {string} url
 */
/**
 * @typedef {Object} MirrorIds
 * @property {MirrorId} guard
 * @property {Object.<string, MirrorId} watched
 */
/**
 * @typedef {Object} MirrorUpdateStreams
 * @property {import("kefir").Stream} guard
 * @property {Object.<string, import("kefir").Stream} watched
 */
/**
 * @typedef {Object} CommitInfo
 * @property {string} branch
 * @property {string} commitId
 * @property {string} message
 * @property {string[]} tags
 */
/**
 * @typedef {Object} BranchHeads
 * @property {MirrorId} gitId
 * @property {CommitInfo[]} heads
 */
/**
 * @typedef {Object} Credentials
 * @property {string} user
 * @property {string} pass
 */
/**
 * @typedef {Object} PersistenceAdapter
 * @property {Function} loadDb
 * @property {Function} getByCommit
 * @property {Function} setByCommit
 */
/**
 * @typedef {Object} Context
 * @property {string} dataPath
 * @property {string} intervalJobs
 * @property {string} intervalWatched
 * @property {string} jobRepo
 * @property {Credentials} credentials
 * @property {WatchedRepos[]} watchedRepos
 * @property {EventEmitter} emitter
 * @property {Logger} logger
 * @property {PersistenceAdapter} db
 */
/**
 * @typedef {Object} ModifyJobState
 * @property {MirrorId} gitId
 * @property {string} commitId
 * @property {string} branch
 * @property {string} job
 * @property {string} status
 */
/**
 * @typedef {Object} JobEvent
 * @property {string} type
 * @property {MirrorId} gitId
 * @property {CommitInfo} commit
 * @property {ModifyJobState} [source]
 */
/**
 * @typedef {Object} JobStateChanged
 * @property {ModifyJobState} trigger
 * @property {Object} state
 */
export {};
