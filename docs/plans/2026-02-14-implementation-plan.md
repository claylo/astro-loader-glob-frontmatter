# astro-loader-glob-frontmatter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone Astro content loader that wraps `glob()` and injects frontmatter from centralized and per-directory YAML/JSON files.

**Architecture:** `parseData` interceptor pattern — wrap `glob()`, intercept the `LoaderContext.parseData` call, look up the entry in a frontmatter map built from external files, deep-merge per configurable strategy, then delegate to the real `parseData` for schema validation. Single pass, no re-validation.

**Tech Stack:** TypeScript, ESM, vitest, `yaml` package for YAML parsing, `astro` as peer dep (uses `glob` from `astro/loaders`)

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

**Step 1: Create package.json**

```json
{
  "name": "astro-loader-glob-frontmatter",
  "version": "0.0.1",
  "type": "module",
  "description": "Astro content loader that injects frontmatter from external YAML/JSON files",
  "license": "MIT",
  "author": "Clay Loveless",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/claylo/astro-loader-glob-frontmatter.git"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist/"],
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "tsc"
  },
  "peerDependencies": {
    "astro": ">=5.0.0"
  },
  "dependencies": {
    "yaml": "^2.7.0"
  },
  "devDependencies": {
    "astro": "^5.5.0",
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "test"]
}
```

**Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
})
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
```

**Step 5: Install dependencies**

Run: `pnpm install`
Expected: lockfile created, deps installed

**Step 6: Commit**

```
feat: project scaffold
```

---

### Task 2: Deep Merge + Strategy (TDD)

**Files:**
- Create: `test/merge.test.ts`
- Create: `src/merge.ts`

**Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { deepMerge, mergeFrontmatter } from '../src/merge.js'

describe('deepMerge', () => {
  it('merges flat objects', () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
  })

  it('overwrites scalar values', () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 })
  })

  it('deep merges nested objects', () => {
    const target = { sidebar: { order: 1, label: 'Guide' } }
    const source = { sidebar: { order: 5 } }
    expect(deepMerge(target, source)).toEqual({ sidebar: { order: 5, label: 'Guide' } })
  })

  it('overwrites arrays (no array merge)', () => {
    expect(deepMerge({ tags: ['a'] }, { tags: ['b', 'c'] })).toEqual({ tags: ['b', 'c'] })
  })

  it('does not mutate inputs', () => {
    const target = { sidebar: { order: 1 } }
    const source = { sidebar: { label: 'X' } }
    deepMerge(target, source)
    expect(target).toEqual({ sidebar: { order: 1 } })
    expect(source).toEqual({ sidebar: { label: 'X' } })
  })

  it('handles empty objects', () => {
    expect(deepMerge({}, { a: 1 })).toEqual({ a: 1 })
    expect(deepMerge({ a: 1 }, {})).toEqual({ a: 1 })
  })

  it('handles null values in source', () => {
    expect(deepMerge({ a: 1 }, { a: null })).toEqual({ a: null })
  })
})

describe('mergeFrontmatter', () => {
  const central = { title: 'Central', description: 'From central' }
  const perDir = { title: 'PerDir', sidebar: { order: 1 } }
  const file = { title: 'File', draft: true }

  it('file-wins: file overrides perDir overrides central', () => {
    const result = mergeFrontmatter(file, central, perDir, 'file-wins')
    expect(result).toEqual({
      title: 'File',
      description: 'From central',
      sidebar: { order: 1 },
      draft: true,
    })
  })

  it('frontmatter-wins: central overrides perDir overrides file', () => {
    const result = mergeFrontmatter(file, central, perDir, 'frontmatter-wins')
    expect(result).toEqual({
      title: 'Central',
      description: 'From central',
      sidebar: { order: 1 },
      draft: true,
    })
  })

  it('frontmatter-only: file data ignored entirely', () => {
    const result = mergeFrontmatter(file, central, perDir, 'frontmatter-only')
    expect(result).toEqual({
      title: 'PerDir',
      description: 'From central',
      sidebar: { order: 1 },
    })
  })

  it('handles empty external data', () => {
    const result = mergeFrontmatter(file, {}, {}, 'file-wins')
    expect(result).toEqual({ title: 'File', draft: true })
  })

  it('deep merges nested objects per strategy', () => {
    const centralNested = { sidebar: { order: 1, label: 'Central' } }
    const fileNested = { sidebar: { order: 5 } }
    const result = mergeFrontmatter(fileNested, centralNested, {}, 'file-wins')
    expect(result).toEqual({ sidebar: { order: 5, label: 'Central' } })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — cannot resolve `../src/merge.js`

**Step 3: Write the implementation**

```ts
// src/merge.ts
export type Strategy = 'file-wins' | 'frontmatter-wins' | 'frontmatter-only'

