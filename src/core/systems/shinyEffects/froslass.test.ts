import { describe, it, expect } from 'vitest'
import { makeUnit } from '../../unitFactory'
import { createCombatState } from '../../combatEngine'
import { triggerAbility, tickAbilityCast } from '../ability'
import { tickProjectiles } from '../../projectile'
import type { Unit, CombatState } from '../../types'

import '../ability'

// Froslass at {col:4, row:5} with target at {col:4, row:4}: nearest-in-line
// is LINE_HEX_1 (i === 0), second-in-line is LINE_HEX_2 (i === 1) — same
// geometry as src/core/abilities/froslass.test.ts.
const FROSLASS_POS = { col: 4, row: 5 }
const LINE_HEX_1   = { col: 4, row: 4 }  // nearest in line
const LINE_HEX_2   = { col: 3, row: 3 }  // second in line

// Fire a single shot only — strip the staggered volley status so repeated
// shots don't complicate the damage-event assertions below.
function castSingleShot(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < 20; i++) tickAbilityCast(caster, state)
  caster.statusEffects = caster.statusEffects.filter(fx => fx.stackId !== 'froslass_volley')
  for (let i = 0; i < 200 && state.projectiles.size > 0; i++) tickProjectiles(state)
}

function setup(shiny: boolean, targetPositions: { col: number; row: number }[]) {
  const caster = makeUnit('froslass', 'player', 1)
  caster.hexPos = { ...FROSLASS_POS }
  caster.critChance = 0
  caster._computedStats = null
  if (shiny) caster.isShiny = true
  const enemies = targetPositions.map(pos => {
    const e = makeUnit('dummy', 'enemy', 1)
    e.hexPos = { ...pos }
    return e
  })
  const state = createCombatState([caster], enemies)
  caster.targetId = enemies[0].id
  return { caster, enemies, state }
}

describe('Shiny Froslass - Icy Wind true-damage split', () => {
  it('emits a true-damage event against the first target for 10% of the hit', () => {
    const { enemies, caster, state } = setup(true, [LINE_HEX_1])
    castSingleShot(caster, state)
    const trueEvents = state.events.filter(e =>
      e.type === 'damage' && e.targetId === enemies[0].id && e.damageType === 'true'
    )
    expect(trueEvents).toHaveLength(1)
  })

  it('non-shiny caster deals no true-damage event to the first target (control)', () => {
    const { enemies, caster, state } = setup(false, [LINE_HEX_1])
    castSingleShot(caster, state)
    const trueEvents = state.events.filter(e =>
      e.type === 'damage' && e.targetId === enemies[0].id && e.damageType === 'true'
    )
    expect(trueEvents).toHaveLength(0)
  })

  it('deals more total damage to the first target than a non-shiny caster (true damage bypasses spDefense mitigation)', () => {
    const shinyRun = setup(true, [LINE_HEX_1])
    castSingleShot(shinyRun.caster, shinyRun.state)
    const shinyDmg = shinyRun.enemies[0].maxHp - shinyRun.enemies[0].currentHp

    const plainRun = setup(false, [LINE_HEX_1])
    castSingleShot(plainRun.caster, plainRun.state)
    const plainDmg = plainRun.enemies[0].maxHp - plainRun.enemies[0].currentHp

    expect(shinyDmg).toBeGreaterThan(plainDmg)
  })

  it('second target in the line is unaffected — no true-damage event, even when the caster is shiny', () => {
    const { enemies, caster, state } = setup(true, [LINE_HEX_1, LINE_HEX_2])
    castSingleShot(caster, state)

    const trueEventsOnSecond = state.events.filter(e =>
      e.type === 'damage' && e.targetId === enemies[1].id && e.damageType === 'true'
    )
    expect(trueEventsOnSecond).toHaveLength(0)

    // First target still gets its split even with a second target present.
    const trueEventsOnFirst = state.events.filter(e =>
      e.type === 'damage' && e.targetId === enemies[0].id && e.damageType === 'true'
    )
    expect(trueEventsOnFirst).toHaveLength(1)
  })

  it('deals no damage to anyone when no targetId is set, regardless of shininess (edge case)', () => {
    // The primary target is unconditionally pushed into lineTargets in
    // froslass.ts's onCast, so "off the line" isn't a zero-target case when
    // that same unit is also the primary target — the real zero-target
    // path is no targetId at all (mirrors the non-shiny ability's own
    // "does not deal damage when no targetId is set" test).
    const caster = makeUnit('froslass', 'player', 1)
    caster.hexPos = { ...FROSLASS_POS }
    caster.critChance = 0
    caster._computedStats = null
    caster.isShiny = true
    const enemy = makeUnit('dummy', 'enemy', 1)
    enemy.hexPos = { ...LINE_HEX_1 }
    const state = createCombatState([caster], [enemy])
    caster.targetId = null
    const hpBefore = enemy.currentHp
    castSingleShot(caster, state)
    expect(enemy.currentHp).toBe(hpBefore)
  })
})
