# H1 Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the first `# Title` from markdown files, inject it as `title` in frontmatter data, and strip it from the body content.

**Architecture:** Two interception points in `src/index.ts` — extend existing `parseData` wrapper to read the file and inject title, add new `store.set` wrapper to strip H1 from body and rendered HTML. Pure extraction logic lives in new `src/h1.ts` module.

**Tech Stack:** TypeScript, vitest, Astro loader API (`parseData`, `store.set`)

---

### Task 1: `extractH1` — basic extraction (test + implement)

**Files:**
- Create: `test/h1.test.ts`
- Create: `src/h1.ts`

**Step 1: Write the failing tests**

```typescript
// test/h1.test.ts
import { describe, it, expect } from 'vitest'
import { extractH1 } from '../src/h1.js'

describe('extractH1', () => {
  it('extracts H1 and strips it from body', () => {
    const md = '# My Title\n\nSome content here.'
    const result = extractH1(md)
    expect(result).toEqual({
      title: 'My Title',
      body: 'Some content here.',
    })
  })

  it('handles leading blank lines before H1', () => {
    const md = '\n\n# My Title\n\nContent.'
    const result = extractH1(md)
    expect(result).toEqual({
      title: 'My Title',
      body: 'Content.',
    })
  })

  it('strips single trailing blank line after H1', () => {
    const md = '# Title\n\nParagraph one.\n\nParagraph two.'
    const result = extractH1(md)
    expect(result).toEqual({
      title: 'Title',
      body: 'Paragraph one.\n\nParagraph two.',
    })
  })

  it('returns null when no H1 present', () => {
    const md = '## Subtitle\n\nContent.'
    expect(extractH1(md)).toBeNull()
  })

  it('returns null when H1 is not the first content', () => {
    const md = 'Some text first.\n\n# Title After Content'
    expect(extractH1(md)).toBeNull()
  })

  it('only extracts the first H1 when multiple exist', () => {
    const md = '# First\n\n# Second\n\nContent.'
    const result = extractH1(md)
    expect(result).toEqual({
      title: 'First',
      body: '# Second\n\nContent.',
    })
  })

  it('flattens inline markdown to plain text', () => {
    const md = '# My **Bold** and *Italic* Title\n\nContent.'
    const result = extractH1(md)
    expect(result?.title).toBe('My Bold and Italic Title')
  })

  it('flattens inline code to plain text', () => {
    const md = '# Using `async/await` in Node\n\nContent.'
    const result = extractH1(md)
    expect(result?.title).toBe('Using async/await in Node')
  })

  it('flattens links to plain text', () => {
    const md = '# The [Astro](https://astro.build) Loader\n\nContent.'
    const result = extractH1(md)
    expect(result?.title).toBe('The Astro Loader')
  })

  it('returns empty body when file is only an H1', () => {
    const md = '# Just a Title'
    const result = extractH1(md)
    expect(result).toEqual({ title: 'Just a Title', body: '' })
  })

  it('preserves body when H1 has no trailing blank line', () => {
    const md = '# Title\nImmediate content.'
    const result = extractH1(md)
    expect(result).toEqual({
      title: 'Title',
      body: 'Immediate content.',
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test -- test/h1.test.ts`
Expected: FAIL — module `../src/h1.js` not found

**Step 3: Write minimal implementation**

```typescript
// src/h1.ts

/**
 * Match a leading `# Title` line. The H1 must appear before any
 * non-blank content. Leading blank lines are allowed.
 *
 * Capture group 1 = raw heading text (may contain inline markdown).
 */
const H1_RE = /^(?:\s*\n)*# (.+)\n?(\n?)/

/** Strip bold, italic, code, images, and links down to plain text. */
function flattenInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')   // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')     // links
    .replace(/(\*\*|__)(.*?)\1/g, '$2')          // bold
    .replace(/(\*|_)(.*?)\1/g, '$2')             // italic
    .replace(/~~(.*?)~~/g, '$1')                 // strikethrough
    .replace(/`([^`]+)`/g, '$1')                 // inline code
    .trim()
}

export function extractH1(markdown: string): { title: string; body: string } | null {
  const match = H1_RE.exec(markdown)
  if (!match) return null

  const rawTitle = match[1]
  const title = flattenInlineMarkdown(rawTitle)
  // Remove the H1 line and at most one trailing blank line
  const body = markdown.slice(match[0].length).replace(/^\n/, '')

  return { title, body }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test -- test/h1.test.ts`
Expected: all 11 tests PASS

**Step 5: Commit**

