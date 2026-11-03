Review pull request #{PR} in matthewlyle/mediahooks, which claims to fix issue #{N}. Read `gh issue view {N}`, `gh pr view {PR}` and `gh pr diff {PR}`. Follow AGENTS.md. You're explicitly asked to post one GitHub review and to label or queue a merge as described below; nothing else on GitHub.

Check, and re-run what you can rather than trusting the PR body:
- Every success criterion in the issue is met. For an app change, run the branch (`AUTH=off PORT={PORT} bun --hot src/server.ts`) and check each criterion in a browser. For a CI or workflow change, check real Actions runs (`gh run list`, `gh run view --log`), including any closed probe PRs the worker opened.
- A criterion that needs a repository setting (rulesets, required checks) can't be met by the PR. Don't change settings; put it under **Your call**.
- A criterion phrased "VoiceOver announces…" counts as checked when the `voiceover` job on the PR passed with the expected phrase in its `spoken-phrase-log` artifact (`gh run download <run> -n spoken-phrase-log`). A fix with a VoiceOver criterion should add a scenario for it in `test/screen-reader/`; a missing scenario is a fix, but a flaky run (Playwright reports it as flaky, or it passed only on a rerun) sends that criterion to a person.
- In the browser, read the page's text and accessibility tree; screenshot only criteria about how something looks.
- Wait for CI with `gh pr checks {PR} -R matthewlyle/mediahooks --watch`, not a `sleep` step per check.
- The diff stays within the issue, follows AGENTS.md, and has no dead code, comments that aren't needed, or unrelated changes.
- `bun test` and `bun run typecheck` pass.
- The `axe` job on the PR passed. That's one check, not proof of accessibility: axe finds only scanner-detectable problems (labels, contrast, ARIA), so still check each criterion by hand.
- The PR body follows the template in "Writing for GitHub" and has screenshots if anything visible changed.

Then decide:
- Merge: the issue has no `review: design` label, you found nothing that needs fixing, and every criterion checked out. A visible change is fine when the PR's screenshots match what you saw. Post a comment review (`gh pr review {PR} --comment`) using the merge template, then `gh pr merge {PR} --auto --squash`. GitHub merges only once the required checks pass. (Agents use the owner's account, which can't approve its own PRs, so the review is a comment.)
- Fix: everything you found is the worker's to fix within the issue (a bug, an unmet criterion, a missing test or screenshot, an out-of-scope change, a stale PR body). Post a comment review using the fix template and don't label or assign; the lead sends your list to the worker and starts a new review on the new head.
- Human: only what needs the owner: the issue has `review: design`, a product or design question the issue doesn't answer, something you couldn't check (a repository setting, a flaky VoiceOver run), or the PR already has two Fix reviews from agents. Post a comment review using the human template, then `gh pr edit {PR} --add-label "review: human" --add-assignee matthewlyle`.
- Never push to the branch or merge directly.

Write the review with the templates in `.agents/skills/work-issue/SKILL.md` under "Writing for GitHub". Also check the PR title still describes the change. Finish with a short report: the decision (Merge, Fix or Human), why, and the review URL.
