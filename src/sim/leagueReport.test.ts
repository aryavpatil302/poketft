import { describe, it, expect } from 'vitest'
import { renderReportHtml, type LeagueReport, type UnitAggregate } from './leagueReport'

// Render-smoke: a hand-built LeagueReport (the live botLeague.ts CLI can't run —
// bots.ts has a pre-existing broken import) with "shiny:" trait keys must render
// the "✦ <Species>" label in the per-unit trait-contributions table and the
// dedicated "Shiny effect impact" rollup section.

function baseUnit(): UnitAggregate {
  return {
    defId: 'tangela',
    fields: 4,
    winRate: 0.5,
    avgDealt: 300,
    avgTaken: 200,
    avgHealSelf: 0, avgHealAlly: 0, avgShieldSelf: 60, avgShieldAlly: 60,
    dealtBreak: { phys: 0, magic: 300, trueDmg: 0, auto: 0, spell: 300, emp: 0 },
    takenBreak: { phys: 100, magic: 100, trueDmg: 0, auto: 100, spell: 100, shield: 40 },
    traitContrib: {
      'shiny:tangela': { dmg: 0, heal: 0, shield: 120, mitigated: 40, count: 0 },
    },
    perTier: [],
  }
}

function baseReport(): LeagueReport {
  return {
    meta: { games: 1, rounds: 1, seed: 1, generatedAt: new Date().toISOString() },
    personaOrder: ['p1'],
    personaNames: { p1: 'Persona One' },
    standings: [{
      persona: 'p1', name: 'Persona One',
      winRate: 0.5, top2Rate: 0.7, avgPlacement: 2.5,
      placementDist: [1, 1, 0, 0, 0], avgFinalHp: 40, avgElimRound: 8,
    }],
    survival: { rounds: [], avgAlive: [] },
    h2h: [[null]],
    units: [baseUnit()],
    traceRounds: [],
    traceFights: [],
    traitPairs: [], unitContexts: [], traitDepths: [], breadths: [],
    shinyPresence: [], shinySpecies: [],
    shinyImpact: [
      { defId: 'tangela', dmg: 0, heal: 0, shield: 120, mitigated: 40, fights: 3 },
    ],
  }
}

describe('leagueReport — shiny effect impact rendering', () => {
  it('renders the "Shiny effect impact" section with a per-species row', () => {
    const html = renderReportHtml(baseReport())
    expect(html).toContain('Shiny effect impact')
    // species label uses the ✦ prefix from traitName()
    expect(html).toContain('✦ Tangela')
  })

  it('labels shiny: trait keys as "✦ <Species>" in the per-unit trait contributions table', () => {
    const html = renderReportHtml(baseReport())
    // the unit page trait-contributions block renders traitName('shiny:tangela')
    const idx = html.indexOf('Trait contributions')
    expect(idx).toBeGreaterThan(-1)
    expect(html.slice(idx).includes('✦ Tangela')).toBe(true)
  })

  it('omits the section entirely when there is no shiny impact', () => {
    const r = baseReport()
    r.shinyImpact = []
    r.units[0].traitContrib = {}
    const html = renderReportHtml(r)
    expect(html).not.toContain('Shiny effect impact')
  })
})