```bash
git add src/h1.ts test/h1.test.ts
git commit -m "feat: add extractH1 with inline markdown flattening"
```

---

### Task 2: `stripH1Html` — HTML stripping (test + implement)

**Files:**
- Modify: `test/h1.test.ts`
- Modify: `src/h1.ts`

**Step 1: Write the failing tests**

Add to `test/h1.test.ts`:

```typescript
import { extractH1, stripH1Html } from '../src/h1.js'

// ... existing extractH1 tests ...

describe('stripH1Html', () => {
  it('removes first <h1> tag from HTML', () => {
    const html = '<h1>My Title</h1>\n<p>Content.</p>'
    expect(stripH1Html(html)).toBe('<p>Content.</p>')
  })

  it('only removes the first <h1>', () => {
    const html = '<h1>First</h1>\n<h1>Second</h1>\n<p>Content.</p>'
    expect(stripH1Html(html)).toBe('<h1>Second</h1>\n<p>Content.</p>')
  })

  it('handles <h1> with attributes', () => {
    const html = '<h1 id="title" class="big">Title</h1>\n<p>Rest.</p>'
    expect(stripH1Html(html)).toBe('<p>Rest.</p>')
  })

  it('handles <h1> with inline HTML elements', () => {
    const html = '<h1>My <strong>Bold</strong> Title</h1>\n<p>Rest.</p>'
    expect(stripH1Html(html)).toBe('<p>Rest.</p>')
  })

  it('returns HTML unchanged when no <h1> present', () => {
    const html = '<h2>Subtitle</h2>\n<p>Content.</p>'
    expect(stripH1Html(html)).toBe('<h2>Subtitle</h2>\n<p>Content.</p>')
  })

  it('strips trailing newline after removed <h1>', () => {
    const html = '<h1>Title</h1>\n\n<p>Content.</p>'
    expect(stripH1Html(html)).toBe('<p>Content.</p>')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test -- test/h1.test.ts`
Expected: FAIL — `stripH1Html` is not exported

**Step 3: Write minimal implementation**

Add to `src/h1.ts`:

```typescript
const H1_HTML_RE = /<h1[^>]*>[\s\S]*?<\/h1>\n*/

export function stripH1Html(html: string): string {
  return html.replace(H1_HTML_RE, '')
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test -- test/h1.test.ts`
Expected: all 17 tests PASS

**Step 5: Commit**

```bash
git add src/h1.ts test/h1.test.ts
git commit -m "feat: add stripH1Html for rendered content"
```

---

### Task 3: `parseData` wrapper — inject title from H1

**Files:**
- Modify: `src/index.ts`
- Modify: `test/loader.test.ts`

**Context:**
- `parseData` receives `{ id, data, filePath }` — `filePath` is relative to `base`
- Need to resolve `filePath` to absolute path, read the file, extract H1
- The file contains frontmatter fences + body — `extractH1` should be called on the body portion only (after the closing `---`)
- The `data` object already has frontmatter parsed — if `data.title` exists, skip H1 injection

**Step 1: Write the failing tests**

Add to `test/loader.test.ts` mock — make the mock glob loader also emit an entry whose file we can read. Create a fixture file for this:

Create fixture: `test/fixtures/per-dir/docs/guides/with-h1.md`

```markdown
---
draft: true
---

# Installation Guide

Follow these steps to install.
```

Update the `vi.mock` in `test/loader.test.ts` to add an entry that uses this fixture:

```typescript
vi.mock('astro/loaders', () => ({
  glob: vi.fn((_opts: unknown) => ({
    name: 'glob',
    load: async (context: {
      parseData: (props: { id: string; data: Record<string, unknown>; filePath?: string }) => Promise<unknown>
      store: { set: (entry: Record<string, unknown>) => boolean }
    }) => {
      await context.parseData({
        id: 'guides/installation',
        data: { title: 'From File', draft: true },
        filePath: 'docs/guides/installation.md',
      })
      await context.parseData({
        id: 'components/readme',
        data: { title: 'File Overview' },
        filePath: 'docs/components/README.md',
      })
      await context.parseData({
        id: 'no-external',
        data: { title: 'Standalone' },
        filePath: 'docs/standalone.md',
      })
      // Entry with H1 in the file, no title in frontmatter data
      await context.parseData({
        id: 'guides/with-h1',
        data: { draft: true },
        filePath: 'docs/guides/with-h1.md',
      })
      // Entry with H1 in file AND title in frontmatter
      await context.parseData({
        id: 'guides/with-h1-and-title',
        data: { title: 'Frontmatter Title', draft: true },
        filePath: 'docs/guides/with-h1.md',
      })
    },
  })),
}))
```

