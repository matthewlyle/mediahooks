---
name: work-issue
description: Fanning mediahooks GitHub issues out to herdr worker agents, one worktree and PR per issue.
---

# Working issues with herdr workers

One issue, one worktree, one omp agent, one PR. Follows AGENTS.md: branch `issue-<n>-<slug>`, PR
title is a Conventional Commit, body says `Fixes #<n>`, never merge.

## Launch a worker

```sh
herdr worktree create --cwd ~/src/mediahooks --branch issue-<n>-<slug> --base main --no-focus
herdr agent start issue-<n> --kind omp --pane <root pane from the create response>
herdr agent prompt issue-<n> "<prompt below>"
```

Port: `88` + the issue number zero-padded to two digits (issue 4 → 8804). Never 8788 (dev) or 8787
(production).

## Worker prompt

Fill `{N}`, `{BRANCH}`, `{PORT}`:

```
Fix GitHub issue #{N} in matthewlyle/mediahooks: `gh issue view {N} -R matthewlyle/mediahooks`. The issue body is the spec; its success criteria are your acceptance test. Follow AGENTS.md.

- You're in your own worktree on branch `{BRANCH}`. Run `bun install` first.
- Run the dev server only as `AUTH=off PORT={PORT} bun --hot src/server.ts` (never `bun run dev`; port 8788 belongs to someone else).
- Reproduce the problem in a browser first, then fix it, then re-check every success-criteria item in the browser.
- Run `bun test` and `bun run typecheck`; both must pass.
- Stay within this issue. Don't touch other issues' code or `CHANGELOG.md`.
- Commit with a Conventional Commit message, with `Fixes #{N}` in the body.
- You're explicitly asked to push `{BRANCH}` to origin and open a pull request: title is the Conventional Commit, body says `Fixes #{N}` and how each success criterion was verified. Never merge it.
- Finish with a short report: what you changed, the PR URL, and how each success criterion was verified.
```

## After workers finish

Review each PR (a reviewer agent pass is fine); the user merges. Remove the worktree with
`herdr worktree remove` once its PR is merged.
