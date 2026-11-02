# mediahooks

Receives Plex Media Server webhooks (Plex Pass) and fans each event out to user-managed webhooks
(Discord, Slack, ntfy, Home Assistant, …) with per-webhook filters and templated bodies.

## Configuration

Env: `PLEX_URL` (how mediahooks reaches the Plex server; default `http://localhost:32400`, and the
image defaults to `http://host.docker.internal:32400` for Plex on the Docker host; see Auth),
`PORT` (default 8787), `DB_PATH` (default `data/mediahooks.db`; the image
uses `/data/mediahooks.db`), optional `PUBLIC_URL` (base for `{{thumb_url}}`; see Posters),
optional `GROUP_QUIET_MS` / `GROUP_MAX_MS` (new-episode grouping windows, default 120000 / 600000;
set a short `GROUP_QUIET_MS` to smoke-test grouping without waiting), optional `PLEX_TV_URL`
(default `https://plex.tv`; tests and smoke runs point it at a mock) and `AUTH=off` (see Auth).
The README documents only `PLEX_URL`, `PORT` and `PUBLIC_URL`. The rest are for development and
smoke runs; keep them out of the README.
Bun loads `.env` automatically, so `.env` (gitignored; see `.env.example`) holds local values;
`.dockerignore` keeps it out of the image.

In Plex, the webhook URL is `http://<mediahooks host>:<port>/plex?token=…`; the Help page shows it with
the generated ingest token.

Never open a running container's DB from the host with `sqlite3` on macOS (Docker Desktop,
OrbStack): it's in WAL mode and the VM file share doesn't carry SQLite's locks/shared memory, so a
host session can checkpoint and reset the WAL under the app, which then reports SQLITE_CORRUPT and
loses recent writes. Inspect through the API, or stop the container first.

## Commands

```sh
cp .env.example .env   # only if Plex isn't on this machine: set PLEX_URL
bun install
bun run dev        # hot-reloading dev server on :8788, own DB in ./data
bun test
bun run typecheck
```

