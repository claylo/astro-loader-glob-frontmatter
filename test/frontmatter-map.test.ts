import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import {
  parseCentralFile,
  flattenToMap,
  discoverPerDirFiles,
  loadFrontmatterMap,
  collectFrontmatterFilePaths,
} from '../src/frontmatter-map.js'

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

  it('returns empty map for nonexistent directory', () => {
    const map = discoverPerDirFiles('/nonexistent/directory')
    expect(map.size).toBe(0)
  })
})

describe('loadFrontmatterMap', () => {
  it('loads from central file only', () => {
    const centralFile = resolve(import.meta.dirname, 'fixtures/central/frontmatter.yml')
    const map = loadFrontmatterMap({ centralFile, basePath: '/nonexistent' })
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
    const centralFile = resolve(import.meta.dirname, 'fixtures/central/frontmatter.yml')
    const basePath = resolve(import.meta.dirname, 'fixtures/per-dir/docs')
    const map = loadFrontmatterMap({ centralFile, basePath })
    expect(map.get('components/accordion.md')).toEqual({ title: 'Accordion' })
    expect(map.get('guides/installation.md')).toBeDefined()
  })

  it('returns empty map when neither source exists', () => {
    const map = loadFrontmatterMap({ basePath: '/nonexistent' })
    expect(map.size).toBe(0)
  })
})

describe('collectFrontmatterFilePaths', () => {
  it('collects paths from base and subdirectories', () => {
    const basePath = resolve(import.meta.dirname, 'fixtures/per-dir/docs')
    const paths = collectFrontmatterFilePaths(basePath)
    expect(paths.length).toBeGreaterThan(0)
    expect(paths.every((p) => p.includes('frontmatter.'))).toBe(true)
  })

  it('returns empty array for nonexistent directory', () => {
    const paths = collectFrontmatterFilePaths('/nonexistent/directory')
    expect(paths).toEqual([])
  })
})
