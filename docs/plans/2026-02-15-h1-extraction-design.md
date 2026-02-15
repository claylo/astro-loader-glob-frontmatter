# H1 Extraction Design

## Goal

Extract the first `# Title` from markdown content, inject it as `title` in frontmatter data, and strip it from the body. Enables natural markdown authoring where `# My Title` at the top of the file renders correctly on GitHub and automatically populates the `title` frontmatter field.

## Behavior

Given:

```markdown
---
draft: true
---

# My Post Title

Some content here...
```

The loader will:

1. Extract `"My Post Title"` from the first `# ...` line
2. Inject `{ title: "My Post Title" }` into frontmatter data if `title` is not already set
3. Strip the `# My Post Title` line and adjacent blank lines from the stored body

Always on. No opt-in flag.

## Merge Cascade

```
centralized file → per-directory file → H1 title → in-file frontmatter
```

In-file frontmatter `title` wins over H1. H1 wins over external frontmatter `title`.

## Architecture: Two Intercepts (Approach A)

Astro's glob loader splits frontmatter from body internally. `parseData` only receives frontmatter data and `filePath` — no body. The body appears later in `store.set()`. Two interception points are required:

### 1. `parseData` wrapper (title injection)

- Already exists for frontmatter merge
- Extended: read file via `readFileSync(filePath)`, call `extractH1()`, inject `title` into merged data if not present
- Happens before schema validation, so `title: z.string()` passes

### 2. `store.set` wrapper (body stripping)

- New interception point
- Strip H1 from `entry.body` (raw markdown)
- Strip `<h1>` from `entry.rendered.html`
- Remove depth-1 entry from `entry.rendered.metadata.headings`

## New Module: `src/h1.ts`

Two pure functions:

- `extractH1(markdown: string): { title: string; body: string } | null` — finds first H1, returns plain-text title and body with H1 stripped. Returns null if no H1.
- `stripH1Html(html: string): string` — removes first `<h1>...</h1>` from rendered HTML.

## H1 Extraction Rules

- Match the first ATX heading at depth 1: `# Title`
- Must appear before any non-blank, non-heading content (at the top of the body)
- Inline markdown (`# My **Bold** Title`) flattened to plain text for the `title` field
- No H1 found → no-op

## Edge Cases

- **No H1**: pass through unchanged
- **H1 not first content**: don't extract — a heading buried in the document is content, not a title
- **Multiple H1s**: only the first is extracted/stripped
- **Blank lines around H1**: strip H1 line plus any single trailing blank line; leading blank lines before H1 consumed
- **`retainBody: false`**: guard against undefined `entry.body` in `store.set`
- **Double-read**: `parseData` reads the file a second time (glob already read it). Trivial cost.