type Data = Record<string, unknown>

export function deepMerge(target: Data, source: Data): Data {
  const result: Data = { ...target }
  for (const key of Object.keys(source)) {
    const tVal = result[key]
    const sVal = source[key]
    if (
      typeof tVal === 'object' && tVal !== null && !Array.isArray(tVal) &&
      typeof sVal === 'object' && sVal !== null && !Array.isArray(sVal)
    ) {
      result[key] = deepMerge(tVal as Data, sVal as Data)
    } else {
      result[key] = sVal
    }
  }
  return result
}

export function mergeFrontmatter(
  fileData: Data,
  centralData: Data,
  perDirData: Data,
  strategy: Strategy,
): Data {
  switch (strategy) {
    case 'file-wins':
      // central < perDir < file
      return deepMerge(deepMerge(centralData, perDirData), fileData)
    case 'frontmatter-wins':
      // file < perDir < central
      return deepMerge(deepMerge(fileData, perDirData), centralData)
    case 'frontmatter-only':
      // file ignored, central < perDir
      return deepMerge(centralData, perDirData)
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: All merge tests PASS

**Step 5: Commit**

```
feat: add deep merge and strategy logic
```

---

### Task 3: Frontmatter Map — Central File (TDD)

**Files:**
- Create: `test/fixtures/central/frontmatter.yml`
- Create: `test/fixtures/central/frontmatter-flat.yml`
- Create: `test/fixtures/central/frontmatter.json`
- Create: `test/frontmatter-map.test.ts`
- Create: `src/frontmatter-map.ts`

**Step 1: Create test fixtures**

`test/fixtures/central/frontmatter.yml` — nested format:
```yaml
guides:
  installation.md:
    title: Installation
    sidebar:
      order: 1
  getting-started.md:
    title: Getting Started
components:
  README.md:
    title: Overview
    slug: components
```

`test/fixtures/central/frontmatter-flat.yml` — flat format:
```yaml
guides/installation.md:
  title: Installation
  sidebar:
    order: 1
guides/getting-started.md:
  title: Getting Started
components/README.md:
  title: Overview
  slug: components
```

`test/fixtures/central/frontmatter.json`:
```json
{
  "guides/installation.md": {
    "title": "Installation",
    "sidebar": { "order": 1 }
  }
}
```

**Step 2: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { parseCentralFile, flattenToMap } from '../src/frontmatter-map.js'

const fixturesDir = resolve(import.meta.dirname, 'fixtures/central')

describe('parseCentralFile', () => {
  it('reads a YAML file', () => {
    const data = parseCentralFile(resolve(fixturesDir, 'frontmatter.yml'))
    expect(data).toHaveProperty('guides')
    expect(data.guides).toHaveProperty('installation.md')
  })

  it('reads a JSON file', () => {
    const data = parseCentralFile(resolve(fixturesDir, 'frontmatter.json'))
    expect(data).toHaveProperty('guides/installation.md')
  })

  it('returns empty object for missing file', () => {
    expect(parseCentralFile('/nonexistent/file.yml')).toEqual({})
  })
})

describe('flattenToMap', () => {
  it('flattens nested YAML to path map', () => {
    const data = parseCentralFile(resolve(fixturesDir, 'frontmatter.yml'))
    const map = flattenToMap(data)
    expect(map.get('guides/installation.md')).toEqual({
      title: 'Installation',
      sidebar: { order: 1 },
    })
    expect(map.get('guides/getting-started.md')).toEqual({
      title: 'Getting Started',
    })
    expect(map.get('components/README.md')).toEqual({
      title: 'Overview',
      slug: 'components',
    })
  })

  it('handles already-flat keys', () => {
    const data = parseCentralFile(resolve(fixturesDir, 'frontmatter-flat.yml'))
    const map = flattenToMap(data)
    expect(map.get('guides/installation.md')).toEqual({
      title: 'Installation',
      sidebar: { order: 1 },
    })
  })

  it('handles mixed nested and flat keys', () => {
    const mixed = {
      'guides/installation.md': { title: 'Flat' },
      components: {
        'accordion.md': { title: 'Nested' },
      },
    }
    const map = flattenToMap(mixed)
    expect(map.get('guides/installation.md')).toEqual({ title: 'Flat' })
    expect(map.get('components/accordion.md')).toEqual({ title: 'Nested' })
  })

  it('returns empty map for empty input', () => {
    expect(flattenToMap({})).toEqual(new Map())
  })
})
```

**Step 3: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — cannot resolve `../src/frontmatter-map.js`

**Step 4: Write the implementation**

```ts
// src/frontmatter-map.ts
import { readFileSync, existsSync } from 'node:fs'
import { extname } from 'node:path'
import { parse as parseYaml } from 'yaml'

type Data = Record<string, unknown>

const CONTENT_EXTENSIONS = new Set(['.md', '.mdx', '.mdoc'])

function isContentFile(key: string): boolean {
  return CONTENT_EXTENSIONS.has(extname(key))
}

export function parseCentralFile(filePath: string): Data {
  if (!existsSync(filePath)) return {}
  const content = readFileSync(filePath, 'utf-8')
  if (filePath.endsWith('.json')) {
    return JSON.parse(content) as Data
  }
  return (parseYaml(content) as Data) ?? {}
}

export function flattenToMap(data: Data, prefix = ''): Map<string, Data> {
  const map = new Map<string, Data>()
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
    if (isContentFile(key)) {
      // It's a content file entry — use full path as key
      const path = prefix ? `${prefix}/${key}` : key
      map.set(path, value as Data)
    } else if (key.includes('/') && isContentFile(key)) {
      // Flat key like "guides/installation.md"
      map.set(key, value as Data)
    } else if (key.includes('/')) {
      // Flat directory-ish key that doesn't end in content ext — skip
      continue
    } else {
      // Directory name — recurse
      const nested = flattenToMap(value as Data, prefix ? `${prefix}/${key}` : key)
      for (const [k, v] of nested) {
        map.set(k, v)
      }
    }
  }
  return map
}
```

Wait — the flat key detection has a bug. A flat key like `guides/installation.md` ends in `.md`, so `isContentFile` returns true in the first branch. The key contains `/` but the first check catches it because `extname('guides/installation.md')` is `.md`. So actually the first `if` handles both cases. The second and third branches for `/`-containing keys are unreachable for content files. Let me simplify:

```ts
export function flattenToMap(data: Data, prefix = ''): Map<string, Data> {
  const map = new Map<string, Data>()
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
    const fullKey = prefix ? `${prefix}/${key}` : key
    if (isContentFile(key)) {
      map.set(fullKey, value as Data)
    } else {
      // Directory name or flat path prefix — recurse
      const nested = flattenToMap(value as Data, fullKey)
      for (const [k, v] of nested) {
        map.set(k, v)
      }
    }
  }
  return map
}
```

Hmm, but what about a flat key like `guides/installation.md`? `isContentFile('guides/installation.md')` — `extname('guides/installation.md')` is `.md`, so it returns true. The fullKey would be `guides/installation.md` (no prefix). That works.

But what about a nested key where the directory is `guides` and the file is `installation.md`? Then `key` is `guides`, `isContentFile('guides')` is false, so we recurse. Inside, `key` is `installation.md`, `isContentFile` is true, fullKey is `guides/installation.md`. Same result.

Let me revise the implementation in the plan.

**Step 5: Run tests to verify they pass**

Run: `pnpm test`
Expected: All frontmatter-map tests PASS

**Step 6: Commit**

```
feat: add central frontmatter file parsing
```

---

### Task 4: Frontmatter Map — Per-Directory Discovery (TDD)

**Files:**
- Create: `test/fixtures/per-dir/docs/frontmatter.yml`
- Create: `test/fixtures/per-dir/docs/components/frontmatter.yaml`
- Create: `test/fixtures/per-dir/docs/guides/frontmatter.json`
- Modify: `test/frontmatter-map.test.ts` (add tests)
- Modify: `src/frontmatter-map.ts` (add `discoverPerDirFiles`)

**Step 1: Create fixtures**

`test/fixtures/per-dir/docs/frontmatter.yml`:
```yaml
README.md:
  title: Home
  template: splash
