import type { Unit, CombatState, StatusEffect } from '../types'
import { hexId } from '../hexGrid'

// Add a status effect, respecting stackId deduplication
export function addStatusEffect(unit: Unit, effect: StatusEffect): void {
  // Mega Rayquaza is CC immune — block stuns and knockups before they land
  if ((effect.id === 'stun' || effect.id === 'knockUp') &&
      unit.statusEffects.some(fx => fx.id === 'rayquaza_is_mega')) {
    return
  }

  if (effect.stackId) {
    const existing = unit.statusEffects.findIndex(e => e.stackId === effect.stackId)
    if (existing >= 0) {
      // Refresh duration (and magnitude if provided)
      unit.statusEffects[existing].durationTicks = effect.durationTicks
      if (effect.magnitude !== undefined) {
        unit.statusEffects[existing].magnitude = effect.magnitude
        unit._computedStats = null  // magnitude changed — recompute
      }
      return
    }
  }
  unit.statusEffects.push({ ...effect })
  unit._computedStats = null  // new effect may change computed stats
}

// Remove all status effects matching an ID
export function removeStatusEffect(unit: Unit, effectId: string): void {
  unit.statusEffects = unit.statusEffects.filter(e => e.id !== effectId)
  unit._computedStats = null
}

// Remove by stackId
export function removeStatusEffectByStack(unit: Unit, stackId: string): void {
  unit.statusEffects = unit.statusEffects.filter(e => e.stackId !== stackId)
  unit._computedStats = null
}

// Tick all status effects on all living units
export function tickStatusEffects(units: Map<string, Unit>, state: CombatState): void {
  for (const unit of units.values()) {
    if (unit.state === 'dead') continue

    const toRemove: string[] = []

    for (const fx of unit.statusEffects) {
      // Callback-driven periodic effects
      if (fx.tickEffect) {
        const interval = fx.tickInterval ?? 1
        if (state.tick % interval === 0) {
          fx.tickEffect(unit, state)
          if (unit.state === 'dead') break
        }
      } else {
        // Legacy hardcoded periodic effects (burn, leech_seed)
        if (fx.id === 'burn' && fx.magnitude) {
          unit.currentHp = Math.max(0, unit.currentHp - fx.magnitude)
          state.events.push({
            type: 'damage',
            targetId: unit.id,
            amount: fx.magnitude,
            damageType: 'true',
            isCrit: false,
            sourceId: fx.sourceUnitId,
            abilityId: 'burn',
          })
          if (unit.currentHp <= 0) {
            unit.currentHp = 0
            unit.state = 'dead'
            state.hexOccupancy.delete(hexId(unit.hexPos))
            state.events.push({ type: 'death', unitId: unit.id, sourceId: fx.sourceUnitId, abilityId: 'burn' })
            break
          }
        }

        if (fx.id === 'leech_seed' && fx.magnitude && state.tick % 60 === 0) {
          const dmg     = Math.round(fx.magnitude)
          const healAmt = Math.round(fx.magnitude / 2)

          unit.currentHp = Math.max(0, unit.currentHp - dmg)
          state.events.push({
            type: 'damage', targetId: unit.id, amount: dmg,
            damageType: 'magic', isCrit: false, sourceId: fx.sourceUnitId, abilityId: 'leech_seed',
          })
          if (unit.currentHp <= 0) {
            unit.currentHp = 0
            unit.state = 'dead'
            state.hexOccupancy.delete(hexId(unit.hexPos))
            state.events.push({ type: 'death', unitId: unit.id, sourceId: fx.sourceUnitId, abilityId: 'leech_seed' })
            break
          }

          const source = state.units.get(fx.sourceUnitId)
          if (source && source.state !== 'dead' && healAmt > 0) {
            source.currentHp = Math.min(source.currentHp + healAmt, source.maxHp)
            state.events.push({ type: 'heal', targetId: source.id, amount: healAmt, sourceId: fx.sourceUnitId, abilityId: 'leech_seed' })
            state.events.push({ type: 'leech_drain', sourceUnitId: unit.id, venusaurId: source.id })
          }
        }
      }

      // Duration countdown
      if (fx.durationTicks !== -1) {
        fx.durationTicks--
        if (fx.durationTicks <= 0) {
          toRemove.push(fx.stackId ?? fx.id)

          if (fx.onExpire) {
            fx.onExpire(unit, state)
          } else if (fx.id === 'stun' || fx.id === 'knockUp') {
            if (unit.state === 'stunned' || unit.state === 'knockedUp') {
              unit.state = 'idle'
            }
          }
        }
      }
    }

    // Remove expired effects
    if (toRemove.length > 0) {
      unit.statusEffects = unit.statusEffects.filter(fx => {
        const key = fx.stackId ?? fx.id
        return !toRemove.includes(key) || fx.durationTicks === -1
      })
      unit._computedStats = null  // expired effects may have changed computed stats
    }

    // Apply stun/knockUp state
    if (unit.state !== 'dead') {
      const isStunned   = unit.statusEffects.some(fx => fx.id === 'stun')
      const isKnockedUp = unit.statusEffects.some(fx => fx.id === 'knockUp')
      if (isStunned)        unit.state = 'stunned'
      else if (isKnockedUp) unit.state = 'knockedUp'
    }

    // Sync silenced flag
    unit.silenced = unit.statusEffects.some(fx => fx.id === 'silence')
  }
}

// Tick all shields — decrement durations, fire onExpire, remove expired
export function tickShields(units: Map<string, Unit>): void {
  for (const unit of units.values()) {
    if (unit.state === 'dead') continue

    const toRemove: string[] = []
    for (const shield of unit.shields) {
      if (shield.durationTicks === -1) continue
      shield.durationTicks--
      if (shield.durationTicks <= 0) {
        toRemove.push(shield.id)
        if (shield.onExpire) shield.onExpire(unit, shield)
      }
    }
    if (toRemove.length > 0) {
      unit.shields = unit.shields.filter(s => !toRemove.includes(s.id))
    }
  }
}
