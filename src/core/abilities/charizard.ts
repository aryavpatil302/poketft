import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit } from '../types'
import { applyDamage } from '../systems/damage'
import { addMark, hasMark, removeMark } from '../systems/marks'
import { findNearestEnemies } from '../systems/targeting'
import { hexDistance } from '../hexGrid'
import { createProjectile } from '../projectile'

const MARK_ID = 'charizard_flame_mark'

export const CharizardAbility: AbilityHandler = {
  abilityId: 'charizard_blast_burn',
  castTimeTicks: 20,

  onCast(unit: Unit, state: CombatState, tier: number): void {
    const fireballCounts  = [3, 4, 10]   as const
    const fireballDamages = [300, 500, 2000] as const
    const killCounts      = [1, 1, 10]   as const
    const detonateDamages = [500, 700, 3000] as const

    const fireballCount  = fireballCounts[tier - 1]
    const fireballDamage = fireballDamages[tier - 1]
    const killCount      = killCounts[tier - 1]
    const detonateDamage = detonateDamages[tier - 1]
    const sourceId       = unit.id

    const markedEnemies = [...state.units.values()].filter(
      u => u.team !== unit.team && u.state !== 'dead' && hasMark(u, MARK_ID)
    )

    if (markedEnemies.length === 0) {
      // ── Phase 1: Fire fireballs to mark enemies within Charizard's range ────
      const targets = findNearestEnemies(unit, state, fireballCount)
        .filter(t => hexDistance(unit.hexPos, t.hexPos) <= unit.range)
      for (const target of targets) {
        const targetId = target.id
        const proj = createProjectile({
          sourceId,
          targetId,
          startPos: { ...unit.visualPos },
          speed: 10,
          abilityId: 'blast_burn_fireball',
          onHit: (src, tgt, st) => {
            if (tgt.state === 'dead') return
            applyDamage(src ?? unit, tgt, {
              baseAmount: fireballDamage,
              damageType: 'physical',
              canCrit: true,
              abilityId: 'charizard_blast_burn',
            }, st)
            addMark(tgt, { id: MARK_ID, sourceUnitId: sourceId, durationTicks: -1 })
            st.events.push({ type: 'vfx', effectId: 'blast_burn_mark_apply', unitId: targetId, x: tgt.visualPos.x, y: tgt.visualPos.y })
          },
        })
        state.projectiles.set(proj.id, proj)
      }
    } else {
      // ── Phase 2: Powerful blasts — kill top N by HP, detonate the rest ──────
      const sorted = [...markedEnemies].sort((a, b) => b.currentHp - a.currentHp)
      const toKill  = sorted.slice(0, killCount)
      const toBlast = sorted.slice(killCount)

      for (const target of toKill) {
        const targetId = target.id
        const proj = createProjectile({
          sourceId,
          targetId,
          startPos: { ...unit.visualPos },
          speed: 16,
          abilityId: 'blast_burn_execute_fireball',
          onHit: (src, tgt, st) => {
            removeMark(tgt, MARK_ID)
            st.events.push({ type: 'vfx', effectId: 'blast_burn_detonate', unitId: targetId, x: tgt.visualPos.x, y: tgt.visualPos.y })
            if (tgt.state === 'dead') return
            // Insta-kill: true damage exceeding max HP
            applyDamage(src ?? unit, tgt, {
              baseAmount: tgt.maxHp * 10,
              damageType: 'true',
              canCrit: false,
              abilityId: 'charizard_blast_burn',
            }, st)
          },
        })
        state.projectiles.set(proj.id, proj)
      }

      for (const target of toBlast) {
        const targetId = target.id
        const proj = createProjectile({
          sourceId,
          targetId,
          startPos: { ...unit.visualPos },
          speed: 14,
          abilityId: 'blast_burn_powerful_fireball',
          onHit: (src, tgt, st) => {
            removeMark(tgt, MARK_ID)
            st.events.push({ type: 'vfx', effectId: 'blast_burn_detonate', unitId: targetId, x: tgt.visualPos.x, y: tgt.visualPos.y })
            if (tgt.state === 'dead') return
            applyDamage(src ?? unit, tgt, {
              baseAmount: detonateDamage,
              damageType: 'physical',
              canCrit: false,
              abilityId: 'charizard_blast_burn',
            }, st)
          },
        })
        state.projectiles.set(proj.id, proj)
      }
    }
  },
}
