---
name: github-issue
description: Writing and filing GitHub issues for mediahooks with gh, including the body structure, titles, grouping, labels, and duplicate checks.
---

# Writing a GitHub issue

Issues go to `matthewlyle/mediahooks` on GitHub. `origin` fetches from Gitea, so always pass
`-R matthewlyle/mediahooks`.

## Before filing

- Collect every finding first and show the user the list (title and a one-line summary each).
  Don't file until they approve. They may cut, merge or reword findings.
- Check for duplicates: `gh issue list -R matthewlyle/mediahooks --state all --search "<keywords>"`.
  If a match is open, tell the user and don't file a second one.
- Group by problem, not by place. When the same problem shows up in several places, file one
  issue and list every location. Split only when the fixes are unrelated. Each issue should be
  one changelog line and one reviewable PR.
- Every issue gets `agent`, a topic label (such as `accessibility`), one `severity: <level>`
  label matching the body's severity, and one verification label:
  - `verified: browser`: reproduced in a running app.
  - `verified: code`: found by reading code and not yet reproduced.
- Add `review: design` when the fix changes how the app looks or needs a UX decision. For a
  batch of related issues, put them in a milestone named for the release they ship in, and mark
  real ordering with issue dependencies
  (`gh api -X POST repos/<repo>/issues/<n>/dependencies/blocked_by -F issue_id=<database id>`).
- Use labels that already exist (`gh label list -R matthewlyle/mediahooks`). Don't create other
  labels unless the user asks.

## Title

`<Area>: <problem>`, in sentence case, with no trailing period. Name the problem, not the fix.

- `Webhook editor: icon-only buttons have no accessible name`
- `App-wide: focus ring invisible on dark surfaces`

Use `App-wide` as the area when the problem shows up on several pages.

## Body

Use these sections in this order. Omit a section only if it says it's optional. Keep every
section short: fragments are fine, one line per item, no narration or hedging. Description and
Actual are one or two sentences each; aim for under about 150 words before Reference.

```markdown
## Description
One or two sentences: what's wrong and who it affects.

**Severity:** blocker | serious | moderate | minor

## Where
- `/route` — `public/path/File.tsx:123` (component or element)
- one line per location

## Steps to reproduce
1. Concrete, numbered steps from a fresh page load.
2. Include the input method (mouse, keyboard, screen reader, narrow viewport).

## Expected
What should happen.

## Actual
What happens now. Quote exact output, announcements, or values where there are any.

## Success criteria
- [ ] A checkable statement someone can verify by doing it, such as "Tab reaches X" or
      "the response is 404".
- [ ] One checkbox per location or behavior when there are several.

## Reference
[Spec section, name, level](https://link) — the standard, spec or doc that defines the
expected behavior.
```

The success criteria have to be testable. "Is accessible" or "works correctly" isn't a
criterion; "VoiceOver announces 'Delete webhook, button'" is.

Screenshots: if the problem was confirmed by looking at it, add an `**Evidence**` block at the
end of Actual with before and after images, or a single image. `gh` can't upload images. Commit
PNGs to the orphan `issue-assets` branch under `<topic>/<issue>-<what>.png`, push only with the
user's OK, and link them as
`https://raw.githubusercontent.com/matthewlyle/mediahooks/issue-assets/<topic>/<file>.png`.

Severity:

- blocker: the task can't be done at all.
- serious: the task can be done, but only with real difficulty or a workaround.
- moderate: the task is noticeably degraded.
- minor: polish.

## Filing

Don't hard-wrap prose: GitHub turns every newline in an issue, PR or comment body into a line
break. Write one line per paragraph or list item. This applies to PR bodies too, so don't reuse a
wrapped commit message as the body (`gh pr create --fill` does exactly that).

Write the body to a file so Markdown doesn't get mangled by shell quoting:

```sh
gh issue create -R matthewlyle/mediahooks \
  --title "Area: problem" \
  --label agent --label <topic> --label "severity: <level>" --label "verified: <browser|code>" \
  --body-file /tmp/issue-<slug>.md
```

When filing a batch, file them one at a time, collect each URL `gh` prints, and report all the
URLs to the user at the end. Delete the temp body files afterwards.
