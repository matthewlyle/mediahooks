---
name: work-issue
description: Fanning mediahooks GitHub issues out to omp worker agents, one worktree and PR per issue.
---

# Working issues with worker agents

One issue, one worktree, one omp agent, one PR. Follows AGENTS.md: branch `issue-<n>-<slug>`, PR
title is a Conventional Commit, body says `Fixes #<n>`. Workers never merge; only the review step
below may queue a merge.

`origin` is Gitea, so `gh` can't infer the repo: every `gh` command takes
`-R matthewlyle/mediahooks`.

## Check for existing work

Before launching, look for an earlier attempt: `git -C ~/src/mediahooks worktree list` and
`gh pr list -R matthewlyle/mediahooks --state all --search "<n> in:body"`. A branch, worktree or
PR may already exist, possibly outside `~/.herdr/worktrees`. An open PR whose head matches the
worktree's HEAD goes straight to review; an unpushed worktree gets a worker in that worktree.

## Launch a worker

Start workers and reviewers with the `herdr-workers` skill (user-level, from
`matthewlyle/agent-skills`, not this repo). It covers `hc`, the Herdr app and how agents report
back; this file says what each agent does. Each issue gets its own tab: the worker and, later, its
reviewer.

```sh
git -C ~/src/mediahooks fetch git@github.com:matthewlyle/mediahooks.git +main:refs/remotes/github/main
git -C ~/src/mediahooks worktree add ~/.herdr/worktrees/mediahooks/issue-<n>-<slug> -b issue-<n>-<slug> refs/remotes/github/main
```

Then start the worker with `herdr-workers`: name `<n>-<what it fixes>` (`9-wrap-truncated-text`,
not `issue-9`), folder the worktree, label `issue=<n>`, a model from the table below, and the
worker prompt. Tell the owner to name the issue's tab `#<n> <short title>`.

Port: `88` + the issue number zero-padded to two digits (issue 4 → 8804). Never 8788 (dev) or 8787
(production).

Pick the cheapest model that fits; the reviewer catches mistakes:

| Job | Model |
|---|---|
| Worker, normal fix | `claude-sonnet-5-5` |
| Worker, one-line CSS or copy fix | `claude-haiku-5-5` (100K context; not for long browser sessions) |
| Text or mechanical follow-up (trim a PR body, rebase) | `claude-haiku-5-5` |
| Reviewer | `claude-opus-5-5 --thinking low` |

If a cheaper worker's PRs keep bouncing in review, move that kind of issue up a tier.

## Worker prompt

Fill `{N}`, `{BRANCH}` and `{PORT}`:

```
Fix GitHub issue #{N} in matthewlyle/mediahooks: `gh issue view {N} -R matthewlyle/mediahooks`. The issue body is the spec; its success criteria are your acceptance test. Follow AGENTS.md.

- You're in your own worktree on branch `{BRANCH}`. Run `bun install` first.
- Every `gh` command needs `-R matthewlyle/mediahooks` (`origin` is Gitea).
- Run the dev server only as `AUTH=off PORT={PORT} bun --hot src/server.ts` (never `bun run dev`; port 8788 belongs to someone else).
- Reproduce the problem in a browser first, then fix it, then re-check every success-criteria item in the browser. For a CI or workflow issue, reproduce and verify with real Actions runs instead: a throwaway probe PR from an `issue-{N}-probe` branch shows what runs or skips; close it and delete the branch when done.
- Don't change repository settings (rulesets, required checks, secrets). If a criterion needs one, say so in a `> [!WARNING]` **Not checked:** callout in the PR body.
- Run `bun test` and `bun run typecheck`; both must pass.
- If you changed anything under `public/`, run `bun x playwright test -c test/axe` (needs `bun x playwright install chromium` once) and fix what it reports before opening the PR. A new route or state gets a scan in `test/axe/axe.spec.ts`.
- Stay within this issue. Don't touch other issues' code or `CHANGELOG.md`.
- Commit with a Conventional Commit message whose scope matches the issue's topic (`fix(a11y): …` for `accessibility` issues), with `Fixes #{N}` in the body. The PR title is the same line; release-please puts the scope in the changelog.
- You're explicitly asked to push `{BRANCH}` to origin and open a pull request: title is the Conventional Commit. Before pushing, merge the latest `main` (`git fetch git@github.com:matthewlyle/mediahooks.git main && git merge FETCH_HEAD`; force-pushes are blocked) and re-run the checks. Write the body yourself (never `gh pr create --fill`), using exactly the PR body template in `.agents/skills/work-issue/SKILL.md` under "Writing for GitHub". If anything visible changed or must look unchanged, add before/after screenshots: commit PNGs to the `issue-assets` branch under `pr/<issue>-<what>.png` (fetch and rebase it first; other agents push to it too) and link `https://raw.githubusercontent.com/matthewlyle/mediahooks/issue-assets/pr/<file>.png`. After pushing, confirm the PR's head commit equals your local HEAD. Never merge it.
- Finish with a short report: what you changed, the PR URL, and how each success criterion was verified.
```

## Review each PR

When a worker reports its PR, start a reviewer (a different agent from the worker) with
`herdr-workers` in the issue's tab: name `<n>-review`, folder the worktree, label `issue=<n>`, model
`claude-opus-5-5 --thinking low`, and the reviewer prompt.

Reviewer prompt, fill `{N}` (issue) and `{PR}`:

```
Review pull request #{PR} in matthewlyle/mediahooks, which claims to fix issue #{N}. Read `gh issue view {N}`, `gh pr view {PR}` and `gh pr diff {PR}`; every `gh` command needs `-R matthewlyle/mediahooks` (`origin` is Gitea). Follow AGENTS.md. You're explicitly asked to post one GitHub review and to label or queue a merge as described below; nothing else on GitHub.

