import type { PersistentAoEZone, CombatState } from '../types'
import { hexesInRange, hexId } from '../hexGrid'
import { applyDamage } from './damage'
import { applyHeal } from './heal'
import { addStatusEffect } from './statusEffect'
import { computeStats } from '../unitFactory'

export function createPersistentAoEZone(state: CombatState, zone: PersistentAoEZone): void {
  state.persistentAoEZones.push({ ...zone })
}

export function removePersistentAoEZone(state: CombatState, id: string): void {
  state.persistentAoEZones = state.persistentAoEZones.filter(z => z.id !== id)
}

export function tickPersistentAoEZones(state: CombatState): void {
  const toRemove: string[] = []

  for (const zone of state.persistentAoEZones) {
    // Duration countdown
    if (zone.durationTicks !== -1) {
      zone.durationTicks--
      if (zone.durationTicks <= 0) {
        toRemove.push(zone.id)
        if (zone.onExpire) zone.onExpire(state)
        continue
      }
    }

    // Fire damage at interval
    if (state.tick - zone.lastFiredTick < zone.intervalTicks) continue
    zone.lastFiredTick = state.tick

    const source = state.units.get(zone.sourceUnitId)

    for (const hex of hexesInRange(zone.center, zone.radius)) {
      const uid = state.hexOccupancy.get(hexId(hex))
      if (!uid) continue
      const target = state.units.get(uid)
      if (!target || target.state === 'dead') continue
      if (zone.targetTeam !== 'both' && target.team !== zone.targetTeam) continue

      let finalDamage = 0
      const wasAlive = target.state !== 'dead'
      if (source) {
        const result = applyDamage(source, target, {
          baseAmount: zone.damagePerInterval,
          damageType: zone.damageType,
          canCrit: false,
        }, state)
        finalDamage = result.finalDamage
      } else {
        // Source dead — apply damage directly
        target.currentHp = Math.max(0, target.currentHp - zone.damagePerInterval)
        state.events.push({ type: 'damage', targetId: target.id, amount: zone.damagePerInterval, damageType: zone.damageType, isCrit: false, sourceId: zone.sourceUnitId })
        finalDamage = zone.damagePerInterval
      }

      if (wasAlive && target.state === 'dead' && zone.onKill) zone.onKill(zone, state)

      // Heal source for a fraction of damage dealt
      if (zone.healPct && zone.healPct > 0 && source && source.state !== 'dead' && finalDamage > 0) {
        applyHeal(source, Math.round(finalDamage * zone.healPct), source.id, state)
      }

      if (zone.armorReduction && zone.armorReduction > 0) {
        addStatusEffect(target, { id: 'sunder', sourceUnitId: zone.sourceUnitId, durationTicks: zone.intervalTicks + 5, magnitude: zone.armorReduction, stackId: `${zone.id}_sunder_${uid}` })
      }
      if (zone.spDefReduction && zone.spDefReduction > 0) {
        addStatusEffect(target, { id: 'shred', sourceUnitId: zone.sourceUnitId, durationTicks: zone.intervalTicks + 5, magnitude: zone.spDefReduction, stackId: `${zone.id}_shred_${uid}` })
      }

      // Percentage-based armor/MR shred — computed per-target from their current stats
      if (zone.armorReductionPct && zone.armorReductionPct > 0) {
        const stats = computeStats(target)
        const flatArmor = Math.round(stats.defense * zone.armorReductionPct)
        if (flatArmor > 0) addStatusEffect(target, { id: 'sunder', sourceUnitId: zone.sourceUnitId, durationTicks: zone.intervalTicks + 5, magnitude: flatArmor, stackId: `${zone.id}_armorpct_${uid}` })
      }
      if (zone.spDefReductionPct && zone.spDefReductionPct > 0) {
        const stats = computeStats(target)
        const flatSpDef = Math.round(stats.spDefense * zone.spDefReductionPct)
        if (flatSpDef > 0) addStatusEffect(target, { id: 'shred', sourceUnitId: zone.sourceUnitId, durationTicks: zone.intervalTicks + 5, magnitude: flatSpDef, stackId: `${zone.id}_spdefpct_${uid}` })
      }
    }
  }

  if (toRemove.length > 0) {
    state.persistentAoEZones = state.persistentAoEZones.filter(z => !toRemove.includes(z.id))
  }
}
