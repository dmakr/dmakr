/* eslint-disable no-restricted-syntax */
import kefir from "kefir";
import { exec } from "child_process";
import { resolve } from "path";
import { readdir } from "fs/promises";
import { cloneWorkspace } from "../gitRepos/mirrors.js";
import { modifyJobState } from "../jobStates/jobState.js";

const getJobFile = async (dir, id, jobType) => {
  const dirEntries = await readdir(dir, { withFileTypes: true });
  for (const dirEntry of dirEntries) {
    const res = resolve(dir, dirEntry.name);

    if (dirEntry.isDirectory() && dirEntry.name.match(/.*dmakr.*/i)) {
      getJobFile(res, jobType);
    } else if (dirEntry.name === `${id}.${jobType}.sh`) {
      return res;
    } else if (dirEntry.name === `dmakr.${jobType}.sh`) {
      return res;
    }
  }
  return "";
};
export const JOB_PREPARE = "prepare";
export const JOB_AUTOMATIC = "automatic";

//     "docker",
//     `docker run -e REPO="myVar" --rm --volumes-from $(hostname) citool/node-git:14-alpine sh env.sh`,

/**
 * @param  {import("../typedefs").Context} ctx
 * @param {import("../typedefs.js").MirrorId} gitId Git Mirror Id Object
 */
export const agentRunner = (ctx, gitId) => (job) =>
  kefir
    .fromPromise(
      modifyJobState(ctx, {
        gitId,
        commitId: job.commit.commitId,
        branch: job.commit.branch,
        job: job.type,
        status: "running",
      })
        .then(() => cloneWorkspace(ctx, job))
        .then((ws) => getJobFile(ws, gitId.id, job.type))
    )
    .flatMap((execFile) => {
      return kefir.stream((stream) => {
        const { id } = gitId;
        if (execFile === "" && id.startsWith("watched.")) {
          modifyJobState(ctx, {
            gitId,
            commitId: job.commit.commitId,
            branch: job.commit.branch,
            job: job.type,
            status: "forward",
          }).finally(() => {
            stream.end();
          });
        } else if (execFile === "" && job.type === JOB_AUTOMATIC) {
          modifyJobState(ctx, {
            gitId,
            commitId: job.commit.commitId,
            branch: job.commit.branch,
            job: job.type,
            status: "finished:skipped",
          })
            .catch(stream.error)
            .finally(() => {
              stream.end();
            });
        } else {
          const agent = exec(`. ${execFile}`, {
            env: { ...job.gitId, ...job.commit },
          });
          agent.stdout.on("data", (x) => {
            stream.emit({ id, type: "stdout", payload: x });
          });
          agent.stderr.on("data", (x) => {
            stream.emit({ id, type: "stderr", payload: x });
          });
          agent.on("close", (code) => {
            modifyJobState(ctx, {
              gitId,
              commitId: job.commit.commitId,
              branch: job.commit.branch,
              job: job.type,
              status: code === 0 ? "finished" : "error",
            })
              .then(() => {
                stream.emit({
                  id,
                  type: code === 0 ? "success" : "error",
                  job,
                });
              })
              .catch(stream.error)
              .finally(() => {
                stream.end();
              });
          });
        }
      });
    });
