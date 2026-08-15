import type { Unit, CombatState } from '../types'
import { computeStats } from '../unitFactory'

export function applyHeal(unit: Unit, amount: number, sourceId: string, state: CombatState, traitSource?: string): number {
  if (unit.state === 'dead') return 0
  const healBlock = unit.statusEffects.find(fx => fx.id === 'healBlock')
  // Never trust a cached _computedStats here: callers often grant other status
  // effects (which null the cache — see addStatusEffect) immediately before
  // healing/shielding in the same tick, which would otherwise silently drop
  // healShieldPower (e.g. Jungle) to 0.
  const hsp = computeStats(unit).healShieldPower
  const scaled = hsp > 0 ? Math.round(amount * (1 + hsp)) : amount
  const effective = healBlock ? Math.round(scaled * (1 - (healBlock.magnitude ?? 0.33))) : scaled
  const actual = Math.min(effective, unit.maxHp - unit.currentHp)
  unit.currentHp += actual
  if (actual > 0) {
    state.events.push({ type: 'heal', targetId: unit.id, amount: actual, sourceId })
    creditTraitHealShield(unit, unit.traitHeal, actual, hsp, traitSource)
  }
  return actual
}

// Attribute a heal/shield to traits: the amplification portion (actual × hsp/(1+hsp))
// splits among heal/shield-power traits (Jungle) by their share; if the heal/shield
// itself IS a trait's effect (traitSource), that trait gets the un-amplified base.
export function creditTraitHealShield(unit: Unit, tally: Record<string, number>, actual: number, hsp: number, traitSource?: string): void {
  if (actual <= 0) return
  const base = hsp > 0 ? actual / (1 + hsp) : actual
  if (traitSource) tally[traitSource] = (tally[traitSource] ?? 0) + base
  if (hsp > 0 && unit._traitStat) {
    for (const t in unit._traitStat) {
      const th = unit._traitStat[t].hsp
      if (th > 0) tally[t] = (tally[t] ?? 0) + actual * th / (1 + hsp)
    }
  }
}
