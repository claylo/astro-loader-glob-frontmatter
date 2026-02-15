import { describe, it, expect } from 'vitest'
import { extractH1, stripH1Html } from '../src/h1.js'

describe('extractH1', () => {
  it('extracts H1 and strips it from body', () => {
    const md = '# My Title\n\nSome content here.'
    const result = extractH1(md)
    expect(result).toEqual({
      title: 'My Title',
      body: 'Some content here.',
    })
  })

  it('handles leading blank lines before H1', () => {
    const md = '\n\n# My Title\n\nContent.'
    const result = extractH1(md)
    expect(result).toEqual({
      title: 'My Title',
      body: 'Content.',
    })
  })

  it('strips single trailing blank line after H1', () => {
    const md = '# Title\n\nParagraph one.\n\nParagraph two.'
    const result = extractH1(md)
    expect(result).toEqual({
      title: 'Title',
      body: 'Paragraph one.\n\nParagraph two.',
    })
  })

  it('returns null when no H1 present', () => {
    const md = '## Subtitle\n\nContent.'
    expect(extractH1(md)).toBeNull()
  })

  it('returns null when H1 is not the first content', () => {
    const md = 'Some text first.\n\n# Title After Content'
    expect(extractH1(md)).toBeNull()
  })

  it('only extracts the first H1 when multiple exist', () => {
    const md = '# First\n\n# Second\n\nContent.'
    const result = extractH1(md)
    expect(result).toEqual({
      title: 'First',
      body: '# Second\n\nContent.',
    })
  })

  it('flattens inline markdown to plain text', () => {
    const md = '# My **Bold** and *Italic* Title\n\nContent.'
    const result = extractH1(md)
    expect(result?.title).toBe('My Bold and Italic Title')
  })

  it('flattens inline code to plain text', () => {
    const md = '# Using `async/await` in Node\n\nContent.'
    const result = extractH1(md)
    expect(result?.title).toBe('Using async/await in Node')
  })

  it('flattens links to plain text', () => {
    const md = '# The [Astro](https://astro.build) Loader\n\nContent.'
    const result = extractH1(md)
    expect(result?.title).toBe('The Astro Loader')
  })

  it('returns empty body when file is only an H1', () => {
    const md = '# Just a Title'
    const result = extractH1(md)
    expect(result).toEqual({ title: 'Just a Title', body: '' })
  })

  it('preserves body when H1 has no trailing blank line', () => {
    const md = '# Title\nImmediate content.'
    const result = extractH1(md)
    expect(result).toEqual({
      title: 'Title',
      body: 'Immediate content.',
    })
  })

  it('handles whitespace-only lines before H1', () => {
    const md = '   \n\t\n# Title\n\nContent.'
    const result = extractH1(md)
    expect(result).toEqual({ title: 'Title', body: 'Content.' })
  })

  it('preserves # character in title text', () => {
    const md = '# C# Programming Guide\n\nContent.'
    const result = extractH1(md)
    expect(result?.title).toBe('C# Programming Guide')
  })
})

describe('stripH1Html', () => {
  it('removes first <h1> tag from HTML', () => {
    const html = '<h1>My Title</h1>\n<p>Content.</p>'
    expect(stripH1Html(html)).toBe('<p>Content.</p>')
  })

  it('only removes the first <h1>', () => {
    const html = '<h1>First</h1>\n<h1>Second</h1>\n<p>Content.</p>'
    expect(stripH1Html(html)).toBe('<h1>Second</h1>\n<p>Content.</p>')
  })

  it('handles <h1> with attributes', () => {
    const html = '<h1 id="title" class="big">Title</h1>\n<p>Rest.</p>'
    expect(stripH1Html(html)).toBe('<p>Rest.</p>')
  })

  it('handles <h1> with inline HTML elements', () => {
    const html = '<h1>My <strong>Bold</strong> Title</h1>\n<p>Rest.</p>'
    expect(stripH1Html(html)).toBe('<p>Rest.</p>')
  })

  it('returns HTML unchanged when no <h1> present', () => {
    const html = '<h2>Subtitle</h2>\n<p>Content.</p>'
    expect(stripH1Html(html)).toBe('<h2>Subtitle</h2>\n<p>Content.</p>')
  })

  it('strips trailing newline after removed <h1>', () => {
    const html = '<h1>Title</h1>\n\n<p>Content.</p>'
    expect(stripH1Html(html)).toBe('<p>Content.</p>')
  })
})