Releases: push a `vX.Y.Z` tag to GitHub. `.github/workflows/release.yml` runs the tests, then builds
the image for linux/amd64 and linux/arm64 and pushes `ghcr.io/matthewlyle/mediahooks` as `X.Y.Z`,
`X.Y`, `X` and `latest`. `ci.yml` runs the tests on every push to `main` and on pull requests.
The Dockerfile runs as the image's `bun` user (uid 1000) with `/data` owned by it, and has a
`HEALTHCHECK` on `/healthz` (no curl in the image, so it's a `bun -e` fetch).

## Code style

- No code comments. Leave one only when a future reader would definitely break the code without it
  (a constraint the code can't show, like why a header is deleted before a multipart send). One
  short line, no history or rationale essays. No doc comments, section dividers, or restating code.

## Tests

- Test behavior a user or caller would notice, through the real code: an in-memory `openDb`, a real
  `createApp` on `port: 0`, real HTTP. No mocking libraries, `mock()` or `spyOn`. The only stand-ins
  are fakes at the edges: `Bun.serve` servers playing Plex, plex.tv or a webhook receiver, and an
  injected `Clock`.
- A fake must reject what the real service would reject (wrong token, wrong path), so the test
  checks the outcome, not the shape of the request.
- One test per behavior, in the file for the module that owns it (`filters.test.ts` for filter
  rules, `send.test.ts` for one request). Before adding a test, check that no other test already
  fails when that behavior breaks.
- Don't assert copies of static tables (event → action wording), token or key formats, column
  lists, request parameters the outcome already proves, or anything that only changes when the
  code is restyled.
- Adding a test: break the code it covers and watch the test fail before keeping it.

## Layout

- `src/server.ts`: reads env, opens the DB, starts `createApp`, SIGTERM/SIGINT flush.
- `src/app.ts`: `createApp(config)` → `Bun.serve` routes. `/plex` ingest, `/healthz` (no session;
  `ok` when the DB answers, else 503), `/api/*` CRUD, deliveries (`/api/webhooks/:id/deliveries`
  list, `/api/deliveries/:id` with request and response), recent events, `/api/status`
  (`lastEventAt`: when the newest stored event arrived, or null), send-test, `/api/ingest-token`
  (replace), `/api/plex/*`, `/api/thumbs/latest`, `/thumbs/:key` (stored poster). Serves
  `public/index.html` (Bun bundles the UI; dev mode = on request with HMR, `NODE_ENV=production` =
  once at startup). Tests start it with `port: 0`, an in-memory DB and a stub `index`.
  `src/http.ts`: `error()`, `notFound()`, `parseId()`, `readJson()` shared by the route modules.
- `src/ingest.ts`: `/plex` handler (multipart or JSON; `?token=` must match the ingest token, kept
  in settings) and the token itself (`token()`, `replaceToken()`).
- `src/auth.ts`: Plex PIN sign-in routes, sessions, `protect()` (wraps every `/api/*` route).
  `src/plex.ts`: plex.tv + Plex server client (PINs, account, ownership, users, libraries).
  `src/secrets.ts`: masking of webhook secrets in API responses (see Secrets).
- `src/types.ts`: shared types (webhooks, deliveries, events, payloads) and `PLEX_EVENTS`.
- `src/db.ts`: `bun:sqlite`. Webhooks, deliveries (50 per webhook), incoming events (last 100, with
  per-webhook routing reasons and the poster, if any), settings (key/value), sessions.
- `src/migrations.ts`: base schema and numbered `MIGRATIONS` (append only; index + 1 =
  `PRAGMA user_version`, each runs once in a transaction). The first one brings any pre-versioning
  layout up to date, so it checks before each step. A database with a higher version than this
  build knows is refused at startup.
- `src/filters.ts`: `explain()` (why a webhook would not get an event; it applies only the filters
  the "Send when" sentence shows: no user filter for `library.new`, `playback.started`, `admin.*`,
  `device.new`, and no library filter for the last four) and `matches()`. The editor uses it too.
- `src/send.ts`: builds and sends one request (`prepare()`, `transmit()`, `send()` for send-test),
  captures the masked request and response for the delivery log.
- `src/dispatch.ts`: `createDispatcher()` (one per server: `ingest()` records the event + routing,
  then delivers to matches now, with retries, or holds new episodes for grouping; `flushAll()` on
  SIGTERM/SIGINT). Timers (grouping and retry delays) come from an injectable `Clock`, so tests never wait.
- `src/template.ts`: `{{var}}` and `{{Payload.path}}` rendering; aliases incl. `display_title`,
  `episode_code`, `artist`, `album`, `action`, `thumb_url`, `count`, `episodes`. Values are JSON-escaped only when the
  body is JSON (`isJsonContentType`).
- `src/validate.ts`: webhook input validation (events required; `"*"` = all events, alone).
- UI (React + `motion/react` + `wouter`), bundled by Bun from `public/index.html` → `public/main.tsx`
  (fonts, `styles.css`, `background.ts` grid floor) → `public/App.tsx` (`MotionConfig`, providers,
  auth gate, header/nav/account menu, routes). Client routes: `/` list, `/new` (the editor in a
  `Modal` over the page it was opened from, else the list; that page and the header are `inert`
  meanwhile; Cancel/Esc go back there, Save goes to the list), `/webhooks/:id/edit` editor page,
  `/webhooks/:id` detail + delivery log, `/events` recent Plex events,
  `/help`. Signed out, any route shows `SignInPage`. `src/app.ts` serves `index.html` for each of
  them (SPA fallback); add new routes in both places.
- `public/lib/`: `api.ts` (JSON fetch that never throws; any 401 outside `/api/auth/*` calls the
  handler `App` registers, which returns to the sign-in screen), `store.tsx` (webhooks, meta, last delivery,
  highlights, Plex status from `/api/status`; `useStore`, `usePlexStatus`), `motion.ts` (`EASE`, `SPRING`,
  `TAP`, `ids` for layoutIds, `pageTransition`, `fadeIn`, `flash`, `reduced`), `nav.ts` (`useNav` with
  `{ instant }`, `useLinkProps`, `useEscape`), `sentence.ts` (the "Send when …" wording: `sentenceParts`
  for the editor's tokens, `webhookParts`/`partsText` for read-only copies, `eventWords` for event names),
  `refetch.ts` (`useRefetchOnReturn`: coming back to the tab, or focusing the window, re-runs a load at
  most once per 2s; the store, Events page and delivery log use it. The store keeps webhooks removed
  during an Undo window hidden across refetches).
- `public/components/`: Button/LinkButton, Switch, Menu, Toast (Undo), CopyButton, StatusBadge,
  Spinner, RelativeTime, SentenceSummary (list row + detail), PlexStatus (Help step 1), Modal
  (backdrop, scroll container, dialog; locks page scroll; full-screen under 640px),
  `burst.ts` (confetti).
- `public/pages/<Name>Page.tsx` + `<Name>Page.css` (imported by the page; selectors use a
  page-scoped prefix like `.page-detail`, `.ev-`, `.d-row`). `public/pages/editor/` holds
  the editor's form logic. `public/presets.ts`: service formats ("Use a template" menu, and
  auto-picked from a pasted URL). `public/styles.css`: theme, shared components (buttons, header,
  nav, cards, switch, menu, editor form, toast), hovers, CSS loops/one-shots, grid background.

## Auth

Sign in with Plex (PIN flow, like Tautulli/Overseerr). Only the Plex server's owner gets in.

- `POST /api/auth/pin` creates a strong PIN on plex.tv and returns the `app.plex.tv/auth` URL; the
  UI opens it in a popup (a link if the popup is blocked) and polls `POST /api/auth/pin/:id` every
  1.5s for up to 5 minutes. Once Plex has a token for the PIN, the account must own `PLEX_URL`'s
  server (its `/identity` machineIdentifier is in the account's plex.tv resources with
  `owned: true`). Otherwise 403 "This Plex account doesn't own this server." There is no
  first-sign-in claim: that would let whoever reaches a fresh install first take it over.
- plex.tv calls send `X-Plex-Product: mediahooks` and a `X-Plex-Client-Identifier` generated once
  and kept in `settings.client_id`.
- Ingest token: 24 random bytes (base64url), generated on first start and kept in
  `settings.ingest_token`. `/plex` without the matching `?token=` gets 401 (constant-time compare).
  `/api/meta` returns it so the Help page can show the full webhook URL for Plex. Help → New token →
  Replace token (`POST /api/ingest-token`) swaps it at once; the old URL stops working.
- The owner's Plex token is stored server-side only (`settings.owner_token`, replaced on each
  sign-in) and used for `/api/plex/libraries` (`{PLEX_URL}/library/sections`) and
  `/api/plex/users` (owner + plex.tv home users + `/api/users` friends who share this server).
  Both are cached in memory for 5 minutes; failures return an error JSON and the editor's sentence
  falls back to names seen in recent events.
- Sessions: 32 random bytes in the `mediahooks_session` cookie (HttpOnly, SameSite=Lax, Path=/,
  Secure when the request came over https: the URL's scheme, `X-Forwarded-Proto: https`, or an
  `https:` `Origin`, so it works behind TLS-terminating proxies); the DB keeps only its SHA-256.
  30 days, sliding (expiry refreshed at most once an hour). Expired rows are pruned on sign-in and
  on lookups that miss.
- Public: `/plex` (ingest token), `/thumbs/:key`, the HTML routes and `/api/auth/*`. Every
  other `/api/*` route needs a session (401 JSON), including `/api/thumbs/latest` (the newest
  poster, used by the editor's Discord preview).
- CSRF, even with `AUTH=off`: POST/PUT/PATCH/DELETE to `/api/*` must have `Sec-Fetch-Site:
  same-origin` (or `none`) when the browser sends it; without it, an `Origin` whose host isn't the
  request's `Host` gets 403. `Sec-Fetch-Site` comes first because reverse proxies (nginx's default,
  for one) rewrite `Host` to the upstream, which would fail every save.
- Exposing it (Tailscale Funnel, Cloudflare Tunnel, a reverse proxy): only `/thumbs/*` needs to be
  reachable from outside, so cloud services can load `{{thumb_url}}`. Plex posts to `/plex` from
  the same machine or network; keep the UI and `/api/*` private.
- `AUTH=off` is the emergency switch (e.g. plex.tv down): no sign-in, the UI and API are open to
  anyone who can reach the port. `/api/plex/*` still works if an owner token was stored earlier.

## Posters

Every event's poster is fetched from the Plex server after the `/plex` ack, once an owner token is
stored: `{PLEX_URL}/photo/:/transcode` (600×900, `X-Plex-Token` header, 5s timeout) for
the show's poster on episodes, the album art on tracks, else `Metadata.thumb`. The `thumb` JPEG part Plex sends with
`media.play`, `media.rate` and `library.new` is only a fallback (it's tiny, ~133×200). The poster is
stored on the event row (pruned with it) with a random key (`thumb_key`, 32 hex chars; older rows
get one on startup) and served at `GET /thumbs/<key>`. With neither, no poster.

- `{{thumb_url}}` is `${PUBLIC_URL}/thumbs/<key>`, or empty when the event has no poster or
  `PUBLIC_URL` (env, e.g. `http://192.168.1.10:8787`) is unset. The editor preview renders it empty.
  Keys, not event IDs, so a public `/thumbs` can't be enumerated.
- The editor preview (Episode / Movie / Music) uses the newest stored event of that type that the form's
  filters would send, else the newest of that type, else the built-in sample (`src/sample.ts`).
  An attached poster previews as that event's stored poster; the sample uses the newest one.
  Template autocomplete uses the same payload.
- A webhook with `attachPoster` sends events that have a poster as `multipart/form-data` (Discord's
  format): `payload_json` = the rendered body, `files[0]` = `poster.jpg`. Without a poster it's the
  normal request. The Discord template turns it on and is a Tautulli-style "new in your library"
  embed (`library.new`, poster via `attachment://poster.jpg`, `{{plex_url}}`, `{{timestamp}}`).
- Bodies are exactly the template: an empty template sends no body (and no default Content-Type),
  never the raw Plex payload.
- Header values are templates too (`renderHeaders`): plain-text rendering, line breaks collapsed,
  headers that render empty aren't sent (e.g. `Attach: {{thumb_url}}` without a poster), and
  non-ASCII values go out RFC 2047-encoded (`=?UTF-8?B?…?=`, which ntfy decodes). The ntfy template
  uses this for Title/Tags/Click/Attach.
- The editor's Template dropdown shows Custom or the service format the body/headers still match;
  picking one applies it (body, headers, poster, and its events if it names them).
- Tests (`/api/send-test`) come from the editor's "Send test" (the form's current values, plus `id`
  when editing) and the list's row menu "Test" (the saved webhook), and send once, recording nothing.
  The body's `eventId` picks the event: a number = that stored event (the editor sends the one its
  preview shows), `null` = the built-in sample (with the newest stored poster), absent (the list) =
  the newest stored event the webhook would send, else the sample. A real event brings its own
  poster.

