# Handoff: H1 Extraction Feature Complete

## Current State

**Branch:** `feat/h1-extraction` — merged to `main`, released to npm.
**Everything is done.** The feature was designed, implemented via TDD with subagent-driven development, code-reviewed twice (internal + external), and all review items addressed.

The loader now extracts the first `# Title` from markdown files, injects it as `title` in frontmatter data, and strips it from the body/rendered HTML. This enables natural markdown authoring where files look correct on GitHub and automatically populate Astro's `title` schema field.

## What's Done

- **`src/h1.ts`** — `extractH1()` (markdown → title + stripped body) and `stripH1Html()` (HTML h1 removal). Pure functions, no side effects.
- **`src/index.ts`** — Two interception points: `parseData` wrapper reads file and injects H1 as title; `store.set` wrapper strips H1 from body, rendered HTML, and heading metadata.
- **62 tests** across 5 test files, all passing.
- **README** updated with "Title from H1" section and four-layer merge cascade.
- **Code review fixes:**
  - ReDoS in `H1_RE` fixed (`\s*\n` → `[^\S\n]*\n` — horizontal whitespace only)
  - HTML stripping gated on `extractH1` match (buried `<h1>` tags left alone)
  - Frontmatter fence parsing uses line-anchored regex (handles `---` in YAML values)
  - Path resolution uses `rootDir` not `basePath` (filePath is relative to Astro root)

## Next Steps

- **Nothing blocking.** Feature is shipped as part of a new npm release.
- **Real-world integration test** remains the same open item from v0.1.0 — the loader has only been tested with mocked `glob()`, not against a real Astro project.
- **Design doc** (`docs/plans/2026-02-15-h1-extraction-design.md`) and **implementation plan** (`docs/plans/2026-02-15-h1-extraction-plan.md`) are committed and accurate.

## Key Files

| File | What |
|------|------|
| `src/index.ts` | Main loader — `globFrontmatter()`, parseData + store.set wrappers |
| `src/h1.ts` | `extractH1`, `stripH1Html`, `flattenInlineMarkdown` (private) |
| `src/merge.ts` | `deepMerge` with `__proto__` guard |
| `src/frontmatter-map.ts` | Central/per-dir frontmatter loading |
| `test/loader.test.ts` | 16 tests, mocked glob with store.set |
| `test/h1.test.ts` | 19 tests for extractH1 + stripH1Html |
| `README.md` | Full package docs including H1 extraction |
| `commit.txt` | PR description for the H1 extraction feature |
| `scratch/2026-02-15-h1-extraction-review.md` | External code review that drove the final fixes |

## Gotchas

- **`@types/node@25`** changed `readdirSync` with `withFileTypes: true` to return `Dirent<Buffer>` by default. Must pass `encoding: 'utf-8'` to get `Dirent<string>`.
- **Astro's `config.root`** is typed as `URL`. Use `.toString()` before `fileURLToPath()`.
- **`props.filePath`** from glob is relative to Astro root, not to `base`. Use `resolve(rootDir, props.filePath)`, not `resolve(basePath, props.filePath)`.
- **ReDoS risk with `\s` and `\n`** — `\s` matches newlines in JS, so `\s*\n` creates exponential backtracking. Use `[^\S\n]` for horizontal-only whitespace.
- **`store.set` timing** — runs after `parseData` and after rendering. Body and rendered HTML are both available. Must wrap store on `wrappedContext` before calling `glob().load()`.
- **v8 coverage** reports phantom branches on `??` and ternary operators. 100% lines/functions achievable; 100% branches is not worth chasing.

## What Worked / Didn't Work

**Worked:**
- Subagent-driven development with spec + quality reviews per task — caught the path resolution bug and kept quality high
- Two-intercept architecture (parseData for data, store.set for body) — only viable approach given Astro's API
- External code review caught ReDoS and unconditional HTML stripping bug — both real issues
- `[^\S\n]` is the clean idiom for "horizontal whitespace only" in JS regex

**Didn't work / required fixes:**
- Plan's `resolve(basePath, props.filePath)` doubled the base directory — subagent caught and fixed to `resolve(rootDir, props.filePath)`
- Original `\s*\n` in H1_RE was a ReDoS vector — not caught until external review
- `store.set` initially stripped HTML unconditionally — needed to gate on `extractH1` result

## Commands

```bash
pnpm test           # vitest run (62 tests)
pnpm test:watch     # vitest watch mode
pnpm test:coverage  # vitest + v8 coverage
pnpm build          # tsc → dist/
```
