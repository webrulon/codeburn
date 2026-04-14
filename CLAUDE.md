# CodeBurn Development Rules

## Verification
- NEVER commit without running locally first and confirming it works
- Run `npx tsx src/cli.ts report` and `npx tsx src/cli.ts today` to verify changes before any commit
- For dashboard changes: run the interactive TUI and visually confirm rendering
- For new features: test the happy path AND edge cases (empty data, missing config, pipe mode)

## Code Quality
- Clean, minimal code. No dead code, no commented-out blocks, no TODO placeholders
- No emoji anywhere in the codebase
- No em dashes. Use hyphens or rewrite the sentence
- No AI slop: no "streamline", "leverage", "robust", "seamless" in user-facing text
- No unnecessary abstractions. Three similar lines > premature helper function

## Accuracy
- Every user-facing number (cost, tokens, calls) must be verified against real data
- LiteLLM pricing model names must match exactly. No guessing model IDs
- Date range calculations must be tested with edge cases (month boundaries, billing day > days in month)

## Style
- TypeScript strict mode. No `any` types
- No comments unless the WHY is non-obvious
- Imports: node builtins first, then deps, then local (separated by blank line)
- Single quotes, no semicolons inconsistency (follow existing: no trailing semicolons in most files)

## Git

### Branching (strict)
- NEVER commit directly to main. All work happens on branches
- Branch naming: `feat/<name>`, `fix/<name>`, `chore/<name>`, `docs/<name>`
- Merge to main ONLY after: tests pass, CLI verified, manual testing done
- npm publish ONLY from main after merge
- Tag releases: `git tag v0.X.0` after publish

### Creating a branch
```bash
git checkout main && git pull origin main
git checkout -b feat/my-feature
# work, test, iterate
npx vitest run
npx tsx src/cli.ts report
# when ready:
git checkout main && git merge feat/my-feature
git push origin main
```

### Handling external PRs
```bash
gh pr checkout <number>           # checkout PR locally
npx vitest run                    # test their code
npx tsx src/cli.ts report         # manual verification
# apply patches if needed, commit on their branch
git checkout main
git merge <branch>                # preserves their authorship
git push origin main
gh pr comment <number> --body "Merged, thanks!"
```

### Commit rules
- Commits from: AgentSeal <hello@agentseal.org>
- NEVER add Co-Authored-By lines
- NEVER include personal names or usernames in commits
- Small, focused commits. One feature per commit
- Test locally before every commit
