import { describe, it, expect } from 'vitest'
import { escapeHtml } from './escapeHtml'

describe('escapeHtml', () => {
  it('escapes all five HTML-significant characters', () => {
    expect(escapeHtml('&')).toBe('&amp;')
    expect(escapeHtml('<')).toBe('&lt;')
    expect(escapeHtml('>')).toBe('&gt;')
    expect(escapeHtml('"')).toBe('&quot;')
    expect(escapeHtml("'")).toBe('&#39;')
  })

  // The ordering property: if `&` were replaced last it would re-escape the
  // ampersands the other four replacements just introduced.
  it('escapes & first, so an already-escaped entity is escaped once more', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
    expect(escapeHtml('&amp;')).toBe('&amp;amp;')
  })

  it('leaves a plain display name unchanged', () => {
    expect(escapeHtml('Amber')).toBe('Amber')
    expect(escapeHtml('Player 2')).toBe('Player 2')
    expect(escapeHtml('')).toBe('')
  })

  it('leaves a shareable lobby URL readable while escaping its separators', () => {
    const url = 'http://localhost:5173/?lobby=abc234'
    expect(escapeHtml(url)).toBe(url)
  })

  it('renders a script-tag payload inert — no literal angle bracket survives', () => {
    const payload = '<script>alert("xss")</script>'
    const escaped = escapeHtml(payload)
    expect(escaped).not.toContain('<')
    expect(escaped).not.toContain('>')
    expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
  })

  it('renders an attribute-breakout payload inert', () => {
    const escaped = escapeHtml(`" onerror='alert(1)' x="`)
    expect(escaped).not.toContain('"')
    expect(escaped).not.toContain("'")
  })
})
