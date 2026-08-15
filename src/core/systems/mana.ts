import type { Unit } from '../types'
import { MANA_PER_AUTO_HIT, MANA_PER_DAMAGE_PCT, MANA_LOCK_TICKS } from '../constants'

// Called on the attacker after a successful auto-attack hit
export function gainManaOnHit(unit: Unit): void {
  if (unit.manaLockTimer > 0) return
  if (unit.statusEffects.some(fx => fx.suppressManaGain)) return
  const keenFx = unit.statusEffects.find(fx => fx.stackId === 'keen_eye_mana_boost')
  const mult = keenFx ? 1 + (keenFx.magnitude ?? 0) : 1
  const before = unit.currentMana
  unit.currentMana = Math.min(unit.maxMana, unit.currentMana + Math.round(MANA_PER_AUTO_HIT * mult))
  creditKeenEye(unit, unit.currentMana - before, mult)
}

// The Keen Eye mana boost's share of a mana gain → fractional "extra casts enabled".
function creditKeenEye(unit: Unit, added: number, mult: number): void {
  if (mult <= 1 || added <= 0 || unit.maxMana <= 0) return
  unit.traitCount.keen_eye = (unit.traitCount.keen_eye ?? 0) + (added * (mult - 1) / mult) / unit.maxMana
}

// Called on the defender after taking pre-mitigation damage
export function gainManaOnDamageTaken(unit: Unit, preMitigDamage: number): void {
  if (unit.manaLockTimer > 0) return
  if (unit.statusEffects.some(fx => fx.suppressManaGain)) return
  const keenFx = unit.statusEffects.find(fx => fx.stackId === 'keen_eye_mana_boost')
  const mult = keenFx ? 1 + (keenFx.magnitude ?? 0) : 1
  const gain = Math.floor(preMitigDamage * MANA_PER_DAMAGE_PCT * mult)
  const before = unit.currentMana
  unit.currentMana = Math.min(unit.maxMana, unit.currentMana + gain)
  creditKeenEye(unit, unit.currentMana - before, mult)
}

// Called after ability fires — suppress mana gain for 1 second
export function applyManaLock(unit: Unit): void {
  unit.manaLockTimer = MANA_LOCK_TICKS
  unit.currentMana = 0
}

// Tick: decrement the mana lock timer
export function tickManaLock(unit: Unit): void {
  if (unit.manaLockTimer > 0) unit.manaLockTimer--
}

// Returns true if unit is ready to cast (full mana, no lock)
export function isReadyToCast(unit: Unit): boolean {
  return unit.manaLockTimer <= 0 && unit.maxMana > 0 && unit.currentMana >= unit.maxMana
}
