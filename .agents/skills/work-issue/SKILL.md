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
- You're explicitly asked to push `{BRANCH}` to origin and open a pull request: title is the Conventional Commit. Write the body yourself (never `gh pr create --fill`), using exactly the PR body template in `~/src/mediahooks/.agents/skills/work-issue/SKILL.md` under "Writing for GitHub" (read it from that path, not your worktree). If anything visible changed or must look unchanged, add before/after screenshots: commit PNGs to the `issue-assets` branch under `pr/<issue>-<what>.png` and link `https://raw.githubusercontent.com/matthewlyle/mediahooks/issue-assets/pr/<file>.png`. Never merge it.
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
- The diff stays within the issue, follows AGENTS.md, and has no dead code, comments that aren't needed, or unrelated changes.
- `bun test` and `bun run typecheck` pass.
- The PR body follows the template in "Writing for GitHub" and has screenshots if anything visible changed.

Then decide:
- Merge: the issue has no `review: design` label, you found nothing that needs fixing, every criterion checked out, and nothing visible changed. Post a comment review (`gh pr review {PR} --comment`) using the merge template, then `gh pr merge {PR} --auto --squash`. GitHub merges only once the required checks pass. (Agents use the owner's account, which can't approve its own PRs, so the review is a comment.)
- Human: anything else, including anything you couldn't check. Post a comment review using the human template, then `gh pr edit {PR} --add-label "review: human" --add-assignee matthewlyle`.
- Never request changes from the worker, push to the branch, or merge directly.

Write the review with the templates in `~/src/mediahooks/.agents/skills/work-issue/SKILL.md` under "Writing for GitHub" (read it from that path, not your worktree). Finish with a short report: the decision, why, and the review URL.
```

## Writing for GitHub

The owner reads these on a phone between other work. Be terse: fragments are fine, no narration
of how you worked, no restating the issue, no hedging. One line per paragraph or list item (GitHub
turns newlines into line breaks). Numbers and names over adjectives.

PR body, at most about 100 words plus screenshots:

```markdown
Fixes #N

<One or two sentences: what changed, in user terms.>

**Review:** <what to look at or decide, one line; "nothing visible changed" if so>
**Try it:** <one line>

<before/after screenshot table, if visible>

**Checked:** <criterion 1> ✓ · <criterion 2> ✓ · tests ✓ · typecheck ✓
**Not checked:** <one line, or omit>
```

Review comment, merge (at most 3 lines):

```markdown
Agent review: merge
Checked: <criteria> ✓ · diff in scope ✓ · tests ✓ · CI ✓
```

Review comment, needs a person (at most about 60 words):

```markdown
Agent review: needs a person
Decide: <the one question for the owner; add one bullet per extra question, max 3>
Fix first: <bugs found, one bullet each, with numbers; omit if none>
Checked: <criteria> ✓ · tests ✓ · CI ✓
```

Releases stay manual: merging to `main` only adds a line to the release-please PR, and the user
merges that. After merges, run `herdr-prune-merged` (`--dry-run` previews): it removes each herdr
worktree whose branch has a merged PR and whose HEAD is that PR's head, then the local branch.
