import type { Unit } from '../types'
import { MANA_PER_AUTO_HIT, MANA_PER_DAMAGE_PCT, MANA_LOCK_TICKS } from '../constants'

// Called on the attacker after a successful auto-attack hit
export function gainManaOnHit(unit: Unit): void {
  if (unit.manaLockTimer > 0) return
  unit.currentMana = Math.min(unit.maxMana, unit.currentMana + MANA_PER_AUTO_HIT)
}

// Called on the defender after taking pre-mitigation damage
export function gainManaOnDamageTaken(unit: Unit, preMitigDamage: number): void {
  if (unit.manaLockTimer > 0) return
  const gain = Math.floor(preMitigDamage * MANA_PER_DAMAGE_PCT)
  unit.currentMana = Math.min(unit.maxMana, unit.currentMana + gain)
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