```

`test/fixtures/per-dir/docs/components/frontmatter.yaml`:
```yaml
README.md:
  title: Overview
  slug: components
accordion.md:
  title: Accordion
```

`test/fixtures/per-dir/docs/guides/frontmatter.json`:
```json
{
  "installation.md": {
    "title": "Installation",
    "sidebar": { "order": 1 }
  }
}
```

**Step 2: Write the failing tests**

Append to `test/frontmatter-map.test.ts`:

```ts
import { discoverPerDirFiles } from '../src/frontmatter-map.js'

describe('discoverPerDirFiles', () => {
  const basePath = resolve(import.meta.dirname, 'fixtures/per-dir/docs')

  it('discovers frontmatter.yml in base directory', () => {
    const map = discoverPerDirFiles(basePath)
    expect(map.get('README.md')).toEqual({ title: 'Home', template: 'splash' })
  })

  it('discovers frontmatter.yaml in subdirectories', () => {
    const map = discoverPerDirFiles(basePath)
    expect(map.get('components/README.md')).toEqual({ title: 'Overview', slug: 'components' })
    expect(map.get('components/accordion.md')).toEqual({ title: 'Accordion' })
  })

  it('discovers frontmatter.json in subdirectories', () => {
    const map = discoverPerDirFiles(basePath)
    expect(map.get('guides/installation.md')).toEqual({
      title: 'Installation',
      sidebar: { order: 1 },
    })
  })

  it('returns empty map for directory with no frontmatter files', () => {
    const map = discoverPerDirFiles(resolve(import.meta.dirname, 'fixtures/central'))
    expect(map.size).toBe(0)
  })
})
```

**Step 3: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `discoverPerDirFiles` is not exported

**Step 4: Write the implementation**

Add to `src/frontmatter-map.ts`:

```ts
import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const FRONTMATTER_FILENAMES = ['frontmatter.yml', 'frontmatter.yaml', 'frontmatter.json']

