# mediahooks: agent workflow

What the shared `work-issue` and `github-issue` skills (`matthewlyle/agent-skills`) need to know
about this repo. The process lives there; only what's specific to mediahooks lives here.

## Repo

- GitHub `matthewlyle/mediahooks`; checkout `~/src/mediahooks`; worktrees under
  `~/.herdr/worktrees/mediahooks/`. Agents run on mini.

## Per issue

- Each agent gets a port: `88` + the issue number zero-padded to two digits for the worker
  (issue 4 → 8804), `89` + it for the reviewer. Never 8788 (dev) or 8787 (production).
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

## Commits, PRs, merging

- Commit: a Conventional Commit whose scope matches the issue's topic (`fix(a11y): …` for
  `accessibility` issues), `Fixes #<n>` in the body. The PR title is the same line: it becomes the
  squash commit, and release-please puts the scope in the changelog.
- Merge: `gh pr merge <pr> -R matthewlyle/mediahooks --auto --squash`.
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
