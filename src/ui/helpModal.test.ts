// Data-layer only — importing helpModal.ts must not evaluate any `document`
// access at module scope, which is what keeps this test runnable in
// vitest's `node` environment (see vite.config.ts: no jsdom).

import { describe, it, expect } from 'vitest'
import { HELP_TABS, helpTab } from './helpModal'
import { REROLL_COST, STARTING_HP } from '../econ/constants'

// Keys the keydown map (src/main.ts ~3971-3979) binds: d reroll, f buy XP,
// e sell hovered unit, r pull item off hovered unit. main.ts accepts either
// case, but the help copy documents the capitalized, bolded (**X**) form.
const KEYDOWN_KEYS = ['D', 'F', 'E', 'R']

describe('HELP_TABS', () => {
  it('contains exactly two tabs, ids rules and controls, in that order', () => {
    expect(HELP_TABS.map(t => t.id)).toEqual(['rules', 'controls'])
  })

  it('helpTab returns a tab with a non-empty sections array, for both ids', () => {
    expect(helpTab('rules').sections.length).toBeGreaterThan(0)
    expect(helpTab('controls').sections.length).toBeGreaterThan(0)
  })

  it('every section has a non-empty trimmed heading and at least one non-empty trimmed body line', () => {
    for (const tab of HELP_TABS) {
      for (const section of tab.sections) {
        expect(section.heading.trim().length).toBeGreaterThan(0)
        expect(section.body.length).toBeGreaterThan(0)
        for (const line of section.body) {
          expect(line.trim().length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('both tabs carry at least five sections each', () => {
    expect(helpTab('rules').sections.length).toBeGreaterThanOrEqual(5)
    expect(helpTab('controls').sections.length).toBeGreaterThanOrEqual(5)
  })

  it('rules tab copy is interpolated from balance constants, not hand-typed', () => {
    const fullText = helpTab('rules').sections.flatMap(s => [s.heading, ...s.body]).join(' ')
    expect(fullText).toContain(String(REROLL_COST))
    expect(fullText).toContain(String(STARTING_HP))
  })

  it('controls tab mentions every keyboard key the keydown map binds', () => {
    const fullText = helpTab('controls').sections.flatMap(s => [s.heading, ...s.body]).join(' ')
    for (const key of KEYDOWN_KEYS) {
      // Word-boundary match so e.g. the 'e' in "Selling" cannot false-positive.
      const re = new RegExp(`\\b${key}\\b`)
      expect(re.test(fullText)).toBe(true)
    }
  })
})
