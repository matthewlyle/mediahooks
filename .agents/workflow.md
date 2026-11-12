# mediahooks: agent workflow

What the shared `work-issue` and `github-issue` skills (`skills/` in `matthewlyle/tracker`) need
to know about this repo. The process lives there; only what's specific to mediahooks lives here.

## Repo

- GitHub `matthewlyle/mediahooks`, owned by `matthewlyle`; checkout `~/src/mediahooks`; worktrees under
  `~/.herdr/worktrees/mediahooks/`. Agents run on mini.
- `~/src/mediahooks` is the owner's checkout: agents only `git fetch` and `git worktree add` there,
  and never check out, pull, commit or edit it. Work happens in their own worktree.

## Per issue

- Each agent gets a port: `88` + the issue number zero-padded to two digits for the worker
  (issue 4 → 8804), `89` + it for the reviewer. From 100 up, `9` + the three-digit number for
  the worker (135 → 9135) and `19` + it for the reviewer (135 → 19135). Never 8787 (production)
  or 8788 (dev); start nothing on any other port.
- Worker task: `Issue <n>, port <port>.` Reviewer task: `PR <pr>, issue <n>, port <port>.`
- Worktree setup: `bun install`.
- Lite fits a one-line CSS or copy fix, not a long browser session.
- A change to `AGENTS.md` or `.agents/` is never lite: it goes to the owner as Human.

## Milestone

- One PR per milestone, as `work-issue`'s `milestones.md` describes. Each issue's worker keeps its
  own port; the PR's reviewer takes the first issue's reviewer port, with task
  `PR <pr>, issues <a>, <b>, port <port>.`
- Milestone merge: `gh pr merge <pr> -R matthewlyle/mediahooks --auto --rebase` (keeps one commit
  per issue). Never squash a milestone PR: release-please needs each issue's commit.
- A milestone is named for the release it ships in. When it has no open issues left, close it
  (`gh api -X PATCH repos/matthewlyle/mediahooks/milestones/<n> -f state=closed`) and tell the
  owner its release is ready.

## Build, check, look

- Run the branch only as `AUTH=off PORT=<port> bun --hot src/server.ts` (never `bun run dev`;
  8788 belongs to someone else). Poll for the port in one loop.
- Look in a browser: the page's text and accessibility tree first.
- Verify: `bun test` and `bun run typecheck`. A change under `public/` also runs
  `bun x playwright test -c test/axe` (`bun x playwright install chromium` once) with its findings
  fixed; a new route or state gets a scan in `test/axe/axe.spec.ts`. The `axe` job passing is one
  check, not proof of accessibility: still check each criterion by hand.
- A "VoiceOver announces…" criterion can't be checked while the `voiceover` workflow is disabled:
  put it under **Not checked:** with steps for the owner.
- Checks line: `Tests, typecheck, axe`.
- A design-system change (a component in `public/ui/`) also passes this checklist:
  - `bun run style:dump` then `bun run style:diff` prints nothing. When the change touches a state
    the dump doesn't load, compare before/after screenshots of that state instead.
  - No page CSS (`public/pages/*.css`, `public/styles.css`) selects the component's classes; a
    page that needs placement passes its own `className`.

## Commits, PRs, merging

- Commit: a Conventional Commit whose scope matches the issue's topic (`fix(a11y): …` for
  `accessibility` issues), `Fixes #<n>` in the body. The PR title is the same line: it becomes the
  squash commit, and release-please puts the scope in the changelog.
- Type: `feat` only for a change app users can see or use. Refactors,
  tests, CI and tooling use `refactor`, `chore`, `test` or `ci`.
- Merge: `gh pr merge <pr> -R matthewlyle/mediahooks --auto --squash`.
- A PR that conflicts with `main` only because another PR touched the same lines (import lists,
  moved rules) is the reviewer's to fix: merge `origin/main` into the branch, keep both sides,
  re-run the verify steps and push. Any other conflict is a Fix.
- Off limits: `CHANGELOG.md`.

## Deploy

- Merging only updates the release-please PR. When the owner merges that PR, CI tags, writes
  `CHANGELOG.md`, publishes the GitHub Release and pushes the image to
  `ghcr.io/matthewlyle/mediahooks`. Production then pulls it
  (`docker compose pull mediahooks && docker compose up -d mediahooks`); a new major version needs
  the compose tag changed from `:1`.

## Cleanup

- Nothing beyond the worktree and its branch.

## Issues

- Areas: the page or feature (`Webhook editor`), or `App-wide`. Examples:
  `Webhook editor: icon-only buttons have no accessible name`,
  `App-wide: focus ring invisible on dark surfaces`.
- Where: `` - `/route` — `public/path/File.tsx:123` (component or element) ``.
- Steps start from a fresh page load and name the input method (mouse, keyboard, screen reader,
  narrow viewport).
- Criteria like "Tab reaches X", "the response is 404", "VoiceOver announces 'Delete webhook,
  button'".
- Reference is required: the spec section, name and level that defines the expected behavior.
- Reproduced label: `verified: browser`.
- A batch of related issues goes in a milestone named for the release it ships in.
