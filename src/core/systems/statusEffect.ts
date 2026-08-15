import type { Unit, CombatState, StatusEffect } from '../types'
import { applyHeal } from './heal'
import { cancelInFlightMovement, releaseHexes } from './movement'
import { TICK_RATE } from '../constants'

// Crowd-control status ids whose duration is shortened by Tenacity
const CC_IDS = new Set(['stun', 'knockUp', 'charm', 'chill', 'blind', 'confuse', 'silence'])

// Add a status effect, respecting stackId deduplication
export function addStatusEffect(unit: Unit, effect: StatusEffect): void {
  // CC immunity — block stuns and knockups (Mega Rayquaza; Covert Cloak)
  if (effect.id === 'stun' || effect.id === 'knockUp') {
    if (unit.statusEffects.some(fx => fx.id === 'rayquaza_is_mega' || fx.id === 'cc_immune')) return
  }
  // Full crowd-control immunity (Covert Cloak): block EVERY CC effect.
  if (CC_IDS.has(effect.id) && unit.statusEffects.some(fx => fx.id === 'cc_immune')) return

  // Tenacity: incoming CC lasts (1 − tenacity)× as long
  if (CC_IDS.has(effect.id) && effect.durationTicks > 0) {
    const tenacity = unit.statusEffects.reduce(
      (sum, fx) => fx.id === 'tenacity' ? sum + (fx.magnitude ?? 0) : sum, 0)
    if (tenacity > 0) {
      effect = {
        ...effect,
        durationTicks: Math.max(1, Math.round(effect.durationTicks * (1 - Math.min(tenacity, 0.9)))),
      }
    }
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

// ─── Burn (item-applied) ──────────────────────────────────────────────────────
// The standard "on-hit" burn used by Charcoal / Flame Orb: a small tick of true
// damage each second AND a healing cut, both refreshing on every application.
export const ITEM_BURN_DURATION_SEC = 4
export const ITEM_BURN_HP_PCT_PER_SEC = 0.01   // 1% of the target's max HP each second
export const ITEM_BURN_HEAL_CUT = 0.33         // healing reduced by 33% while burning

export function applyBurn(target: Unit, sourceId: string, _state: CombatState): void {
  const dur = ITEM_BURN_DURATION_SEC * TICK_RATE
  const perSec = Math.max(1, Math.round(target.maxHp * ITEM_BURN_HP_PCT_PER_SEC))
  addStatusEffect(target, {
    id: 'burn',
    sourceUnitId: sourceId,
    durationTicks: dur,
    magnitude: perSec,
    tickInterval: TICK_RATE,
    tickEffect: (u, st) => {
      u.currentHp = Math.max(0, u.currentHp - perSec)
      st.events.push({ type: 'damage', targetId: u.id, amount: perSec, damageType: 'true', isCrit: false, sourceId, abilityId: 'burn' })
      if (u.currentHp <= 0) {
        u.currentHp = 0
        u.state = 'dead'
        releaseHexes(u, st)
        st.events.push({ type: 'death', unitId: u.id, sourceId, abilityId: 'burn' })
      }
    },
    stackId: `item_burn_${target.id}`,
  })
  // Healing cut (heal.ts reads 'healBlock'). Separate stackId so it doesn't clobber
  // other heal-block sources.
  addStatusEffect(target, {
    id: 'healBlock',
    sourceUnitId: sourceId,
    durationTicks: dur,
    magnitude: ITEM_BURN_HEAL_CUT,
    stackId: `item_burn_healcut_${target.id}`,
  })
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
            releaseHexes(unit, state)
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
            releaseHexes(unit, state)
            state.events.push({ type: 'death', unitId: unit.id, sourceId: fx.sourceUnitId, abilityId: 'leech_seed' })
            break
          }

          const source = state.units.get(fx.sourceUnitId)
          if (source && source.state !== 'dead' && healAmt > 0) {
            applyHeal(source, healAmt, fx.sourceUnitId, state)
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
      if (isStunned || isKnockedUp) {
        // Being forced out of an in-progress slide/leap needs cleanup — see
        // cancelInFlightMovement — otherwise hexOccupancy desyncs from
        // hexPos and a later unit can end up sharing this unit's hex.
        if (unit.state === 'moving' || unit.state === 'leaping') cancelInFlightMovement(unit, state)
        unit.state = isStunned ? 'stunned' : 'knockedUp'
      }
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
