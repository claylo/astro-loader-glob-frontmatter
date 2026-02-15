import { describe, it, expect } from 'vitest'
import { deepMerge } from '../src/merge.js'

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

  it('skips __proto__ and constructor keys', () => {
    const result = deepMerge({}, { __proto__: { polluted: true }, constructor: 'bad' })
    expect(result).toEqual({})
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