Add these tests inside the `describe('globFrontmatter')`:

```typescript
  it('injects H1 as title when frontmatter has no title', async () => {
    const { context, captured } = makeMockContext()
    const loader = globFrontmatter({ pattern: '**/*.md', base: './docs' })
    await loader.load(context as never)

    const entry = captured.find((e) => e.id === 'guides/with-h1')!
    expect(entry.data.title).toBe('Installation Guide')
    expect(entry.data.draft).toBe(true)
  })

  it('frontmatter title wins over H1', async () => {
    const { context, captured } = makeMockContext()
    const loader = globFrontmatter({ pattern: '**/*.md', base: './docs' })
    await loader.load(context as never)

    const entry = captured.find((e) => e.id === 'guides/with-h1-and-title')!
    expect(entry.data.title).toBe('Frontmatter Title')
  })
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test -- test/loader.test.ts`
Expected: FAIL — `entry.data.title` is undefined for the `guides/with-h1` entry

**Step 3: Create fixture file and implement**

Create `test/fixtures/per-dir/docs/guides/with-h1.md`:

```markdown
---
draft: true
---

# Installation Guide

Follow these steps to install.
```

Modify `src/index.ts` — add import and extend `parseData` wrapper:

```typescript
import { readFileSync } from 'node:fs'
import { extractH1 } from './h1.js'
```

In the `parseData` wrapper, after the `deepMerge` call:

```typescript
            // Extract H1 from file body as title if not already set
            if (!merged.title) {
              try {
                const raw = readFileSync(resolve(basePath, props.filePath), 'utf-8')
                // Skip frontmatter fences to get body
                const fenceEnd = raw.indexOf('---', raw.indexOf('---') + 3)
                const body = fenceEnd !== -1 ? raw.slice(fenceEnd + 3) : raw
                const h1 = extractH1(body)
                if (h1) {
                  merged.title = h1.title
                }
              } catch {
                // File read failed — skip H1 extraction
              }
            }
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test -- test/loader.test.ts`
Expected: all tests PASS

**Step 5: Commit**

```bash
git add src/index.ts test/loader.test.ts test/fixtures/per-dir/docs/guides/with-h1.md
git commit -m "feat: inject H1 as title via parseData interception"
```

---

### Task 4: `store.set` wrapper — strip H1 from body and rendered HTML

**Files:**
- Modify: `src/index.ts`
- Modify: `test/loader.test.ts`

**Context:**
- Astro's `LoaderContext` has a `store` property with a `set(entry: DataEntry)` method
- `DataEntry` has: `{ id, data, body?, filePath?, rendered?: { html, metadata? } }`
- `rendered.metadata.headings` is `Array<{ depth, slug, text }>`
- Wrap `store.set` to strip H1 from `body`, `rendered.html`, and filter `rendered.metadata.headings`

**Step 1: Write the failing tests**

Update the mock glob loader to also call `store.set` after `parseData`, simulating what the real glob loader does:

```typescript
vi.mock('astro/loaders', () => ({
  glob: vi.fn((_opts: unknown) => ({
    name: 'glob',
    load: async (context: {
      parseData: (props: { id: string; data: Record<string, unknown>; filePath?: string }) => Promise<unknown>
      store: { set: (entry: Record<string, unknown>) => boolean }
    }) => {
      await context.parseData({
        id: 'guides/installation',
        data: { title: 'From File', draft: true },
        filePath: 'docs/guides/installation.md',
      })
      await context.parseData({
        id: 'components/readme',
        data: { title: 'File Overview' },
        filePath: 'docs/components/README.md',
      })
      await context.parseData({
        id: 'no-external',
        data: { title: 'Standalone' },
        filePath: 'docs/standalone.md',
      })
      await context.parseData({
        id: 'guides/with-h1',
        data: { draft: true },
        filePath: 'docs/guides/with-h1.md',
      })
      await context.parseData({
        id: 'guides/with-h1-and-title',
        data: { title: 'Frontmatter Title', draft: true },
        filePath: 'docs/guides/with-h1.md',
      })

      // Simulate store.set calls with body and rendered content
      context.store.set({
        id: 'guides/with-h1',
        data: { draft: true },
        body: '# Installation Guide\n\nFollow these steps to install.',
        rendered: {
          html: '<h1>Installation Guide</h1>\n<p>Follow these steps to install.</p>',
          metadata: {
            headings: [
              { depth: 1, slug: 'installation-guide', text: 'Installation Guide' },
              { depth: 2, slug: 'step-one', text: 'Step One' },
            ],
          },
        },
      })
      context.store.set({
        id: 'no-h1',
        data: { title: 'No H1' },
        body: '## Just a subtitle\n\nContent.',
        rendered: {
          html: '<h2>Just a subtitle</h2>\n<p>Content.</p>',
          metadata: {
            headings: [{ depth: 2, slug: 'just-a-subtitle', text: 'Just a subtitle' }],
          },
        },
      })
      context.store.set({
        id: 'no-body',
        data: { title: 'No Body' },
      })
    },
  })),
}))
```

