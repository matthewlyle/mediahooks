---
name: work-issue
description: Fanning mediahooks GitHub issues out to herdr worker agents, one worktree and PR per issue.
---

# Working issues with herdr workers

One issue, one worktree, one omp agent, one PR. Follows AGENTS.md: branch `issue-<n>-<slug>`, PR
title is a Conventional Commit, body says `Fixes #<n>`. Workers never merge; only the review step
below may queue a merge.

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
- You're explicitly asked to push `{BRANCH}` to origin and open a pull request: title is the Conventional Commit. Write the body yourself; never reuse the commit message (`gh pr create --fill`). Don't hard-wrap it: GitHub renders every newline as a line break, so use one line per paragraph or list item. The body has `Fixes #{N}`, a one-paragraph summary, a "What to review" section, and a "Verification" section saying how each success criterion was checked and what wasn't. In "What to review", say what the reviewer should look at and how to try it; if anything visible changed or must look unchanged, include before/after screenshots (commit PNGs to the `issue-assets` branch under `pr/<pr-or-issue>-<what>.png` and link `https://raw.githubusercontent.com/matthewlyle/mediahooks/issue-assets/pr/<file>.png`). Never merge it.
- Finish with a short report: what you changed, the PR URL, and how each success criterion was verified.
```

## Review each PR

When a worker reports its PR, start a reviewer in a fresh pane in the same worktree (a different
agent from the worker):

```sh
herdr pane split --pane <worker pane> --direction right --cwd <worktree> --no-focus
herdr agent start review-<n> --kind omp --pane <new pane>
herdr agent prompt review-<n> "<reviewer prompt below>"
```

Reviewer prompt, fill `{N}` (issue) and `{PR}`:

```
Review pull request #{PR} in matthewlyle/mediahooks, which claims to fix issue #{N}. Read `gh issue view {N}`, `gh pr view {PR}` and `gh pr diff {PR}`. Follow AGENTS.md. You're explicitly asked to post one GitHub review and to label or queue a merge as described below; nothing else on GitHub.

Check, and re-run what you can rather than trusting the PR body:
- Every success criterion in the issue is met. Run the branch (`AUTH=off PORT={PORT} bun --hot src/server.ts`, port 89 + the issue number zero-padded) and check each criterion in a browser.
- A criterion phrased "VoiceOver announces…" counts as checked when the `voiceover` job on the PR passed with the expected phrase in its `spoken-phrase-log` artifact (`gh run download <run> -n spoken-phrase-log`). A fix with a VoiceOver criterion should add a scenario for it in `test/screen-reader/`; if there's no scenario, or the run was flaky (Playwright reports it as flaky, or it passed only on a rerun), that criterion goes to a person.
- The diff stays within the issue, follows AGENTS.md, and has no dead code, comments that aren't needed, or unrelated changes.
- `bun test` and `bun run typecheck` pass.
- The PR body has Fixes #{N}, What to review, Verification, and screenshots if anything visible changed.

Then decide:
- Merge: the issue has no `review: design` label, you found nothing that needs fixing, every criterion checked out, and nothing visible changed. Post a comment review (`gh pr review {PR} --comment`) starting "Agent review: merge" that lists what you checked, then `gh pr merge {PR} --auto --squash`. GitHub merges only once the required checks pass. (Agents use the owner's account, which can't approve its own PRs, so the review is a comment, not an approval.)
- Human: anything else, including anything you couldn't check. Post a comment review starting "Agent review: needs a person" that says why and what to look at, then `gh pr edit {PR} --add-label "review: human" --add-assignee matthewlyle`.
- Never request changes from the worker, push to the branch, or merge directly.

Write the review body unwrapped, with one line per paragraph or list item. Finish with a short report: the decision, why, and the review URL.
```

Releases stay manual: merging to `main` only adds a line to the release-please PR, and the user
merges that. After merges, run `herdr-prune-merged` (`--dry-run` previews): it removes each herdr
worktree whose branch has a merged PR and whose HEAD is that PR's head, then the local branch.
