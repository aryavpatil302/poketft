import { describe, it, expect } from 'vitest'
import { renderReportHtml, type LeagueReport, type UnitAggregate, type ShinyStageRow, type ShinyStageSide } from './leagueReport'

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
    shinyStageStats: [],
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

// Fixture: two species across two stages — snorunt has BOTH stages with a
// non-shiny comparison; bellibolt has a stage with no non-shiny side at all
// (nonShiny: null), so the null-side render path gets exercised.
function side(overrides: Partial<ShinyStageSide> = {}): ShinyStageSide {
  return {
    fields: 4, winRate: 0.5, avgDealt: 300, avgTaken: 200, avgCasts: 1, avgKills: 0.5, avgDeaths: 0.2,
    avgHealSelf: 10, avgHealAlly: 5, avgShieldSelf: 20, avgShieldAlly: 8,
    ...overrides,
  }
}

function shinyStageFixture(): ShinyStageRow[] {
  return [
    { defId: 'snorunt', stage: 2, shiny: side({ winRate: 0.7 }), nonShiny: side({ winRate: 0.4 }) },
    { defId: 'snorunt', stage: 3, shiny: side({ winRate: 0.6 }), nonShiny: side({ winRate: 0.6 }) },
    { defId: 'bellibolt', stage: 4, shiny: side({ winRate: 0.8, fields: 3 }), nonShiny: null },
  ]
}

describe('leagueReport — shiny-vs-non-shiny stage section rendering', () => {
  it('renders the section heading when shinyStageStats is non-empty', () => {
    const r = baseReport()
    r.shinyStageStats = shinyStageFixture()
    const html = renderReportHtml(r)
    expect(html).toContain('Shiny vs non-shiny')
  })

  it('omits the section entirely when shinyStageStats is empty', () => {
    const html = renderReportHtml(baseReport())
    expect(html).not.toContain('Shiny vs non-shiny')
  })

  it('renders one filter chip per distinct species, and no chip for an absent species', () => {
    const r = baseReport()
    r.shinyStageStats = shinyStageFixture()
    const html = renderReportHtml(r)
    const chipMatches = html.match(/class="chip ss-chip[^"]*" data-def="([^"]+)"/g) ?? []
    expect(chipMatches.length).toBe(2)
    expect(html).toMatch(/data-def="snorunt"/)
    expect(html).toMatch(/data-def="bellibolt"/)
    expect(html).not.toContain('data-def="tangela"')
  })

  it('renders both a shiny and a non-shiny numeric row for a stage that has both, with the stage label present', () => {
    const r = baseReport()
    r.shinyStageStats = shinyStageFixture()
    const html = renderReportHtml(r)
    const blockIdx = html.indexOf('<div class="ssblock" data-def="snorunt"')
    expect(blockIdx).toBeGreaterThan(-1)
    const block = html.slice(blockIdx, html.indexOf('<div class="ssblock" data-def="bellibolt"'))
    // Stage 2 label present, and both a shiny row (tag) and an ordinary row.
    expect(block).toContain('>2<')
    expect(block).toContain('Ordinary')
  })

  it('renders a shiny row (with a no-comparison marker) even when the nonShiny side is null', () => {
    const r = baseReport()
    r.shinyStageStats = shinyStageFixture()
    const html = renderReportHtml(r)
    const blockIdx = html.indexOf('<div class="ssblock" data-def="bellibolt"')
    expect(blockIdx).toBeGreaterThan(-1)
    const block = html.slice(blockIdx, blockIdx + 2000)
    expect(block).toContain('no comparison at this stage')
  })

  it('carries the species data-def attribute on each block, matching its chip', () => {
    const r = baseReport()
    r.shinyStageStats = shinyStageFixture()
    const html = renderReportHtml(r)
    expect(html).toContain('<div class="ssblock" data-def="snorunt"')
    expect(html).toContain('<div class="ssblock" data-def="bellibolt"')
  })
})
