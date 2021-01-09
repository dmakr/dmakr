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
    } else if (dirEntry.name === `${id}.${jobType.split(":")[0]}.sh`) {
      return res;
    }
  }
  return "";
};
export const JOB_PREPARE = "prepare";
export const JOB_AUTOMATIC = "automatic";

/**
 * @param  {import("../typedefs").Context} ctx
 * @param {import("../typedefs.js").MirrorId} gitId Git Mirror Id Object
 */
export const forwardRunner = (ctx) => (job) =>
  kefir
    .fromPromise(
      modifyJobState(ctx, {
        gitId: job.source.gitId,
        commitId: job.source.commitId,
        branch: job.source.branch,
        job: `${job.type}:forward`,
        status: "running",
      })
        .then(() => cloneWorkspace(ctx, job))
        .then((ws) => getJobFile(ws, job.source.gitId.id, job.type))
    )
    .flatMap((execFile) => {
      return kefir.stream((stream) => {
        const { id } = job.source.gitId;
        if (execFile === "" && job.type === JOB_AUTOMATIC) {
          modifyJobState(ctx, {
            gitId: job.source.gitId,
            commitId: job.source.commitId,
            branch: job.source.branch,
            job: `${job.type}:forward`,
            status: "finished:noJobFile",
          })
            .catch(stream.error)
            .finally(() => {
              stream.end();
            });
        } else {
          const agent = exec(`. ${execFile}`, {
            env: {
              ...job.gitId,
              ...job.commit,
              "source.commit": job.source.commitId,
              "source.branch": job.source.branch,
            },
          });
          agent.stdout.on("data", (x) => {
            stream.emit({
              id,
              commitId: job.commit.commitId,
              branch: job.commit.branch,
              job: `${job.type}`,
              type: "stdout",
              payload: x,
            });
          });
          agent.stderr.on("data", (x) => {
            stream.emit({
              id,
              commitId: job.commit.commitId,
              branch: job.commit.branch,
              job: `${job.type}`,
              type: "stderr",
              payload: x,
            });
          });
          agent.on("close", (code) => {
            modifyJobState(ctx, {
              gitId: job.source.gitId,
              commitId: job.source.commitId,
              branch: job.source.branch,
              job: `${job.type}:forward`,
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
