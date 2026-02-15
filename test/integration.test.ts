import { describe, it, expect, vi } from 'vitest'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

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
  it('file wins over per-dir wins over central', async () => {
    const captured: Array<{ id: string; data: Record<string, unknown> }> = []
    const context = {
      config: { root: rootUrl },
      parseData: vi.fn(async (props: { id: string; data: Record<string, unknown> }) => {
        captured.push({ id: props.id, data: props.data })
        return props.data
      }),
      store: { set: vi.fn(() => true) },
      watcher: undefined,
    }

    const loader = globFrontmatter({
      pattern: '**/*.md',
      base: './docs',
      frontmatter: './frontmatter.yml',
    })
    await loader.load(context as never)

    const accordion = captured.find((e) => e.id === 'components/accordion')!
    expect(accordion.data.title).toBe('File Accordion')            // file wins over perDir and central
    expect(accordion.data.description).toBe('From central')         // only in central, inherited
    expect(accordion.data.draft).toBe(true)                         // only in file, preserved
    expect(accordion.data.sidebar).toEqual({ order: 2, badge: 'new' }) // perDir order wins over central, central badge inherited
  })
})
