import { describe, it, expect, vi } from 'vitest'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { glob } from 'astro/loaders'

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
      // Entry where H1 is NOT the first content (buried in body)
      context.store.set({
        id: 'buried-h1',
        data: { title: 'Has Buried H1' },
        body: 'Some intro text.\n\n# Buried Heading\n\nMore content.',
        rendered: {
          html: '<p>Some intro text.</p>\n<h1>Buried Heading</h1>\n<p>More content.</p>',
          metadata: {
            headings: [{ depth: 1, slug: 'buried-heading', text: 'Buried Heading' }],
          },
        },
      })
    },
  })),
}))

import { globFrontmatter } from '../src/index.js'

const rootDir = resolve(import.meta.dirname, 'fixtures/per-dir')
const rootUrl = pathToFileURL(rootDir + '/')

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
      store: { set: vi.fn(() => true) },
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

    expect(captured.length).toBe(5)
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

  it('does not strip H1 from rendered HTML when H1 is not first content', async () => {
    const { context, stored } = makeMockContext()
    const loader = globFrontmatter({ pattern: '**/*.md', base: './docs' })
    await loader.load(context as never)

    const entry = stored.find((e) => e.id === 'buried-h1') as Record<string, unknown>
    expect(entry.body).toBe('Some intro text.\n\n# Buried Heading\n\nMore content.')
    const rendered = entry.rendered as { html: string; metadata: { headings: Array<{ depth: number }> } }
    expect(rendered.html).toBe('<p>Some intro text.</p>\n<h1>Buried Heading</h1>\n<p>More content.</p>')
    expect(rendered.metadata.headings).toEqual([
      { depth: 1, slug: 'buried-heading', text: 'Buried Heading' },
    ])
  })
})
