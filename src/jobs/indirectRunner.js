/* eslint-disable no-restricted-syntax */
import kefir from "kefir";
import { exec } from "child_process";
import { resolve } from "path";
import { readdir } from "fs/promises";
import { cloneWorkspace } from "../gitRepos/mirrors.js";
import {
  finishIndirectlyRunner,
  modifyJobState,
  registerIndirectlyRunner,
} from "../jobStates/jobState.js";
/** @typedef {import("../typedefs").Context} Context */
/** @typedef {import("../typedefs").JobEvent} JobEvent */

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

/**
 * @param  {Context} ctx
 * @returns {(JobEvent) => import("kefir").Stream }
 */
const indirectRunner = (ctx) =>
  /**
   * @param {JobEvent} job
   */
  (job) =>
    kefir
      .fromPromise(
        modifyJobState(ctx, {
          gitId: job.parent.gitId,
          commitId: job.parent.commit.commitId,
          branch: job.parent.commit.branch,
          job: job.parent.type,
          status: "running",
        })
          .then(() =>
            modifyJobState(ctx, {
              gitId: job.gitId,
              commitId: job.commit.commitId,
              branch: job.commit.branch,
              job: job.type,
              status: "running",
            })
          )
          .then(() => cloneWorkspace(ctx, job))
          .then(async (ws) => {
            await registerIndirectlyRunner(ctx, job, ws);
            return ws;
          })
          .then((ws) => ({
            ws,
            execFile: getJobFile(ws, job.gitId.id, job.type),
          }))
      )
      .flatMap(({ ws, execFile }) => {
        return kefir.stream((stream) => {
          const { id } = job.gitId;
          if (execFile === "") {
            modifyJobState(ctx, {
              gitId: job.gitId,
              commitId: job.commit.commitId,
              branch: job.commit.branch,
              job: job.type,
              status: "forward",
            }).finally(() => {
              stream.end();
            });
          } else {
            const agent = exec(`. ${execFile}`, {
              env: {
                ...job.gitId,
                ...job.commit,
                ws,
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
              // modifyJobState(ctx, {
              //   gitId: job.parent.gitId,
              //   commitId: job.parent.commitId,
              //   branch: job.parent.branch,
              //   job: job.parent.type,
              //   status: code === 0 ? "finished" : "error",
              // })
              finishIndirectlyRunner(ctx, job)
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

export default indirectRunner;
