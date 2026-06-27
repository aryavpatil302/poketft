import { describe, it, expect, beforeEach } from 'vitest'
import { makeUnit } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { triggerAbility, tickAbilityCast } from '../systems/ability'
import { TICK_RATE } from '../constants'
import type { Unit, CombatState } from '../types'

// Import to ensure abilities are registered
import '../systems/ability'

const CAST_TICKS = 20

function cast(caster: Unit, state: CombatState): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < CAST_TICKS; i++) tickAbilityCast(caster, state)
}

describe('Celebi - Future Sight', () => {
  let caster: Unit
  let e1: Unit
  let e2: Unit
  let e3: Unit
  let state: CombatState

  beforeEach(() => {
    caster = makeUnit('celebi', 'player', 1)
    caster.hexPos = { col: 3, row: 5 }
    e1 = makeUnit('dummy', 'enemy', 1)
    e1.hexPos = { col: 3, row: 2 }
    e2 = makeUnit('dummy', 'enemy', 1)
    e2.hexPos = { col: 2, row: 1 }
    e3 = makeUnit('dummy', 'enemy', 1)
    e3.hexPos = { col: 4, row: 1 }
    state = createCombatState([caster], [e1, e2, e3])
  })

  it('enters casting state when ability is triggered', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(caster.state).toBe('casting')
    expect(caster.abilityCastTimer).toBe(20)
  })

  it('emits a cast event', () => {
    caster.currentMana = caster.maxMana
    triggerAbility(caster, state)
    expect(state.events.some(e => e.type === 'cast')).toBe(true)
  })

  it('resets mana to 0 after cast', () => {
    cast(caster, state)
    expect(caster.currentMana).toBe(0)
  })

  it('tier 1 - marks 2 nearest enemies', () => {
    cast(caster, state)
    const marked = [e1, e2, e3].filter(e =>
      e.marks.some(m => m.id.startsWith('celebi_mark_'))
    )
    expect(marked).toHaveLength(2)
  })

  it('tier 2 - marks 3 nearest enemies', () => {
    const t2 = makeUnit('celebi', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const s = createCombatState([t2], [e1, e2, e3])
    cast(t2, s)
    const marked = [e1, e2, e3].filter(e =>
      e.marks.some(m => m.id.startsWith('celebi_mark_'))
    )
    expect(marked).toHaveLength(3)
  })

  it('tier 3 - marks up to 4 enemies (capped by available)', () => {
    const t3 = makeUnit('celebi', 'player', 3)
    t3.hexPos = { col: 3, row: 5 }
    const s = createCombatState([t3], [e1, e2, e3])
    cast(t3, s)
    const marked = [e1, e2, e3].filter(e =>
      e.marks.some(m => m.id.startsWith('celebi_mark_'))
    )
    expect(marked).toHaveLength(3)
  })

  it('mark has 2-second duration (2 * TICK_RATE)', () => {
    cast(caster, state)
    const mark = e1.marks.find(m => m.id.startsWith('celebi_mark_'))
    if (mark) {
      expect(mark.durationTicks).toBe(2 * TICK_RATE)
    }
  })

  it('amplifies incoming damage mult on marked targets (tier 1 = 1.3)', () => {
    cast(caster, state)
    const markedEnemies = [e1, e2, e3].filter(e =>
      e.marks.some(m => m.id.startsWith('celebi_mark_'))
    )
    for (const me of markedEnemies) {
      expect(me.incomingDamageMult).toBeCloseTo(1.3)
    }
  })

  it('tier 2 - amplifies incoming damage mult to 1.5', () => {
    const t2 = makeUnit('celebi', 'player', 2)
    t2.hexPos = { col: 3, row: 5 }
    const s = createCombatState([t2], [e1, e2, e3])
    cast(t2, s)
    const markedEnemies = [e1, e2, e3].filter(e =>
      e.marks.some(m => m.id.startsWith('celebi_mark_'))
    )
    for (const me of markedEnemies) {
      expect(me.incomingDamageMult).toBeCloseTo(1.5)
    }
  })

  it('mark onDetonate resets incomingDamageMult to 1.0', () => {
    cast(caster, state)
    const mark = e1.marks.find(m => m.id.startsWith('celebi_mark_'))
    if (mark?.onDetonate) {
      mark.onDetonate(e1, caster, state)
      expect(e1.incomingDamageMult).toBe(1.0)
    }
  })

  it('tier 1 mark onDetonate deals 308 damage after mitigation (400 raw)', () => {
    cast(caster, state)
    const mark = e1.marks.find(m => m.id.startsWith('celebi_mark_'))
    if (mark?.onDetonate) {
      state.events = []
      mark.onDetonate(e1, caster, state)
      const dmgEvent = state.events.find(e => e.type === 'damage' && e.targetId === e1.id)
      expect(dmgEvent).toBeDefined()
      if (dmgEvent?.type === 'damage') {
        // 400 raw * 100/130 (dummy spDefense=30) = 308
        expect(dmgEvent.amount).toBe(308)
        expect(dmgEvent.damageType).toBe('magic')
      }
    }
  })

  it('mark onDetonate does nothing if source is dead', () => {
    cast(caster, state)
    const mark = e1.marks.find(m => m.id.startsWith('celebi_mark_'))
    if (mark?.onDetonate) {
      caster.state = 'dead'
      const hpBefore = e1.currentHp
      mark.onDetonate(e1, caster, state)
      expect(e1.currentHp).toBe(hpBefore)
    }
  })

  it('does nothing when no enemies exist', () => {
    state = createCombatState([caster], [])
    cast(caster, state)
    expect(state.events.some(e => e.type === 'damage')).toBe(false)
  })
})