## Secrets

The API never returns a saved secret; `src/secrets.ts` replaces it with `••••••` (`MASK`) in every
webhook response (list, create, update).

- Names (header names, query names, JSON keys) are secret when a word in them is one of `token`,
  `key`, `apikey`, `secret`, `password`, `pass`, `auth`, `authorization`, `signature`, `sig`,
  `credential(s)`, `cookie`, split on separators and camelCase (`apiKey`, `access_token` yes;
  `author` no).
- URL: path segments that look like tokens (16+ chars with letters and digits, e.g. Discord/Slack
  webhook tokens, n8n UUIDs), the segment after `webhook`, `webhook-test`, `hooks` or `notify`
  however short (Home Assistant, n8n, Apprise keys), the first segment on an `ntfy` host (the
  topic), query values with a secret name or a token-like value, and the userinfo password. A URL
  with nothing to hide comes back exactly as saved.
- Headers: values with a secret name, unless the value is a template (`{{…}}`).
- Bodies: JSON string values and `name=value` pairs with a secret name or a token-like value
  (16+ of `[A-Za-z0-9_-]` with letters and digits), unless the value is a template. The delivery
  log masks rendered request bodies the same way.
- Sending masked values back (editor save, enable switch, duplicate, send-test) keeps the saved
  ones: PUT uses the webhook being updated; POST `/api/webhooks` and `/api/send-test` use the
  webhook named by an `id` in the body (the list sends the whole webhook, the editor adds `id`).
  The URL is restored only when it is exactly the masked form of the saved one. Hidden headers and
  body values come back only when the final URL is the saved URL, so a secret can't be redirected
  to another host. Body values are restored in order, so the template can be edited around them,
  as long as the number of `••••••` is unchanged. Anything else still containing `••••••` is a 400
  (`url has a hidden part…`, `headers include a hidden … value…`, `body template has hidden
  values…`), shown on the editor field.

