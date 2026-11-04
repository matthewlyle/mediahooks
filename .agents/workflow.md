# mediahooks: agent workflow

What the shared `work-issue` and `github-issue` skills (`matthewlyle/agent-skills`) need to know
about this repo. The process lives there; only what's specific to mediahooks lives here.

## Repo

- GitHub `matthewlyle/mediahooks`, owned by `matthewlyle`; checkout `~/src/mediahooks`; worktrees under
  `~/.herdr/worktrees/mediahooks/`. Agents run on mini.

## Per issue

- Each agent gets a port: `88` + the issue number zero-padded to two digits for the worker
  (issue 4 → 8804), `89` + it for the reviewer. From 100 up, `9` + the three-digit number for
  the worker (135 → 9135) and `19` + it for the reviewer (135 → 19135). Never 8787 (production)
  or 8788 (dev); start nothing on any other port.
- Worker task: `Issue <n>, port <port>.` Reviewer task: `PR <pr>, issue <n>, port <port>.`
- Worktree setup: `bun install`.
- Lite fits a one-line CSS or copy fix, not a long browser session.
- Cleanup after a merge: nothing beyond the worktree.

## Build, check, look

- Run the branch only as `AUTH=off PORT=<port> bun --hot src/server.ts` (never `bun run dev`;
  8788 belongs to someone else). Poll for the port in one loop.
- Look in a browser: the page's text and accessibility tree first.
- Verify: `bun test` and `bun run typecheck`. A change under `public/` also runs
  `bun x playwright test -c test/axe` (`bun x playwright install chromium` once) with its findings
  fixed; a new route or state gets a scan in `test/axe/axe.spec.ts`. The `axe` job passing is one
  check, not proof of accessibility: still check each criterion by hand.
- A "VoiceOver announces…" criterion counts as checked when the `voiceover` job on the PR passed
  with the expected phrase in its `spoken-phrase-log` artifact
  (`gh run download <run> -n spoken-phrase-log`). The fix adds a scenario in `test/screen-reader/`;
  a missing scenario is a fix. Agents can't check a VoiceOver criterion whose run was flaky
  (Playwright reports it as flaky, or it passed only on a rerun).
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
- Releases: merging only adds a line to the release-please PR, which the owner merges. When a
  milestone has no open issues left, close it
  (`gh api -X PATCH repos/matthewlyle/mediahooks/milestones/<n> -f state=closed`) and tell the owner
  its release is ready.

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
