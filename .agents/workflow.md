# mediahooks: agent workflow

What the shared `work-issue` and `github-issue` skills (`skills/` in `matthewlyle/tracker`) need
to know about this repo. The process lives there (the milestone flow, merge method, commit style,
lite tier and cleanup default in the work-issue skill's `defaults.md`); only what's specific to
mediahooks lives here.

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
- Lite fits a one-line fix outside `public/`, not a long browser session.
- A change to `AGENTS.md`, `.agents/` or anything under `public/` is never lite: it goes to the
  owner as Human.

## Milestone

- Merge: `gh pr merge <pr> -R matthewlyle/mediahooks --auto --rebase`. The checks are required, so
  auto-merge waits for them, and a rebase keeps one commit per issue, which release-please needs.
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

- The commit scope matches the issue's topic (`fix(a11y): …` for `accessibility` issues);
  release-please puts the scope in the changelog.
- Merge: `gh pr merge <pr> -R matthewlyle/mediahooks --auto --squash`.
- A PR that conflicts with `main` only because another PR touched the same lines (import lists,
  moved rules) is the reviewer's to fix: merge `origin/main` into the branch, keep both sides,
  re-run the verify steps and push. Any other conflict is a Fix.
- Off limits: `CHANGELOG.md`.

## Owner review

- No agent merges a PR that changes a file under `public/`, in a milestone too: the owner looks at
  it running first. The reviewer checks it as usual and returns Fix for what the worker must fix;
  where it would have returned Merge it returns Human, with `Look at it:
  http://mini.local:<worker port>/` as a **Your call** bullet.
- On that Human verdict the lead starts the preview before it ends the agents, on the worker's
  port once the worker's own server has stopped:
  `hc run --bg --outlive-parent --name <n>-preview --cwd <worktree> --label repo=matthewlyle/mediahooks --label port=<port> "NODE_ENV=production AUTH=off PORT=<port> bun src/server.ts"`,
  then poll for the port in one loop. `NODE_ENV=production` is what lets another machine on the
  network open it. Never give it an `issue=` label: the tracker would send the owner's Approve to
  it instead of starting a merge agent.
- The preview serves the head it was started on. After a Send back, end it (`hc kill <n>-preview`,
  `hc rm <n>-preview`) and start a new one on the next Human verdict.

## Cleanup

- Before the default cleanup after a merge, and when a PR is closed unmerged, end its preview:
  `hc kill <n>-preview`, then `hc rm <n>-preview`.

## Deploy

- Merging only updates the release-please PR. When the owner merges that PR, CI tags, writes
  `CHANGELOG.md`, publishes the GitHub Release and pushes the image to
  `ghcr.io/matthewlyle/mediahooks`. Production then pulls it
  (`docker compose pull mediahooks && docker compose up -d mediahooks`); a new major version needs
  the compose tag changed from `:1`.

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