## Deliveries and retries

- A delivery that fails with a network error/timeout, HTTP 5xx or 429 is re-sent (the same rendered
  request, poster included) after 5s, 20s and 60s: up to 4 attempts. Other 4xx aren't retried.
  Each retry logs one line (`<webhook>: retry 2 in 20s (HTTP 502)`).
- One delivery row per event and webhook, written when it succeeds or gives up: `attempts`, and the
  final attempt's status/ok/error/duration. The last-delivery badge shows that final outcome.
- Each row also keeps the request (URL and headers masked as in Secrets, the rendered body; a
  multipart send lists `payload_json` and the file's name, type and size) and the final attempt's
  response (headers masked, body), each body cut at 8 KB. The delivery list leaves them out; a row
  on the detail page opens them from `/api/deliveries/:id`. Rows from before this have neither.
- Retries wait in the background per webhook; other webhooks and new events aren't held up.
- In memory only: on SIGTERM/SIGINT pending retry delays are cancelled and those deliveries are
  recorded with the attempts made so far (a restart never resumes them).

## Grouping new episodes

In memory: a restart drops pending groups (they are flushed on SIGTERM/SIGINT first).

- New episodes (`library.new` with `Metadata.type` `episode`) are held per show (`Server.uuid` +
  `grandparentRatingKey`, else `grandparentTitle`). A show's group goes out 2 minutes after its last
  new episode, or 10 minutes after its first, whichever comes first. Movies, other `library.new`
  items and every other event go out immediately.
- Every event is still stored on arrival; while held, matching webhooks' routing says "held to group
  …". A group of 1 is then sent exactly like an ungrouped event. A group of N sends once, built from
  the first episode's payload: `{{display_title}}` = "Show · N new episodes", `{{count}}` = N,
  `{{episodes}}` and `Metadata.summary` = one `S01E02 · Title` line per episode (sorted), poster =
  the first one in the group. Routing goes on the first episode's event; the others say which event
  they were sent with. Outside groups `{{count}}` is 1 and `{{episodes}}` is empty.

## UI rules we settled on

- Motion: `motion/react` components; shared values live in `public/lib/motion.ts`. Only
  `transform`/`opacity` (plus background tints and a small exit blur). CSS handles hovers and simple
  loops/one-shots (spinner, copy check line-drawing, `[data-flash]` tints).
- Shared elements: the same `layoutId` (from `ids`) on both pages, `layoutCrossfade={false}`, and
  `borderRadius` as an inline px style so Motion corrects it during the morph. Never fade an ancestor
  of a `layoutId` element (it would fade the morph); sections that aren't shared use `fadeIn`.
- Only morph things of similar size that sit close together (row ↔ detail header, row name ↔ editor
  heading). Long flights read as chaos: the header's New webhook button is across the screen from the
  editor, so /new shares nothing: the backdrop fades in and the dialog rises. Layout morphs scale the
  box, so a button-to-panel or row-to-form morph stretches badly; there, share the label/name text
  instead and let the panel enter on its own (rise + fade). Keep any element's scale under ~1.3×.
- Route changes go through `AnimatePresence mode="popLayout"` with `pageTransition` variants:
  between nav sections (Webhooks → Events → Help) pages slide by `routeDirection`; within a section
  they don't move, and shared elements carry the change.
- Keyboard-initiated closes (Esc via `useEscape`, `navigate(to, { instant: true })`) never animate.
- Reduced motion: `<MotionConfig reducedMotion="user">` at the root drops movement and layout
  animation; where movement is the only signal of an enter/exit, components branch on
  `useReducedMotion()` to an opacity-only variant. Decorative motion (confetti) is skipped.
- Springs with bounce are for success/delight only. Errors are quiet: faint red tint
  (`flash(el, "error")`). No shakes.
- Hovers: only behind `(hover: hover) and (pointer: fine)`; color/glow (`box-shadow`) always, movement
  only without reduced motion, via the individual `scale`/`translate` properties so they stack with
  Motion's inline `transform`. Buttons grow 2%; no hover on things you can't interact with.
- Phones: `(pointer: coarse)` gets 16px text in every field (iOS Safari zooms into anything
  smaller, CodeMirror included) and ~40px tap targets (buttons and nav 40px, menu rows 44px, the
  switch keeps its look and gets a bigger invisible hit area). Under 640px (`useNarrow()`) the
  "Send when" popovers are bottom sheets with a Done button (no close on scroll/resize there: the
  keyboard opening for "Add a name" resizes the page), the New webhook modal is full-screen, and
  name/URL stack. Padding uses `env(safe-area-inset-*)` (`viewport-fit=cover`, translucent iOS
  status bar), including the sticky editor bar and the toast.
- Home screen: `public/manifest.webmanifest` + `public/icons/` (`icon.svg` is the source; the PNGs
  are renders of it at 192, 512 and 180 for iOS). `index.html` links them with relative paths so
  Bun bundles them; the manifest's own icon URLs (`/icons/icon-*.png`) are routes in `src/app.ts`.
- Look: borderless lit blocks on dark navy, HUD cyan accent with glow, static grid floor background.
  Space Grotesk for text, Space Mono for data only. Avoid AI-isms: no left accent bars, no uppercase
  letter-spaced labels, no explanatory filler copy (prefer "optional" tags and placeholders),
  sentence case everywhere.
- Delete is instant with an Undo toast (server delete after 5s).

## Not done yet (ideas, roughly by value)

- Export/import webhooks (backups, moving to another install).
