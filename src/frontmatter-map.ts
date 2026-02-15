import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { deepMerge } from './merge.js'

type Data = Record<string, unknown>

const CONTENT_EXTENSIONS = new Set(['.md', '.mdx', '.mdoc'])
const FRONTMATTER_FILENAMES = ['frontmatter.yml', 'frontmatter.yaml', 'frontmatter.json']

function isContentFile(key: string): boolean {
  return CONTENT_EXTENSIONS.has(extname(key))
}

function parseDataFile(filePath: string): Data {
  const content = readFileSync(filePath, 'utf-8')
  try {
    if (filePath.endsWith('.json')) {
      return JSON.parse(content) as Data
    }
    return (parseYaml(content) as Data) ?? {}
  } catch (e) {
    throw new Error(`Failed to parse ${filePath}: ${(e as Error).message}`)
  }
}

export function parseCentralFile(filePath: string): Data {
  if (!existsSync(filePath)) return {}
  return parseDataFile(filePath)
}

export function flattenToMap(data: Data, prefix = ''): Map<string, Data> {
  const map = new Map<string, Data>()
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
    const fullKey = prefix ? `${prefix}/${key}` : key
    if (isContentFile(key)) {
      map.set(fullKey, value as Data)
    } else {
      const nested = flattenToMap(value as Data, fullKey)
      for (const [k, v] of nested) {
        map.set(k, v)
      }
    }
  }
  return map
}

function* walkFrontmatterFiles(dir: string): Generator<{ dir: string; filePath: string; name: string }> {
  for (const name of FRONTMATTER_FILENAMES) {
    const filePath = join(dir, name)
    if (existsSync(filePath)) {
      yield { dir, filePath, name }
      break
    }
  }

  let entries: import('node:fs').Dirent[]
  try {
    entries = readdirSync(dir, { withFileTypes: true, encoding: 'utf-8' })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      yield* walkFrontmatterFiles(join(dir, entry.name))
    }
  }
}

export function discoverPerDirFiles(basePath: string): Map<string, Data> {
  const map = new Map<string, Data>()
  for (const { dir, filePath } of walkFrontmatterFiles(basePath)) {
    const data = parseDataFile(filePath)
    const relDir = relative(basePath, dir)
    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
      const entryPath = relDir ? `${relDir}/${key}` : key
      map.set(entryPath, value as Data)
    }
  }
  return map
}

interface LoadMapOptions {
  centralFile?: string
  basePath: string
}

export function loadFrontmatterMap(opts: LoadMapOptions): Map<string, Data> {
  const centralData = opts.centralFile ? parseCentralFile(opts.centralFile) : {}
  const centralMap = flattenToMap(centralData)

  const perDirMap = existsSync(opts.basePath)
    ? discoverPerDirFiles(opts.basePath)
    : new Map<string, Data>()

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

export function collectFrontmatterFilePaths(
  basePath: string,
  centralFile?: string,
): string[] {
  const paths: string[] = []
  if (centralFile && existsSync(centralFile)) paths.push(centralFile)
  for (const { filePath } of walkFrontmatterFiles(basePath)) {
    paths.push(filePath)
  }
  return paths
}