export function discoverPerDirFiles(basePath: string): Map<string, Data> {
  const map = new Map<string, Data>()

  function walk(dir: string): void {
    // Check for frontmatter file in this directory
    for (const name of FRONTMATTER_FILENAMES) {
      const filePath = join(dir, name)
      if (!existsSync(filePath)) continue
      const content = readFileSync(filePath, 'utf-8')
      const data: Data = name.endsWith('.json')
        ? JSON.parse(content)
        : (parseYaml(content) ?? {})
      const relDir = relative(basePath, dir)
      for (const [key, value] of Object.entries(data)) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
        const entryPath = relDir ? `${relDir}/${key}` : key
        map.set(entryPath, value as Data)
      }
      break // Use first frontmatter file found per directory
    }

    // Recurse into subdirectories
    let entries: ReturnType<typeof readdirSync>
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(join(dir, entry.name))
      }
    }
  }

  walk(basePath)
  return map
}
```

**Step 5: Run tests to verify they pass**

Run: `pnpm test`
Expected: All tests PASS

**Step 6: Commit**

```
feat: add per-directory frontmatter discovery
```

---

### Task 5: Frontmatter Map — Combined Loader (TDD)

**Files:**
- Modify: `test/frontmatter-map.test.ts` (add tests)
- Modify: `src/frontmatter-map.ts` (add `loadFrontmatterMap`)

This function combines central + per-directory into a single map, with per-directory taking precedence (deep merge).

**Step 1: Write the failing tests**

Append to `test/frontmatter-map.test.ts`:

```ts
import { loadFrontmatterMap } from '../src/frontmatter-map.js'

