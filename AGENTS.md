# mediahooks

Receives Plex webhooks and fans each event out to user-managed webhooks with filters and templates.
Bun + `bun:sqlite` server in `src/`, React UI in `public/` bundled by Bun.

## Commands

```sh
bun install
bun run dev        # :8788, own DB in ./data; .env (see .env.example) sets PLEX_URL if Plex isn't local
bun test
bun run typecheck
```

Smoke runs: `AUTH=off` skips sign-in, a short `GROUP_QUIET_MS` shortens new-episode grouping,
`PLEX_TV_URL` points plex.tv calls at a fake. The README documents only `PLEX_URL`, `PORT` and
`PUBLIC_URL`; keep the rest out of it.

Screen-reader tests: `test/screen-reader/*.spec.ts` drive real VoiceOver in WebKit with Playwright
and `@guidepup/playwright`, and assert on `voiceOver.spokenPhraseLog()`. They run in the `voiceover`
workflow on a macOS runner, on pull requests touching `public/**` or `test/screen-reader/**`, or by
hand with `gh workflow run voiceover.yml -f ref=<branch>`; each run uploads the log as the
`spoken-phrase-log` artifact. Running them on a Mac needs `npx @guidepup/setup` and takes over
VoiceOver, so leave them to CI. `bun test` skips them (`bunfig.toml` roots it at `src/`). A fix with
a "VoiceOver announces…" criterion adds a scenario there.

Commit messages use Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`,
`ci:`; `!` for breaking). release-please turns `feat`/`fix` commits into a release PR; merging it
tags, writes `CHANGELOG.md` and the GitHub Release, and publishes `ghcr.io/matthewlyle/mediahooks`.
Don't tag by hand.

Working an issue: a branch `issue-<n>-<slug>` in its own worktree, a pull request whose title is a
Conventional Commit (it becomes the squash commit) and whose body says `Fixes #<n>`. Never merge it.

## Don't break

- Never open a running container's DB with `sqlite3` from a macOS host: the VM file share doesn't
  carry SQLite's WAL locks and it corrupts the database. Use the API or stop the container.
- `src/migrations.ts`: append new migrations; never edit a shipped one.
- Every `/api/*` route goes through `protect()`. Only the Plex server's owner can sign in; there is
  no first-sign-in claim.
- The API never returns saved secrets (`src/secrets.ts`). Masked values sent back are restored only
  when the URL is still the saved one, so a secret can't be redirected to another host.
- `/thumbs/:key` is public on purpose and uses random keys, not event ids.
- The CSRF check trusts `Sec-Fetch-Site` before `Origin`/`Host` because proxies rewrite `Host`.
- A new client route needs adding in `public/App.tsx` and in `src/app.ts` (SPA fallback).

## Code style

- No code comments, unless a future reader would break the code without one. One short line.

## Tests

- Test behavior through the real code: in-memory `openDb`, `createApp` on `port: 0`, real HTTP. No
  `mock()` or `spyOn`; the only stand-ins are `Bun.serve` fakes for Plex, plex.tv and receivers,
  and an injected `Clock`. A fake rejects what the real service would.
- One test per behavior, in the owning module's test file. Don't assert static tables, token
  formats, column lists, or request details the outcome already proves.
- Break the code a new test covers and watch it fail before keeping it.

## UI

- Motion via `motion/react`, shared values in `public/lib/motion.ts`. Animate only
  `transform`/`opacity`. Keyboard-initiated closes never animate. Respect reduced motion.
- Shared-element morphs only between similar-sized things close together; never fade an ancestor of
  a `layoutId` element.
- Springs with bounce for success only; errors are a faint red tint, no shakes.
- Hovers only under `(hover: hover) and (pointer: fine)`. On coarse pointers: 16px text in fields,
  ~40px tap targets. Under 640px popovers become bottom sheets.
- Copy: sentence case, no filler text, no uppercase letter-spaced labels, no left accent bars.
