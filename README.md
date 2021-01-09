# DMAKR

Dmakr´s main functionality is the automated synchronization between remote git repositories and local mirrors to detect changes. Think of it as an on premise workflow automation helper.

It works where webhooks fail. No matter if you manage one repo or many dependent ones. You get control of your workflow and a version management on top of that. Linux shell scripts are the basis for the workflow and so IDE supported and testable.

```nodejs
/*
agents                e  e                        e  e
guardEvent     -c-----p--a----------------ci------pi-a---
                \    /                   /  \    /
watchedEvent   --pi-a-------------c--p--a----------------
watchedEvent   --pi-a------------------------pi-a--------
agents           e  e                e  e   [e][e]

c = changed | p = prepare | a = automatic | i = indirectly | e = exec
*/
```

There are complex scenarios possible in a multi repository dmakr project, but the default behavior should be the logical outcome. Please just experience and explore it.

## Usage

### Docker Examples

```shell
docker run --rm -e "JOBS_REPO=https://github.com/dmakr/self-changing.git" dmakr/dmakr
```

```shell
docker run --rm -e "JOBS_REPO=https://github.com/dmakr/job-demo.git" -e 'WATCHED_REPOS={"service": "https://github.com/mazehall/self-changing.git"}'  -v /root/mockRepos:/mockRepos --name=dmakr-project dmakr/dmakr
```

```shell
docker run --rm -e "JOBS_REPO=../mockRepos/first" -e 'WATCHED_REPOS={"app": "https://github.com/mazehall/self-changing.git"}'  -v /root/mockRepos:/mockRepos --name=dmakr-test dmakr/dmakr
```

```shell
docker run -v /var/run/docker.sock:/var/run/docker.sock -v <dmakrVolume>:/app/.dmakr -v /path/to/.env:/app/.env --rm -it dmakr/dmakr
```

## Features

- Polls from a set of git repositories to detect changes
- Detects jobs in all repos with fallback to the special JOBS repo
- Handles 2 job stages: _prepare_ -> _automatic_
- automatic runs only on branch head commit, unless you force it

Dmakr searches for file name patterns and, if successful, starts the file as a shell script. Filenames are found in the following order: `<jobId>.<jobType>.sh`, `dmakr.<jobType>.sh`.

Starting from the working directory, the search continues in depth if the directory name contains the pattern "dmakr" (case insensitive). The first hit ends the search. So don't make it complicated!

Examples for files:

```bash
./dmakr.prepare.sh
./guard.jobs.prepare.sh
./guard.jobs.automatic.sh
./watched.api.prepare.sh
./watched.api.automatic.sh
./jobsDmakr/watched.app.prepare.sh
./jobsDmakr/watched.app.automatic.sh
```

The pattern `dmakr` or `guard.jobs` is the minimum required job prefix, because the `JOBS_REPO` is the matching git repository and you need at least one. File names are case-sensitive and are expected to be written in lower case.

| config repo | jobId               | examples                                           |
| ----------- | ------------------- | -------------------------------------------------- |
| JOBS        | guard.jobs          | `guard.jobs.prepare.sh, dmakr.prepare.sh`          |
| WATCHED     | watched.\<jobType\> | `watched.api.prepare.sh, watched.app.automatic.sh` |

## Configuration

There are several ways to configure the credentials of the Git repositories. It is recommended to use the preferred variant of the runtime system. Note that when using XXX_REPO_OPTIONS for these configurable environment variables, it will be added to the URL.

Please use the secrets system of your context, a password store or [git credential store.](https://git-scm.com/docs/git-credential-store)

| Key                   | Default                       | Description                                                                                                                                                                                                                                                  |
| --------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DATA_PATH             | `.dmakr`                      | Entry directory for all write accesses like: mirror repositories, status database and job workspaces                                                                                                                                                         |
| INTERVAL_JOBS         | 30                            | JOBS_REPOS polling interval in seconds                                                                                                                                                                                                                       |
| INTERVAL_WATCHED      | 40                            | WATCHED_REPOS polling interval in seconds                                                                                                                                                                                                                    |
| JOBS_REPO             |                               | **[required]** Url or local path that points to a git repository with dmakr job definitions as shell script file; Example: `https://github.com/dmakr/job-demo.git`                                                                                           |
| JOBS_REPO_OPTIONS     | [Repo Options](#repo-options) | Repo options as JSON string: `{"user": "max.tester", "pass": "1d85559f9f29843e39f77da81d736a9f"}`                                                                                                                                                            |
| WATCHED_REPOS         |                               | One or more Urls or local paths that points to git repositories as serialized JSON string; Example:`{"app": "../mockRepos/first", "service": "https://bitbucket.org/dmakr/gql-core.git"}`                                                                    |
| WATCHED_REPOS_OPTIONS | [Repo Options](#repo-options) | Repo options per key as JSON string: `{"app": {"user": "max.tester", "pass": "77da8Wk29843e377da8Wks3Ua9f"}, "service": {"user": "jklahn", "pass": "Dx4g7nq85551s3U7t6W", "defaultBranch": "production", "branchFilter": "main,master,feature/,release/" }}` |

### Repo Options

Important to know: if you configure the multi-repo mode, some logical inheritance takes effect.

The configured branch filter for the WATCHED repos are combined and mixed with the eventual special branches of the JOB repo. This is necessary because suitable job files are also searched for in the JOB repo, they might even be exclusively maintained there.

| Option        | Default                                                | Description                                                                                                   |
| ------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| user          |                                                        | git repo username                                                                                             |
| pass          |                                                        | git repo password or token                                                                                    |
| defaultBranch | ["main", "master"]                                     | The main brach of the repo. You can configure serveral in a comma seperated list to manage transition phases. |
| branchFilter  | ["master", "main","feature/","release/","production",] | All relevant branches starts with this pattern.                                                               |

## Development

### Design Decisions

- Support container runtime environment
- Node.js without transpilers
- Native ESM Syntax
- JSdoc type descriptions
- Not another YAML syntax

### DevEnv

Setup eslint checks as commit hook with:

```
npm i && npx husky install
```

Unit tests:

```shell
docker run -v $PWD:/app -w /app --rm -it citool/node-git:14-alpine npm run test
```

Integration tests:

```shell
docker run -v $PWD:/app -w /app --rm -it citool/node-git:14-alpine npm run itest -- --watch
```