describe('loadFrontmatterMap', () => {
  it('loads from central file only', () => {
    const centralPath = resolve(import.meta.dirname, 'fixtures/central/frontmatter.yml')
    const map = loadFrontmatterMap({ centralFile: centralPath, basePath: '/nonexistent' })
    expect(map.get('guides/installation.md')).toEqual({
      title: 'Installation',
      sidebar: { order: 1 },
    })
  })

  it('loads from per-directory only', () => {
    const basePath = resolve(import.meta.dirname, 'fixtures/per-dir/docs')
    const map = loadFrontmatterMap({ basePath })
    expect(map.get('components/accordion.md')).toEqual({ title: 'Accordion' })
  })

  it('merges central and per-dir with per-dir winning', () => {
    // Create a scenario where both provide data for the same path
    const centralPath = resolve(import.meta.dirname, 'fixtures/central/frontmatter.yml')
    const basePath = resolve(import.meta.dirname, 'fixtures/per-dir/docs')
    const map = loadFrontmatterMap({ centralFile: centralPath, basePath })
    // components/README.md exists in both:
    //   central: { title: 'Overview', slug: 'components' }
    //   per-dir: { title: 'Overview', slug: 'components' }
    // Both match, so either way the result is the same.
    // The key test: per-dir adds entries central doesn't have
    expect(map.get('components/accordion.md')).toEqual({ title: 'Accordion' })
    expect(map.get('guides/installation.md')).toBeDefined()
  })

  it('returns empty map when neither source exists', () => {
    const map = loadFrontmatterMap({ basePath: '/nonexistent' })
    expect(map.size).toBe(0)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `loadFrontmatterMap` not exported

**Step 3: Write the implementation**

Add to `src/frontmatter-map.ts`:

```ts
import { deepMerge } from './merge.js'

interface LoadMapOptions {
  centralFile?: string
  basePath: string
}

export function loadFrontmatterMap(opts: LoadMapOptions): Map<string, Data> {
  // Start with central file data
  const centralData = opts.centralFile ? parseCentralFile(opts.centralFile) : {}
  const centralMap = flattenToMap(centralData)

  // Discover per-directory files
  const perDirMap = existsSync(opts.basePath)
    ? discoverPerDirFiles(opts.basePath)
    : new Map<string, Data>()

  // Merge: per-dir wins over central (deep merge per entry)
  const merged = new Map<string, Data>(centralMap)
  for (const [key, perDirValue] of perDirMap) {
    const centralValue = merged.get(key)
    if (centralValue) {
      merged.set(key, deepMerge(centralValue, perDirValue))
    } else {
      merged.set(key, perDirValue)
    }
  }
  return merged
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: All tests PASS

**Step 5: Commit**

```
feat: add combined frontmatter map loader
```

---

### Task 6: Main Loader — parseData Interceptor (TDD)

**Files:**
- Create: `test/loader.test.ts`
- Create: `src/index.ts`

The main export. Wraps `glob()`, intercepts `parseData`, merges frontmatter.

**Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Mock astro/loaders — glob returns a loader whose load() calls parseData for test entries
vi.mock('astro/loaders', () => ({
  glob: vi.fn((_opts: unknown) => ({
    name: 'glob',
    load: async (context: {
      parseData: (props: { id: string; data: Record<string, unknown>; filePath: string }) => Promise<unknown>
    }) => {
      // Simulate glob finding two files and calling parseData for each
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
    },
  })),
}))

import { globFrontmatter } from '../src/index.js'

const rootDir = resolve(import.meta.dirname, 'fixtures/per-dir')
const rootUrl = pathToFileURL(rootDir + '/')

function makeMockContext() {
  const captured: Array<{ id: string; data: Record<string, unknown> }> = []
  return {
    captured,
    context: {
      config: { root: rootUrl },
      parseData: vi.fn(async (props: { id: string; data: Record<string, unknown> }) => {
        captured.push({ id: props.id, data: props.data })
        return props.data
      }),
      watcher: undefined,
    },
  }
}

describe('globFrontmatter', () => {
  it('returns a Loader with correct name', () => {
    const loader = globFrontmatter({ pattern: '**/*.md', base: './docs' })
    expect(loader.name).toBe('glob-frontmatter')
    expect(typeof loader.load).toBe('function')
  })

  it('injects frontmatter from per-directory files (file-wins)', async () => {
    const { context, captured } = makeMockContext()
    const loader = globFrontmatter({
      pattern: '**/*.md',
      base: './docs',
      strategy: 'file-wins',
    })
    await loader.load(context as never)

    // guides/installation.md: file has { title, draft }, per-dir has { title, sidebar }
    // file-wins → file title wins, per-dir sidebar added
    const installation = captured.find((e) => e.id === 'guides/installation')!
    expect(installation.data.title).toBe('From File')
    expect(installation.data.draft).toBe(true)
    expect(installation.data.sidebar).toEqual({ order: 1 })
  })

  it('external data overrides file when frontmatter-wins', async () => {
    const { context, captured } = makeMockContext()
    const loader = globFrontmatter({
      pattern: '**/*.md',
      base: './docs',
      strategy: 'frontmatter-wins',
    })
    await loader.load(context as never)

    const installation = captured.find((e) => e.id === 'guides/installation')!
    expect(installation.data.title).toBe('Installation')
    expect(installation.data.draft).toBe(true)
    expect(installation.data.sidebar).toEqual({ order: 1 })
  })

  it('ignores file data when frontmatter-only', async () => {
    const { context, captured } = makeMockContext()
    const loader = globFrontmatter({
      pattern: '**/*.md',
      base: './docs',
      strategy: 'frontmatter-only',
    })
    await loader.load(context as never)

    const installation = captured.find((e) => e.id === 'guides/installation')!
    expect(installation.data.title).toBe('Installation')
    expect(installation.data).not.toHaveProperty('draft')
  })

  it('passes through file data unchanged when no external match', async () => {
    const { context, captured } = makeMockContext()
    const loader = globFrontmatter({
      pattern: '**/*.md',
      base: './docs',
    })
    await loader.load(context as never)

    const standalone = captured.find((e) => e.id === 'no-external')!
    expect(standalone.data).toEqual({ title: 'Standalone' })
  })

  it('defaults to file-wins strategy', async () => {
    const { context, captured } = makeMockContext()
    const loader = globFrontmatter({
      pattern: '**/*.md',
      base: './docs',
    })
    await loader.load(context as never)

    const installation = captured.find((e) => e.id === 'guides/installation')!
    expect(installation.data.title).toBe('From File')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — cannot resolve `../src/index.js`

**Step 3: Write the implementation**

```ts
// src/index.ts
import { glob } from 'astro/loaders'
import type { Loader } from 'astro/loaders'
import { normalize, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadFrontmatterMap } from './frontmatter-map.js'
import { mergeFrontmatter, type Strategy } from './merge.js'

interface GlobFrontmatterOptions {
  /** Glob pattern passed to glob() */
  pattern: string | string[]
  /** Base directory passed to glob(). Default: '.' */
  base?: string
  /** Path to centralized frontmatter YAML/JSON file (relative to Astro root) */
  frontmatter?: string
  /** Merge strategy. Default: 'file-wins' */
  strategy?: Strategy
  /** Custom ID generator, passed to glob() */
  generateId?: Parameters<typeof glob>[0]['generateId']
}

export function globFrontmatter(opts: GlobFrontmatterOptions): Loader {
  return {
    name: 'glob-frontmatter',
    async load(context) {
      const rootDir = fileURLToPath(context.config.root)
      const normalizedBase = normalize(opts.base ?? '.')
      const basePath = resolve(rootDir, normalizedBase)
      const strategy = opts.strategy ?? 'file-wins'

      // Build the frontmatter map from central file + per-directory files
      const centralFile = opts.frontmatter
        ? resolve(rootDir, opts.frontmatter)
        : undefined
      const fmMap = loadFrontmatterMap({ centralFile, basePath })

      // Wrap parseData to inject external frontmatter
      const originalParseData = context.parseData.bind(context)
      const wrappedContext = Object.create(context, {
        parseData: {
          value: async <TData extends Record<string, unknown>>(
            props: { id: string; data: TData; filePath?: string },
          ) => {
            if (!props.filePath) return originalParseData(props)

            const relPath = relative(normalizedBase, props.filePath)
            const centralData = fmMap.get(relPath) ?? {}

            // Split central vs per-dir isn't needed here —
            // loadFrontmatterMap already merged them with per-dir winning.
            // We just need to merge external (combined) with file data per strategy.
            const merged = mergeFrontmatter(
              props.data as Record<string, unknown>,
              centralData,
              {},
              strategy,
            )

            return originalParseData({ ...props, data: merged as TData })
          },
        },
      })

      // Delegate to glob with the wrapped context
      const globOpts: Parameters<typeof glob>[0] = {
        pattern: opts.pattern,
        base: opts.base,
      }
      if (opts.generateId) globOpts.generateId = opts.generateId
      await glob(globOpts).load(wrappedContext)
    },
  }
}

export type { Strategy, GlobFrontmatterOptions }
```

Note: `loadFrontmatterMap` already merges central + per-dir (per-dir wins). By the time we call `mergeFrontmatter` in the interceptor, we pass the combined external data as `centralData` and `{}` as `perDirData`. The three-arg merge function still works correctly — it's `deepMerge(central, {})` which is just `central`, then merged with file data per strategy.

**Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: All tests PASS

**Step 5: Commit**

```
feat: add globFrontmatter loader with parseData interception
```

---

### Task 7: Central File + Per-Dir Integration Test (TDD)

**Files:**
- Create: `test/fixtures/combined/frontmatter.yml`
- Create: `test/fixtures/combined/docs/components/frontmatter.yml`
- Create: `test/integration.test.ts`

Tests the full flow: central file provides base data, per-directory file overrides some of it, file data is the final layer.

**Step 1: Create fixtures**

`test/fixtures/combined/frontmatter.yml`:
```yaml
components:
  accordion.md:
    title: Central Accordion
    description: From central
    sidebar:
      order: 10
      badge: new
```

`test/fixtures/combined/docs/components/frontmatter.yml`:
```yaml
accordion.md:
  title: PerDir Accordion
  sidebar:
    order: 2
```

**Step 2: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Fresh mock for this test file
vi.mock('astro/loaders', () => ({
  glob: vi.fn((_opts: unknown) => ({
    name: 'glob',
    load: async (context: {
      parseData: (props: { id: string; data: Record<string, unknown>; filePath: string }) => Promise<unknown>
    }) => {
      await context.parseData({
        id: 'components/accordion',
        data: { title: 'File Accordion', draft: true },
        filePath: 'docs/components/accordion.md',
      })
    },
  })),
}))

import { globFrontmatter } from '../src/index.js'

const rootDir = resolve(import.meta.dirname, 'fixtures/combined')
const rootUrl = pathToFileURL(rootDir + '/')

describe('central + per-dir + file integration', () => {
  it('merges all three layers with file-wins', async () => {
    const captured: Array<{ id: string; data: Record<string, unknown> }> = []
    const context = {
      config: { root: rootUrl },
      parseData: vi.fn(async (props: { id: string; data: Record<string, unknown> }) => {
        captured.push({ id: props.id, data: props.data })
        return props.data
      }),
      watcher: undefined,
    }

    const loader = globFrontmatter({
      pattern: '**/*.md',
      base: './docs',
      frontmatter: './frontmatter.yml',
      strategy: 'file-wins',
    })
    await loader.load(context as never)

    const accordion = captured.find((e) => e.id === 'components/accordion')!
    // file-wins: central < per-dir < file
    expect(accordion.data.title).toBe('File Accordion')          // file wins
    expect(accordion.data.description).toBe('From central')       // only in central
    expect(accordion.data.draft).toBe(true)                       // only in file
    expect(accordion.data.sidebar).toEqual({ order: 2, badge: 'new' }) // per-dir order wins, central badge preserved
  })

  it('merges all three layers with frontmatter-wins', async () => {
    const captured: Array<{ id: string; data: Record<string, unknown> }> = []
    const context = {
      config: { root: rootUrl },
      parseData: vi.fn(async (props: { id: string; data: Record<string, unknown> }) => {
        captured.push({ id: props.id, data: props.data })
        return props.data
      }),
      watcher: undefined,
    }

    const loader = globFrontmatter({
      pattern: '**/*.md',
      base: './docs',
      frontmatter: './frontmatter.yml',
      strategy: 'frontmatter-wins',
    })
    await loader.load(context as never)

    const accordion = captured.find((e) => e.id === 'components/accordion')!
    // frontmatter-wins: file < per-dir < central... wait.
    // Actually: loadFrontmatterMap merges central+per-dir (per-dir wins over central)
    // Then mergeFrontmatter('frontmatter-wins') makes external win over file.
    // So: combined external = deepMerge(central, perDir) = { title: 'PerDir Accordion', description: 'From central', sidebar: { order: 2, badge: 'new' } }
    // Then: deepMerge(file, external) = external wins
    expect(accordion.data.title).toBe('PerDir Accordion')        // per-dir wins (strongest external)
    expect(accordion.data.description).toBe('From central')       // only in central
    expect(accordion.data.draft).toBe(true)                       // only in file, not overridden
    expect(accordion.data.sidebar).toEqual({ order: 2, badge: 'new' })
  })
})
```

**Step 3: Run tests to verify they pass**

Run: `pnpm test`
Expected: All tests PASS (this is a validation of the existing code, not new functionality)

**Step 4: Commit**

```
test: add central + per-dir + file integration tests
```

---

### Task 8: Dev File Watching

**Files:**
- Modify: `src/index.ts`
- Modify: `test/loader.test.ts` (add watcher test)

**Step 1: Write the failing test**

Add to `test/loader.test.ts`:

```ts
it('watches frontmatter files for changes in dev mode', async () => {
  const addListener = vi.fn()
  const mockWatcher = { add: addListener }

  const { context } = makeMockContext()
  ;(context as Record<string, unknown>).watcher = mockWatcher

  const loader = globFrontmatter({
    pattern: '**/*.md',
    base: './docs',
  })
  await loader.load(context as never)

  // Should have called watcher.add with frontmatter file paths
  expect(addListener).toHaveBeenCalled()
  const watchedPaths = addListener.mock.calls.flat() as string[]
  expect(watchedPaths.some((p: string) => p.includes('frontmatter.'))).toBe(true)
})
```

**Step 2: Run tests to verify it fails**

Run: `pnpm test`
Expected: FAIL — watcher.add not called

**Step 3: Implement file watching in src/index.ts**

Add to the `load` function, after `loadFrontmatterMap`:

```ts
// Watch frontmatter files for dev mode hot reload
if (context.watcher) {
  const filesToWatch = collectFrontmatterFilePaths(basePath, centralFile)
  if (filesToWatch.length > 0) {
    context.watcher.add(filesToWatch)
  }
}
```

Add `collectFrontmatterFilePaths` to `src/frontmatter-map.ts`:

```ts
export function collectFrontmatterFilePaths(
  basePath: string,
  centralFile?: string,
): string[] {
  const paths: string[] = []
  if (centralFile && existsSync(centralFile)) paths.push(centralFile)

  function walk(dir: string): void {
    for (const name of FRONTMATTER_FILENAMES) {
      const filePath = join(dir, name)
      if (existsSync(filePath)) {
        paths.push(filePath)
        break
      }
    }
    let entries: ReturnType<typeof readdirSync>
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(join(dir, entry.name))
      }
    }
  }
  walk(basePath)
  return paths
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: All tests PASS

**Step 5: Commit**

```
feat: watch frontmatter files for dev mode reload
```

---

### Task 9: TypeScript Build + Package Exports Verification

**Files:**
- Verify: `tsconfig.json`
- Verify: `package.json` exports

**Step 1: Run the build**

Run: `pnpm build`
Expected: `dist/` created with `index.js`, `index.d.ts`, `merge.js`, `merge.d.ts`, `frontmatter-map.js`, `frontmatter-map.d.ts`

**Step 2: Verify the type exports are correct**

Check that `dist/index.d.ts` exports `globFrontmatter`, `Strategy`, `GlobFrontmatterOptions`.

**Step 3: Run full test suite one final time**

Run: `pnpm test`
Expected: All tests PASS

**Step 4: Commit**

```
chore: verify build output and package exports
```

---

## Summary

| Task | What | Tests |
|------|------|-------|
| 1 | Project scaffold | — |
| 2 | Deep merge + strategy | 9 |
| 3 | Central file parsing + flattening | 7 |
| 4 | Per-directory discovery | 4 |
| 5 | Combined map loader | 4 |
| 6 | Main loader (parseData interceptor) | 5 |
| 7 | Integration test (all three layers) | 2 |
| 8 | Dev file watching | 1 |
| 9 | Build verification | — |

**Total: ~32 tests across 9 tasks**