Update `makeMockContext` to include a mock store:

```typescript
function makeMockContext() {
  const captured: Array<{ id: string; data: Record<string, unknown> }> = []
  const stored: Array<Record<string, unknown>> = []
  return {
    captured,
    stored,
    context: {
      config: { root: rootUrl },
      parseData: vi.fn(async (props: { id: string; data: Record<string, unknown> }) => {
        captured.push({ id: props.id, data: props.data })
        return props.data
      }),
      store: {
        set: vi.fn((entry: Record<string, unknown>) => {
          stored.push(entry)
          return true
        }),
      },
      watcher: undefined,
    },
  }
}
```

Add these tests:

```typescript
  it('strips H1 from body in store.set', async () => {
    const { context, stored } = makeMockContext()
    const loader = globFrontmatter({ pattern: '**/*.md', base: './docs' })
    await loader.load(context as never)

    const entry = stored.find((e) => e.id === 'guides/with-h1') as Record<string, unknown>
    expect(entry.body).toBe('Follow these steps to install.')
  })

  it('strips <h1> from rendered HTML in store.set', async () => {
    const { context, stored } = makeMockContext()
    const loader = globFrontmatter({ pattern: '**/*.md', base: './docs' })
    await loader.load(context as never)

    const entry = stored.find((e) => e.id === 'guides/with-h1') as Record<string, unknown>
    const rendered = entry.rendered as { html: string }
    expect(rendered.html).toBe('<p>Follow these steps to install.</p>')
  })

  it('filters depth-1 heading from rendered metadata', async () => {
    const { context, stored } = makeMockContext()
    const loader = globFrontmatter({ pattern: '**/*.md', base: './docs' })
    await loader.load(context as never)

    const entry = stored.find((e) => e.id === 'guides/with-h1') as Record<string, unknown>
    const rendered = entry.rendered as { metadata: { headings: Array<{ depth: number }> } }
    expect(rendered.metadata.headings).toEqual([
      { depth: 2, slug: 'step-one', text: 'Step One' },
    ])
  })

  it('does not modify body when no H1 present', async () => {
    const { context, stored } = makeMockContext()
    const loader = globFrontmatter({ pattern: '**/*.md', base: './docs' })
    await loader.load(context as never)

    const entry = stored.find((e) => e.id === 'no-h1') as Record<string, unknown>
    expect(entry.body).toBe('## Just a subtitle\n\nContent.')
  })

  it('handles entries with no body (retainBody: false)', async () => {
    const { context, stored } = makeMockContext()
    const loader = globFrontmatter({ pattern: '**/*.md', base: './docs' })
    await loader.load(context as never)

    const entry = stored.find((e) => e.id === 'no-body') as Record<string, unknown>
    expect(entry.body).toBeUndefined()
  })
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test -- test/loader.test.ts`
Expected: FAIL — store.set entries are not modified (H1 still present in body)

**Step 3: Implement store.set wrapper**

In `src/index.ts`, add import of `stripH1Html`:

```typescript
import { extractH1, stripH1Html } from './h1.js'
```

After the `wrappedContext` creation, before calling `glob(globOpts).load(wrappedContext)`, add `store.set` wrapping:

```typescript
      // Wrap store.set to strip H1 from body and rendered HTML
      const originalSet = context.store.set.bind(context.store)
      wrappedContext.store = Object.create(context.store, {
        set: {
          value: <TData extends Record<string, unknown>>(entry: {
            id: string
            data: TData
            body?: string
            rendered?: {
              html: string
              metadata?: {
                headings?: Array<{ depth: number; slug: string; text: string }>
                [key: string]: unknown
              }
            }
            [key: string]: unknown
          }) => {
            if (entry.body) {
              const h1 = extractH1(entry.body)
              if (h1) {
                entry.body = h1.body
              }
            }
            if (entry.rendered) {
              entry.rendered.html = stripH1Html(entry.rendered.html)
              if (entry.rendered.metadata?.headings) {
                const headings = entry.rendered.metadata.headings
                if (headings.length > 0 && headings[0].depth === 1) {
                  entry.rendered.metadata.headings = headings.slice(1)
                }
              }
            }
            return originalSet(entry)
          },
        },
      })
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test -- test/loader.test.ts`
Expected: all tests PASS

