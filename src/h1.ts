/**
 * Match a leading `# Title` line. The H1 must appear before any
 * non-blank content. Leading blank lines are allowed.
 *
 * Capture group 1 = raw heading text (may contain inline markdown).
 */
const H1_RE = /^(?:[^\S\n]*\n)*# (.+)\n?/

/** Strip bold, italic, code, images, and links down to plain text. */
function flattenInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')   // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')     // links
    .replace(/(\*\*|__)(.*?)\1/g, '$2')          // bold
    .replace(/(\*|_)(.*?)\1/g, '$2')             // italic
    .replace(/~~(.*?)~~/g, '$1')                 // strikethrough
    .replace(/`([^`]+)`/g, '$1')                 // inline code
    .trim()
}

const H1_HTML_RE = /<h1[^>]*>[\s\S]*?<\/h1>\n*/

export function stripH1Html(html: string): string {
  return html.replace(H1_HTML_RE, '')
}

export function extractH1(markdown: string): { title: string; body: string } | null {
  const match = H1_RE.exec(markdown)
  if (!match) return null

  const rawTitle = match[1]
  const title = flattenInlineMarkdown(rawTitle)
  // Remove the H1 line and at most one trailing blank line
  const body = markdown.slice(match[0].length).replace(/^\n/, '')

  return { title, body }
}
