import { glob } from 'astro/loaders'
import type { Loader } from 'astro/loaders'
import { readFileSync } from 'node:fs'
import { normalize, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadFrontmatterMap, collectFrontmatterFilePaths } from './frontmatter-map.js'
import { extractH1 } from './h1.js'
import { deepMerge } from './merge.js'

type GlobOpts = Parameters<typeof glob>[0]

interface GlobFrontmatterOptions extends GlobOpts {
  /** Path to centralized frontmatter YAML/JSON file (relative to Astro root) */
  frontmatter?: string
}

export function globFrontmatter(opts: GlobFrontmatterOptions): Loader {
  return {
    name: 'glob-frontmatter',
    async load(context) {
      const rootDir = fileURLToPath(context.config.root.toString())
      const base = opts.base?.toString() ?? '.'
      const normalizedBase = normalize(base)
      const basePath = resolve(rootDir, normalizedBase)

      const centralFile = opts.frontmatter
        ? resolve(rootDir, opts.frontmatter)
        : undefined
      const fmMap = loadFrontmatterMap({ centralFile, basePath })

      // Watch frontmatter files for dev mode hot reload
      if (context.watcher) {
        const filesToWatch = collectFrontmatterFilePaths(basePath, centralFile)
        if (filesToWatch.length > 0) {
          context.watcher.add(filesToWatch)
        }
      }

      const originalParseData = context.parseData.bind(context)
      const wrappedContext = Object.create(context, {
        parseData: {
          value: async <TData extends Record<string, unknown>>(
            props: { id: string; data: TData; filePath?: string },
          ) => {
            if (!props.filePath) return originalParseData(props)

            const relPath = relative(normalizedBase, props.filePath)
            const externalData = fmMap.get(relPath) ?? {}

            const merged = deepMerge(externalData, props.data as Record<string, unknown>)

            // Extract H1 from file body as title if not already set
            if (!merged.title) {
              try {
                const raw = readFileSync(resolve(rootDir, props.filePath), 'utf-8')
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

            return originalParseData({ ...props, data: merged as TData })
          },
        },
      })

      const { frontmatter: _frontmatter, ...globOpts } = opts
      await glob(globOpts).load(wrappedContext)
    },
  }
}

export type { GlobFrontmatterOptions }
