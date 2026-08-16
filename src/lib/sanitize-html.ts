/**
 * A small allow-list sanitizer for editor-authored HTML.
 *
 * CMS blocks are written by staff, not by the public, so this is defence in
 * depth rather than the only thing standing between us and an attacker. But
 * "trusted author" is exactly the assumption that fails when an admin account is
 * phished, and stored XSS on a storefront runs in the session of every customer
 * who visits the page — so the content is stripped to a known-safe subset before
 * it is ever rendered.
 *
 * The rule is an allow-list, not a block-list: anything not explicitly named is
 * removed. Block-lists lose, because there is always one more way to smuggle a
 * script through.
 */

/** Formatting and structure only. Nothing that loads or executes. */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'blockquote', 'hr',
  'a', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
])

/** Per-tag attribute allow-list. Everything else is dropped. */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
}

/** Only schemes that cannot execute. `javascript:` and `data:` are absent. */
const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/|#)/i

export function sanitizeHtml(html: string): string {
  // Elements whose *content* is also dangerous have to go wholesale, not just
  // have their tags stripped — otherwise the script body survives as text and
  // an unbalanced tag elsewhere could re-open it.
  let out = html.replace(
    /<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi,
    '',
  )
  // …and again for the unclosed case.
  out = out.replace(/<(script|style|iframe|object|embed|noscript|template|svg|math)\b[^>]*>/gi, '')

  // Comments can hide conditional markup in older engines.
  out = out.replace(/<!--[\s\S]*?-->/g, '')

  return out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return ''

    // Closing tags carry no attributes.
    if (match.startsWith('</')) return `</${tag}>`

    const allowed = ALLOWED_ATTRS[tag]
    if (!allowed) return `<${tag}>`

    const kept: string[] = []
    const attrPattern = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g

    let attr: RegExpExecArray | null
    while ((attr = attrPattern.exec(rawAttrs)) !== null) {
      const name = attr[1].toLowerCase()
      const value = attr[3] ?? attr[4] ?? ''

      // Blanket rule: nothing that starts with `on` can survive, whatever tag
      // it is on. That is every inline event handler in one line.
      if (name.startsWith('on') || !allowed.has(name)) continue
      if (name === 'href' && !SAFE_HREF.test(value.trim())) continue

      kept.push(`${name}="${escapeAttr(value)}"`)
    }

    // An off-site link opened in a new tab gets `noopener`, so the destination
    // cannot reach back through window.opener.
    if (tag === 'a' && kept.some((a) => a.startsWith('target='))) {
      if (!kept.some((a) => a.startsWith('rel='))) kept.push('rel="noreferrer noopener"')
    }

    return kept.length > 0 ? `<${tag} ${kept.join(' ')}>` : `<${tag}>`
  })
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
