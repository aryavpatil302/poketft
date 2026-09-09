import type { Unit, CombatState } from '../../types'
import { registerShinyEffect } from '../shinyEffects'
import { combatRng } from '../../rng'

type StatKey = 'attack' | 'special' | 'defense' | 'spDefense'
const STAT_POOL: StatKey[] = ['attack', 'special', 'defense', 'spDefense']

// Shiny Unown: "grant ally pokemon +3 of 2 random stats" is read here as ONE
// shared random pick of 2 distinct stats for the whole team (via
// combatRng()), then every living ally gets the SAME +3/+3 to those two
// stats — NOT an independent roll per ally. Mutates the stored base fields
// directly, same style as the universal +5% shiny bonus (shinyEffects.ts),
// which has already run by the time this fires, so this composes on top of
// it rather than double-counting it.
registerShinyEffect('unown', {
  id: 'shiny_unown_stat_boost',
  description: 'All allies gain +3 to 2 random stats.',
  onCombatStart(self: Unit, state: CombatState): void {
    const pool = [...STAT_POOL]
    const picked: StatKey[] = []
    for (let i = 0; i < 2 && pool.length > 0; i++) {
      const idx = Math.floor(combatRng() * pool.length)
      picked.push(pool[idx])
      pool.splice(idx, 1)
    }

    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy || ally.state === 'dead') continue
      for (const stat of picked) ally[stat] += 3
      ally._computedStats = null
    }
  },
})
