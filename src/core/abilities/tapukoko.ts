import type { AbilityHandler } from '../systems/ability'
import type { CombatState, Unit, AttackModifier, PassiveAttackHandler } from '../types'
import { TICK_RATE } from '../constants'
import { applyDamage } from '../systems/damage'
import { addStatusEffect } from '../systems/statusEffect'
import { isTerrainActive } from '../systems/terrain'
import { createProjectile } from '../projectile'
import { computeStats } from '../unitFactory'
import { hexDistance } from '../hexGrid'

const PASSIVE_ID    = 'tapukoko_chain'
const VISUAL_MOD_ID = 'tapukoko_bolt_visual'
const SURGE_MOD_ID  = 'tapukoko_surge'

const CHAIN_TARGETS = 3     // enemies hit per chain (struck target + 2 nearest others)
const CHAIN_RADIUS  = 2     // chain can only jump to enemies within this many hexes of the struck unit
const CHAIN_PCT     = 0.40  // 40% attack as bonus magic damage
const SURGE_BONUS_PCT   = [2.50, 3.00, 20.00] as const
const SURGE_AS_PER_AUTO = [0.03, 0.05, 0.20] as const
const SURGE_STUN_TICKS  = 1 * TICK_RATE

// Quick cast rumble: cast lockout is only this long, so Koko resumes autoing
// right after the rumble. unitLayer keys its shake+grow off this same length.
export const TAPUKOKO_RUMBLE_TICKS = 24

/**
 * Chain lightning out of the struck unit: hits the struck target plus the
 * nearest other enemies within CHAIN_RADIUS hexes of it (CHAIN_TARGETS total),
 * each taking 40% attack as magic damage. Empowered chains (from the cast)
 * also stun and add 250/300/2000% attack damage per enemy hit.
 */
function fireChainLightning(
  source: Unit,
  struck: Unit,
  state: CombatState,
  empowered: boolean,
  tier: number,
): void {
  const stats    = source._computedStats ?? computeStats(source)
  const chainDmg = Math.round(stats.attack * CHAIN_PCT)
  const bonusDmg = empowered ? Math.round(stats.attack * SURGE_BONUS_PCT[tier - 1]) : 0

  const others = [...state.units.values()]
    .filter(u => u.team !== source.team && u.state !== 'dead' && u.id !== struck.id)
    .filter(u => hexDistance(u.hexPos, struck.hexPos) <= CHAIN_RADIUS)
    .sort((a, b) => hexDistance(a.hexPos, struck.hexPos) - hexDistance(b.hexPos, struck.hexPos))
    .slice(0, CHAIN_TARGETS - 1)
  const targets = struck.state !== 'dead' ? [struck, ...others] : others

  for (const t of targets) {
    // Bolt arcs out of the struck unit toward each chained target (the struck
    // unit itself just flashes in place — it's the source, not a jump target)
    state.events.push({
      type: 'vfx', effectId: 'tapukoko_chain',
      fromX: struck.visualPos.x, fromY: struck.visualPos.y,
      unitId: t.id, x: t.visualPos.x, y: t.visualPos.y,
      empowered,
    })
    applyDamage(source, t, {
      baseAmount: chainDmg + bonusDmg,
      damageType: 'magic',
      canCrit: false,
      abilityId: 'tapukoko_natures_madness',
    }, state)
    if (empowered && t.state !== 'dead') {
      addStatusEffect(t, {
        id: 'stun',
        sourceUnitId: source.id,
        durationTicks: SURGE_STUN_TICKS,
        stackId: 'tapukoko_stun',
      })
    }
  }
}

export const TapuKokoAbility: AbilityHandler = {
  abilityId: 'tapukoko_natures_madness',
  castTimeTicks: TAPUKOKO_RUMBLE_TICKS,

  onCombatStart(unit: Unit): void {
    // Permanent visual modifier: every auto renders as a Surge Surfer bolt.
    // Infinite charges — it never pops off the queue; the cast's 1-charge surge
    // modifier is unshifted in front of it and consumes first.
    const visualMod: AttackModifier = {
      id: VISUAL_MOD_ID,
      remainingCharges: Infinity,
      visualId: 'tapukoko_bolt',
    }
    unit.attackModifiers.push(visualMod)

    const handler: PassiveAttackHandler = {
      id: PASSIVE_ID,
      onAttack(src: Unit, tgt: Unit, st: CombatState): void {
        const isThird = src.attackCount % 3 === 0
        // Size the in-flight bolt — every 3rd is the big one
        visualMod.visualId = isThird ? 'tapukoko_bolt_big' : 'tapukoko_bolt'

        // After casting, each auto stacks attack speed while Electric Terrain is up
        const charged = src.statusEffects.find(fx => fx.stackId === 'tapukoko_surge_charged')
        if (charged?.magnitude && isTerrainActive(st, 'electric')) {
          addStatusEffect(src, {
            id: 'atkSpd_buff',
            sourceUnitId: src.id,
            durationTicks: -1,
            magnitude: charged.magnitude,
            stackId: `tapukoko_as_${src.attackCount}`,
          })
        }

        if (!isThird) return
        // The empowered auto fires its own (stunning) chain via the surge modifier
        if (src.attackModifiers[0]?.id === SURGE_MOD_ID) return
        if (src.statusEffects.some(fx => fx.id === 'blind')) return  // blinded autos miss

        // The chain comes out of the struck unit when the auto LANDS: ride an
        // invisible companion projectile that matches the auto bolt's flight.
        const proj = createProjectile({
          sourceId: src.id,
          targetId: tgt.id,
          startPos: { ...src.visualPos },
          speed: 8,
          abilityId: 'tapukoko_chain_carrier',
          onHit: (s2, t2, st2) => {
            if (s2 && s2.state !== 'dead') fireChainLightning(s2, t2, st2, false, s2.tier)
          },
        })
        st.projectiles.set(proj.id, proj)
      },
    }
    unit.passiveAttackHandlers.push(handler)
  },

  onCast(unit: Unit, state: CombatState, tier: number): void {
    // Surge: the next auto (and its chain) stuns and deals bonus damage.
    // onHit fires when the projectile lands, so stun + chain start on impact.
    // The empowered bolt is blue and flies much faster than a normal auto.
    const surgeMod: AttackModifier = {
      id: SURGE_MOD_ID,
      remainingCharges: 1,
      visualId: 'tapukoko_bolt_surge',
      projectileSpeed: 18,
      onHit: (src, tgt, st) => fireChainLightning(src, tgt, st, true, src.tier),
    }
    unit.attackModifiers.unshift(surgeMod)

    // Electric Terrain: from now on, every auto stacks attack speed
    if (isTerrainActive(state, 'electric')) {
      addStatusEffect(unit, {
        id: 'tapukoko_surge_charged',
        sourceUnitId: unit.id,
        durationTicks: -1,
        magnitude: SURGE_AS_PER_AUTO[tier - 1],
        stackId: 'tapukoko_surge_charged',
      })
    }

    // Resume autoing immediately after the quick rumble (tickAbilityCast starts
    // the windup on this same tick when attackTimer is 0)
    unit.attackTimer = 0
  },
}
