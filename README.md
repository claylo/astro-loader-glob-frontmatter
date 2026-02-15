# astro-loader-glob-frontmatter

An Astro content loader that wraps `glob()` and injects frontmatter from external YAML/JSON files—so you can manage metadata for dozens (or hundreds) of content files without touching every single one.

## The Problem

Astro content collections require frontmatter in every markdown file. For a documentation site with 200 pages, that means 200 files with `sidebar.order`, `title`, `description`, and whatever else your schema demands. Maintaining that across the whole tree is tedious, hard to review in aggregate, and pollutes your content files with framework config.

## The Fix

Keep your frontmatter in dedicated files—one centralized file, per-directory files sitting next to the content, or both. This loader picks them up, deep-merges them with any in-file frontmatter, and hands the result to Astro's `parseData` for schema validation. Your markdown files stay clean.

## Install

```bash
pnpm add astro-loader-glob-frontmatter
```

Requires `astro >= 5.0.0` as a peer dependency.

## Quick Start

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content'
import { globFrontmatter } from 'astro-loader-glob-frontmatter'

const docs = defineCollection({
  loader: globFrontmatter({
    pattern: '**/*.md',
    base: './docs',
    frontmatter: './frontmatter.yml',
  }),
  schema: z.object({
    title: z.string(),
    sidebar: z.object({
      order: z.number(),
      label: z.string().optional(),
    }).optional(),
  }),
})

export const collections = { docs }
```

That's it. The loader wraps Astro's built-in `glob()`, so all the standard glob behavior—file watching, caching, digest computation—works the same.

## Options

`globFrontmatter` extends Astro's `glob()` options with one additional property:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `frontmatter` | `string` | *`no value`* | Path to a centralized frontmatter YAML/JSON file, relative to the Astro root |

All other options (`pattern`, `base`, `generateId`, etc.) are passed through to `glob()` as-is.

## Frontmatter File Formats

### Centralized file

Set the `frontmatter` option to point at a single YAML or JSON file. Two key formats are supported—nested and flat—and you can mix them in the same file.

**Nested** mirrors your directory structure:

```yaml
guides:
  installation.md:
    title: Installation
    sidebar:
      order: 1
  getting-started.md:
    title: Getting Started
    sidebar:
      order: 2
components:
  accordion.md:
    title: Accordion
    description: Expandable content sections
```

**Flat** uses path keys directly:

```yaml
guides/installation.md:
  title: Installation
  sidebar:
    order: 1
guides/getting-started.md:
  title: Getting Started
```

The detection rule is simple: if a key ends in `.md`, `.mdx`, or `.mdoc`, it's a content entry. Otherwise it's a directory name and the loader recurses into it.

### Per-directory files

Drop a `frontmatter.yml`, `frontmatter.yaml`, or `frontmatter.json` in any directory under your `base` path and the loader picks it up automatically. Keys are filenames relative to that directory:

```yaml
# docs/components/frontmatter.yml
README.md:
  title: Components Overview
  slug: components
accordion.md:
  title: Accordion
  sidebar:
    order: 3
```

No config flag needed. If the file exists, it's used. If you don't want per-directory frontmatter, don't create the files.

## Merge Cascade

Four layers, from broadest to most specific:

```
centralized file  →  per-directory file  →  H1 title  →  in-file frontmatter
   (broadest)        (directory-scoped)     (from body)    (most specific)
```

**In-file frontmatter always wins.** If a key exists in the markdown file's frontmatter, that value is used. The H1 title sits between external frontmatter and in-file frontmatter—it fills in the `title` field when external files don't provide one, but in-file `title` still takes precedence. Per-directory files fill in gaps and override the centralized file. The centralized file provides defaults for everything else.

For nested objects, merging is deep. If your centralized file sets `sidebar.badge: new` and the per-directory file sets `sidebar.order: 2`, the result is `sidebar: { order: 2, badge: new }`—not a wholesale replacement.

### Example

Given this centralized file:

```yaml
components:
  accordion.md:
    title: Central Title
    description: From central
    sidebar:
      order: 10
      badge: new
```

This per-directory file:

```yaml
# docs/components/frontmatter.yml
accordion.md:
  title: Per-Dir Title
  sidebar:
    order: 2
```

And this markdown frontmatter:

```yaml
---
title: My Accordion
draft: true
---
```

The merged result is:

```yaml
title: My Accordion          # in-file wins
description: From central     # only in central, inherited
draft: true                   # only in file, preserved
sidebar:
  order: 2                    # per-dir wins over central
  badge: new                  # central, inherited via deep merge
```

## Title from H1

The loader automatically extracts the first `# Heading` from your markdown content and uses it as the `title` field. This means you can write natural markdown that looks good on GitHub:

```markdown
---
sidebar:
  order: 3
---

# Accordion

The accordion component expands and collapses content.
```

The `# Accordion` heading becomes `title: "Accordion"` in your frontmatter data, and is stripped from the rendered body to prevent duplication.

**Rules:**
- The H1 must be the first non-blank content after frontmatter
- If frontmatter already has a `title` field, the in-file title wins (H1 is still stripped from the body)
- Inline markdown in the heading (`# My **Bold** Title`) is flattened to plain text
- Only the first H1 is extracted — subsequent H1s are left in the body

## Dev Mode

The loader automatically watches all frontmatter files for changes during `astro dev`. Edit a `frontmatter.yml` and the collection reloads—no restart needed.

## How It Works

The loader intercepts `glob()`'s `parseData` call. When glob processes each content file, it calls `parseData` with the file's frontmatter. This loader wraps that call, looks up the file's path in a pre-built frontmatter map, deep-merges the external data underneath the file's own frontmatter, then delegates to the real `parseData` for schema validation.

One pass, no re-processing, and glob's built-in caching works normally.

## License

MIT