Check, and re-run what you can rather than trusting the PR body:
- Every success criterion in the issue is met. For an app change, run the branch (`AUTH=off PORT={PORT} bun --hot src/server.ts`, port 89 + the issue number zero-padded) and check each criterion in a browser. For a CI or workflow change, check real Actions runs (`gh run list`, `gh run view --log`), including any closed probe PRs the worker opened.
- A criterion that needs a repository setting (rulesets, required checks) can't be met by the PR. Don't change settings; put it under **Your call**.
- A criterion phrased "VoiceOver announces…" counts as checked when the `voiceover` job on the PR passed with the expected phrase in its `spoken-phrase-log` artifact (`gh run download <run> -n spoken-phrase-log`). A fix with a VoiceOver criterion should add a scenario for it in `test/screen-reader/`; if there's no scenario, or the run was flaky (Playwright reports it as flaky, or it passed only on a rerun), that criterion goes to a person.
- The diff stays within the issue, follows AGENTS.md, and has no dead code, comments that aren't needed, or unrelated changes.
- `bun test` and `bun run typecheck` pass.
- The `axe` job on the PR passed. That's one check, not proof of accessibility: axe finds only scanner-detectable problems (labels, contrast, ARIA), so still check each criterion by hand.
- The PR body follows the template in "Writing for GitHub" and has screenshots if anything visible changed.

Then decide:
- Merge: the issue has no `review: design` label, you found nothing that needs fixing, every criterion checked out, and nothing visible changed. Post a comment review (`gh pr review {PR} --comment`) using the merge template, then `gh pr merge {PR} --auto --squash`. GitHub merges only once the required checks pass. (Agents use the owner's account, which can't approve its own PRs, so the review is a comment.)
- Human: anything else, including anything you couldn't check. Post a comment review using the human template, then `gh pr edit {PR} --add-label "review: human" --add-assignee matthewlyle`.
- Never request changes from the worker, push to the branch, or merge directly.

Write the review with the templates in `.agents/skills/work-issue/SKILL.md` under "Writing for GitHub". Also check the PR title still describes the change. Finish with a short report: the decision, why, and the review URL.
```

## Writing for GitHub

The owner reads these on a phone between other work. Be terse: fragments are fine, no narration
of how you worked, no restating the issue, no hedging. One line per paragraph or list item (GitHub
turns newlines into line breaks). Numbers and names over adjectives.

Use GitHub callouts (`> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`) for what the owner must see,
and fold the evidence into `<details>`. Keep a blank line before and after every callout, list
and `<details>` block, or GitHub merges them.

PR body, at most about 100 words outside the screenshots and the folded checks:

```markdown
Fixes #N

<One or two sentences: what changed, in user terms. Plain text, no callout.>

**Try it:** <one line>

<before/after screenshot table, if anything visible changed or must look unchanged>

<details>
<summary>Checked: <count> passed</summary>

- <criterion 1>
- <criterion 2>
- Tests, typecheck, axe

</details>
```

Callouts in a PR body are only for something that needs attention: a `> [!WARNING]` with
**Not checked:** before `<details>`. The description itself is never in a callout.

Review comment, merge:

```markdown
> [!TIP]
> **Merging** once checks pass. Nothing needs you.

<details>
<summary>Checked: <count> passed</summary>

- <criterion>
- Diff in scope; tests, typecheck, CI

</details>

<sub>Agent review of <short sha></sub>
```

Review comment, needs a person (at most about 60 words outside `<details>`):

```markdown
> [!IMPORTANT]
> **Your call:** <the one question>
>
> <one or two lines of context, with numbers>

> [!WARNING]
> **Fix before merge**
> - <bug, with file and numbers>

<details>
<summary>Checked: <count> passed</summary>

- <criterion>
- Tests, typecheck, CI

</details>

<sub>Agent review of <short sha></sub>
```

Omit the WARNING when there's nothing to fix. If a person is needed only for something you
couldn't check, say that under **Your call**. Several questions: one bullet each inside the
IMPORTANT box.

Releases stay manual: merging to `main` only adds a line to the release-please PR, and the user
merges that. After a PR merges, end its agents (`<n>-<slug>`, `<n>-review`) and remove its
worktree (`git -C ~/src/mediahooks worktree remove <path>`, then delete the local branch).

## Coordinator checklist

- Before launching, read the issue's comments as well as its body: the owner answers design
  questions there. Copy each answer into the issue as a `## Decision` section.
- When a worker reports done, check `gh pr view <pr> -R matthewlyle/mediahooks --json headRefOid` against its local HEAD.
  Agents have reported pushes that never happened. Start a reviewer only on the pushed head.
- After a merge, merge `main` into open PRs that touch the same files before their review.
- When a milestone has no open issues left, close it (`gh api -X PATCH repos/matthewlyle/mediahooks/milestones/<n> -f state=closed`) and tell the owner its release is ready.
