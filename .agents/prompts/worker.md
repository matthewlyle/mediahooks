Fix GitHub issue #{N} in matthewlyle/mediahooks: `gh issue view {N} -R matthewlyle/mediahooks`. The issue body is the spec; its success criteria are your acceptance test. Follow AGENTS.md.

- You're in your own worktree; its branch (`git branch --show-current`) is yours. Run `bun install` first.
- Every `gh` command needs `-R matthewlyle/mediahooks` (`origin` is Gitea).
- Run the dev server only as `AUTH=off PORT={PORT} bun --hot src/server.ts` (never `bun run dev`; port 8788 belongs to someone else).
- Reproduce the problem in a browser first, then fix it, then re-check every success-criteria item in the browser. For a CI or workflow issue, reproduce and verify with real Actions runs instead: a throwaway probe PR from an `issue-{N}-probe` branch shows what runs or skips; close it and delete the branch when done.
- Don't change repository settings (rulesets, required checks, secrets). If a criterion needs one, say so in a `> [!WARNING]` **Not checked:** callout in the PR body.
- Run `bun test` and `bun run typecheck`; both must pass.
- If you changed anything under `public/`, run `bun x playwright test -c test/axe` (needs `bun x playwright install chromium` once) and fix what it reports before opening the PR. A new route or state gets a scan in `test/axe/axe.spec.ts`.
- Stay within this issue. Don't touch other issues' code or `CHANGELOG.md`.
- Commit with a Conventional Commit message whose scope matches the issue's topic (`fix(a11y): …` for `accessibility` issues), with `Fixes #{N}` in the body. The PR title is the same line; release-please puts the scope in the changelog.
- You're explicitly asked to push your branch to origin and open a pull request: title is the Conventional Commit. Before pushing, merge the latest `main` (`git fetch git@github.com:matthewlyle/mediahooks.git main && git merge FETCH_HEAD`; force-pushes are blocked) and re-run the checks. Write the body yourself (never `gh pr create --fill`), using exactly the PR body template in `.agents/skills/work-issue/SKILL.md` under "Writing for GitHub". If anything visible changed or must look unchanged, add before/after screenshots: commit PNGs to the `issue-assets` branch under `pr/<issue>-<what>.png` (fetch and rebase it first; other agents push to it too) and link `https://raw.githubusercontent.com/matthewlyle/mediahooks/issue-assets/pr/<file>.png`. After pushing, confirm the PR's head commit equals your local HEAD. Never merge it.
- Finish with a short report: what you changed, the PR URL, and how each success criterion was verified.
