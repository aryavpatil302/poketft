import type { Unit, Shield, CombatState } from '../types'
import { computeStats } from '../unitFactory'
import { creditTraitHealShield } from './heal'

export function addShield(unit: Unit, shield: Shield, state: CombatState, traitSource?: string): void {
  const healBlock = unit.statusEffects.find(fx => fx.id === 'healBlock')
  if (healBlock?.magnitude) {
    const reduction = 1 - healBlock.magnitude
    shield = { ...shield, value: Math.round(shield.value * reduction), maxValue: Math.round(shield.maxValue * reduction) }
  }
  // Never trust a cached _computedStats here: callers often grant other status
  // effects (which null the cache — see addStatusEffect) immediately before
  // shielding in the same tick, which would otherwise silently drop
  // healShieldPower (e.g. Jungle) to 0.
  const hsp = computeStats(unit).healShieldPower
  if (hsp > 0) {
    const mult = 1 + hsp
    shield = {
      ...shield,
      value:    Math.round(shield.value * mult),
      maxValue: Math.round(shield.maxValue * mult),
    }
  }
  // Freeze the HP-bar extension at cast time (current HP + the shield's capacity)
  // so the bar's scale stays stable while the shield absorbs damage. Set here for
  // EVERY shield — this used to be each caller's job and most didn't do it, so some
  // shields extended the bar past max HP and others clipped at it. The renderer
  // also grows the scale if later healing pushes HP+shield past this value.
  shield = { ...shield, effectiveMaxHp: unit.currentHp + shield.maxValue, traitSource: traitSource ?? shield.traitSource }
  unit.shields.push(shield)
  // sourceId = the caster (defaults to the holder for self-shields) so consumers can
  // tell self-shielding from ally-shielding.
  state.events.push({ type: 'shield', unitId: unit.id, amount: shield.value, sourceId: shield.sourceUnitId ?? unit.id })
  creditTraitHealShield(unit, unit.traitShield, shield.value, hsp, traitSource)
}
