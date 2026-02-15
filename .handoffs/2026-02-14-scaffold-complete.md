# Handoff: Scaffold Complete, Ready for Tasks 2-9

## Current State

**Branch:** `feat/readability-on-github-matters`
**Last commit:** `7922989` — `feat: project scaffold`

Project scaffold is done: package.json, tsconfig, vitest config, .gitignore, pnpm install complete. Design doc and implementation plan are in `docs/plans/`.

## What's Done

- Task 1: Project scaffold — **COMPLETE**

## What Remains (Tasks 2-9)

Execute the implementation plan at `docs/plans/2026-02-14-implementation-plan.md`.

| Task | What | Status |
|------|------|--------|
| 2 | Deep merge + strategy (TDD) — `src/merge.ts`, `test/merge.test.ts` | pending |
| 3 | Central file parsing (TDD) — `src/frontmatter-map.ts`, fixtures | pending |
| 4 | Per-directory discovery (TDD) — add to frontmatter-map.ts | pending |
| 5 | Combined map loader (TDD) — `loadFrontmatterMap` | pending |
| 6 | Main loader (TDD) — `src/index.ts`, mock glob, parseData interception | pending |
| 7 | Integration test — central + per-dir + file, all strategies | pending |
| 8 | Dev file watching — watcher.add for frontmatter files | pending |
| 9 | Build verification — tsc, verify dist/ exports | pending |

## Execution Approach

Using **Subagent-Driven Development**: dispatch fresh subagent per task, two-stage review (spec compliance then code quality) after each.

The plan has full code for every task — tests first, then implementation. Follow TDD.

## Key Files

| File | What |
|------|------|
| `docs/plans/2026-02-14-design.md` | Full design doc |
| `docs/plans/2026-02-14-implementation-plan.md` | Step-by-step implementation plan with all code |
| `package.json` | ESM, astro peer dep, yaml dep, vitest |
| `tsconfig.json` | ES2022, bundler resolution, strict, dist/ output |
| `vitest.config.ts` | test/**/*.test.ts pattern |

## User Preferences

- **pnpm** (not npm/yarn)
- Conventional commits, user runs own `git commit` with `commit.txt`
- Concise, direct communication
- TDD throughout

## Commands

```bash
pnpm test        # vitest run
pnpm build       # tsc
pnpm test:watch  # vitest (watch mode)
```
