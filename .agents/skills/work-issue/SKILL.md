---
name: work-issue
description: Fanning mediahooks GitHub issues out to omp worker agents, one worktree and PR per issue.
---

# Working issues with worker agents

One issue, one worktree, one omp agent, one PR. Follows AGENTS.md: branch `issue-<n>-<slug>`, PR
title is a Conventional Commit, body says `Fixes #<n>`. Workers never merge; only the reviewer, or
the lead once the owner adds `approved`, may queue a merge.

## Check for existing work

Before launching, look for an earlier attempt: `git -C ~/src/mediahooks worktree list` and
`gh pr list -R matthewlyle/mediahooks --state all --search "<n> in:body"`. A branch, worktree or
PR may already exist, possibly outside `~/.herdr/worktrees`. An open PR whose head matches the
worktree's HEAD goes straight to review; an unpushed worktree gets a worker in that worktree.

## Launch a worker

Start workers and reviewers with the `herdr-workers` skill (user-level, from
`matthewlyle/agent-skills`, not this repo). It covers `hc`, the Herdr app, templates and how agents
report back; this repo's `.agents/templates/` says what each agent does, with its brief in
`.agents/prompts/`. Each issue gets its own tab: the worker and, later, its reviewer.

The templates are linked into hc as `mediahooks-<role>`, once per machine (see "Templates" in
`herdr-workers`). The links point into `~/src/mediahooks`, so a template's model changes when that
checkout is on the new `main`; a brief changes with `.agents/prompts/` on the agent's own branch.

```sh
git -C ~/src/mediahooks fetch origin main
git -C ~/src/mediahooks worktree add ~/.herdr/worktrees/mediahooks/issue-<n>-<slug> -b issue-<n>-<slug> --no-track origin/main
```

Then start the worker with `herdr-workers`: name `<n>-<what it fixes>` (`9-wrap-truncated-text`,
not `issue-9`), folder the worktree, label `issue=<n>`, a template from the table below, and the
task `Issue <n>, port <port>.` Tell the owner to name the issue's tab `#<n> <short title>`.

Port: `88` + the issue number zero-padded to two digits (issue 4 → 8804). Never 8788 (dev) or 8787
(production).

Pick the cheapest template that fits; the reviewer catches mistakes:

| Job | Template |
|---|---|
| Worker, normal fix | `mediahooks-worker` (Sonnet) |
| Worker, one-line CSS or copy fix | `mediahooks-worker-lite` (Haiku: 100K context; not for long browser sessions) |
| Text or mechanical follow-up (trim a PR body, rebase) | none: `omp --model claude-haiku-5-5` with the instructions as its prompt |
| Reviewer | `mediahooks-reviewer` (Opus, thinking low) |

If a cheaper worker's PRs keep bouncing in review, move that kind of issue up a tier.

## Review each PR

When a worker reports its PR, start a reviewer (a different agent from the worker) with
`herdr-workers` in the issue's tab: name `<n>-review`, folder the worktree, label `issue=<n>`,
template `mediahooks-reviewer`, and the task `PR <pr>, issue <n>, port <port>.` The reviewer's
port is `89` + the issue number zero-padded.

The reviewer reports Merge, Fix or Human:

- **Fix:** send the review's **Fix before merge** list to the worker (`hc send <n>-<slug> …`).
  When it reports the new head, end the old `<n>-review` and start a fresh one on that head. A
  third review that still finds fixes goes to the owner.
- **Human:** the owner answers on the PR or issue, or adds `approved`, which means yes to every
  **Your call** question. Have the worker make any listed fixes, then, once CI passes on the new
  head, queue the merge yourself (`gh pr merge <pr> --auto --squash`), in dependency order when
  PRs build on each other.

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

Review comment, back to the worker (no label, no assignee):

```markdown
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
- Before starting new work, check `gh pr list -R matthewlyle/mediahooks --label approved` and
  queue the merges those are waiting on.
- When a milestone has no open issues left, close it (`gh api -X PATCH repos/matthewlyle/mediahooks/milestones/<n> -f state=closed`) and tell the owner its release is ready.
