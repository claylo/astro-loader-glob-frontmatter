import { describe, it, expect, vi } from 'vitest'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { glob } from 'astro/loaders'

vi.mock('astro/loaders', () => ({
  glob: vi.fn((_opts: unknown) => ({
    name: 'glob',
    load: async (context: {
      parseData: (props: { id: string; data: Record<string, unknown>; filePath?: string }) => Promise<unknown>
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

  it('file data wins over external frontmatter', async () => {
    const { context, captured } = makeMockContext()
    const loader = globFrontmatter({ pattern: '**/*.md', base: './docs' })
    await loader.load(context as never)

    const installation = captured.find((e) => e.id === 'guides/installation')!
    expect(installation.data.title).toBe('From File')
    expect(installation.data.draft).toBe(true)
    expect(installation.data.sidebar).toEqual({ order: 1 })
  })

  it('passes through file data unchanged when no external match', async () => {
    const { context, captured } = makeMockContext()
    const loader = globFrontmatter({ pattern: '**/*.md', base: './docs' })
    await loader.load(context as never)

    const standalone = captured.find((e) => e.id === 'no-external')!
    expect(standalone.data).toEqual({ title: 'Standalone' })
  })

  it('watches frontmatter files for changes in dev mode', async () => {
    const addListener = vi.fn()
    const mockWatcher = { add: addListener }

    const { context } = makeMockContext()
    ;(context as Record<string, unknown>).watcher = mockWatcher

    const loader = globFrontmatter({ pattern: '**/*.md', base: './docs' })
    await loader.load(context as never)

    expect(addListener).toHaveBeenCalled()
    const watchedPaths = addListener.mock.calls.flat(2) as string[]
    expect(watchedPaths.some((p: string) => p.includes('frontmatter.'))).toBe(true)
  })

  it('skips watcher.add when no frontmatter files found', async () => {
    const addListener = vi.fn()
    const mockWatcher = { add: addListener }

    const emptyRootUrl = pathToFileURL('/nonexistent/')
    const context = {
      config: { root: emptyRootUrl },
      parseData: vi.fn(async (props: { id: string; data: Record<string, unknown> }) => props.data),
      watcher: mockWatcher,
    }

    const loader = globFrontmatter({ pattern: '**/*.md', base: './docs' })
    await loader.load(context as never)

    expect(addListener).not.toHaveBeenCalled()
  })

  it('defaults base to "." when not specified', async () => {
    const { context, captured } = makeMockContext()
    const loader = globFrontmatter({ pattern: '**/*.md' })
    await loader.load(context as never)

    expect(captured.length).toBe(3)
  })

  it('passes generateId through to glob', async () => {
    const { context } = makeMockContext()
    const generateId = ({ entry }: { entry: string }) => entry
    const loader = globFrontmatter({
      pattern: '**/*.md',
      base: './docs',
      generateId,
    })
    await loader.load(context as never)

    const globMock = vi.mocked(glob)
    const lastCall = globMock.mock.calls.at(-1)![0]
    expect(lastCall).toHaveProperty('generateId', generateId)
  })

  it('passes data through unchanged when filePath is missing', async () => {
    const globMock = vi.mocked(glob)
    globMock.mockReturnValueOnce({
      name: 'glob',
      load: async (context: {
        parseData: (props: { id: string; data: Record<string, unknown> }) => Promise<unknown>
      }) => {
        await context.parseData({
          id: 'no-filepath',
          data: { title: 'No Path' },
        })
      },
    } as never)

    const { context, captured } = makeMockContext()
    const loader = globFrontmatter({ pattern: '**/*.md', base: './docs' })
    await loader.load(context as never)

    expect(captured).toEqual([{ id: 'no-filepath', data: { title: 'No Path' } }])
  })
})