**Step 5: Run full test suite**

Run: `pnpm test`
Expected: all tests PASS (h1, loader, merge, frontmatter-map, integration)

**Step 6: Commit**

```bash
git add src/index.ts test/loader.test.ts
git commit -m "feat: strip H1 from body and rendered HTML via store.set"
```

---

### Task 5: Integration test — full cascade with H1

**Files:**
- Modify: `test/integration.test.ts`
- Create: `test/fixtures/combined/docs/components/with-h1.md` (fixture)

**Step 1: Create fixture**

Create `test/fixtures/combined/docs/components/with-h1.md`:

```markdown
---
draft: true
---

# Accordion Widget

The accordion component expands and collapses content sections.
```

**Step 2: Write the failing test**

Update the mock in `test/integration.test.ts` to add an entry for the H1 file and a store mock:

Add to the mock's `load` function:

```typescript
      await context.parseData({
        id: 'components/with-h1',
        data: { draft: true },
        filePath: 'docs/components/with-h1.md',
      })
```

Add store mock to the context:

```typescript
    const stored: Array<Record<string, unknown>> = []
    const context = {
      config: { root: rootUrl },
      parseData: vi.fn(async (props: { id: string; data: Record<string, unknown> }) => {
        captured.push({ id: props.id, data: props.data })
        return props.data
      }),
      store: {
        set: vi.fn((entry: Record<string, unknown>) => {
          stored.push(entry)
          return true
        }),
      },
      watcher: undefined,
    }
```

Add the test:

```typescript
  it('H1 title fills in when frontmatter has no title, external frontmatter merges', async () => {
    // ... setup with mock context ...
    const entry = captured.find((e) => e.id === 'components/with-h1')!
    // H1 becomes title (no title in file frontmatter or per-dir for this file)
    // External frontmatter from central file may provide other fields
    expect(entry.data.title).toBe('Accordion Widget')
    expect(entry.data.draft).toBe(true)
  })
```

**Step 3: Run test to verify it fails**

Run: `pnpm test -- test/integration.test.ts`
Expected: FAIL

**Step 4: Create fixture file and verify pass**

The fixture file and the `src/index.ts` changes from Task 3 should make this pass.

Run: `pnpm test -- test/integration.test.ts`
Expected: PASS

**Step 5: Run full suite**

Run: `pnpm test`
Expected: all tests PASS

**Step 6: Commit**

```bash
git add test/integration.test.ts test/fixtures/combined/docs/components/with-h1.md
git commit -m "test: integration test for H1 extraction in full cascade"
```

---

### Task 6: Update README

**Files:**
- Modify: `README.md`

**Step 1: Add H1 extraction section to README**

After the "Merge Cascade" section and before "Dev Mode", add:

```markdown
## Title from H1

The loader automatically extracts the first `# Heading` from your markdown content and uses it as the `title` field. This means you can write natural markdown that looks good on GitHub:

\`\`\`markdown
---
sidebar:
  order: 3
---

# Accordion

The accordion component expands and collapses content.
\`\`\`

The `# Accordion` heading becomes `title: "Accordion"` in your frontmatter data, and is stripped from the rendered body to prevent duplication.

**Rules:**
- The H1 must be the first non-blank content after frontmatter
- If frontmatter already has a `title` field, the in-file title wins (H1 is still stripped from the body)
- Inline markdown in the heading (`# My **Bold** Title`) is flattened to plain text
- Only the first H1 is extracted — subsequent H1s are left in the body
```

Update the merge cascade diagram to include H1:

```markdown
## Merge Cascade

Four layers, from broadest to most specific:

\`\`\`
centralized file  →  per-directory file  →  H1 title  →  in-file frontmatter
   (broadest)        (directory-scoped)     (from body)    (most specific)
\`\`\`
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document H1 title extraction in README"
```

---

### Task 7: Build and verify

**Step 1: Run full test suite**

Run: `pnpm test`
Expected: all tests PASS

**Step 2: Build**

Run: `pnpm build`
Expected: clean compile, no errors

**Step 3: Commit any remaining changes**

If build output changed:

```bash
git add dist/
git commit -m "chore: rebuild dist"
```
