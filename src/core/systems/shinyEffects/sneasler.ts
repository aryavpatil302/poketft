import type { CombatState, Unit } from '../../types'
import { TICK_RATE } from '../../constants'
import { addStatusEffect } from '../statusEffect'
import { applyDamage } from '../damage'
import { registerShinyEffect } from '../shinyEffects'

// ─── Investigation note (see the batch plan's flag on this species) ───────────
// There is no existing helper that grants a temporary, team-wide, time-boxed
// on-hit modifier. `attackModifiers` (types.ts) is the only mechanism that
// lets an ally's own auto-attacks trigger extra on-hit logic, but it's a
// FIFO queue of finite-charge buffs consumed one attack at a time (see
// attack.ts's fireAttack/applyAttackModifier — `remainingCharges--`, shifted
// off the array at 0) with no built-in duration field. Its one existing
// team-push precedent, Armarouge's own `armarouge_cannon_auto`
// (abilities/armarouge.ts:84-114), grants it to the CASTER's own unit only,
// permanently for the fight.
//
// This pushes the SAME shape of modifier onto every living ally (Sneasler
// included) at combat start, with a very high `remainingCharges` so it's
// never exhausted by charge count alone. The "first 10 seconds" window is
// enforced two ways, mirroring Armarouge's cannon_mode precedent exactly
// (armarouge.ts:69-78, its onExpire filtering armarouge_cannon_auto back out):
//   1. Belt: the modifier's own `onHit` re-checks `state.tick` against the
//      captured combat-start tick before applying poison, so even if cleanup
//      below is ever skipped it silently stops doing anything after 10s —
//      exactly the tick-comparison gate the plan calls for, instead of
//      adding a duration field to the shared AttackModifier type.
//   2. Suspenders: a companion status effect on each ally, durationTicks: 10
//      * TICK_RATE, whose onExpire filters the modifier back out of that
//      ally's attackModifiers array — so the queue isn't permanently
//      occupied by a no-op modifier (and doesn't block a later modifier from
//      ever reaching the front) for the rest of the fight.
const POISON_WINDOW_TICKS   = 10 * TICK_RATE
const POISON_MAGNITUDE      = 15   // damage per tick
const POISON_DURATION_TICKS = 3 * TICK_RATE
const MODIFIER_ID = 'sneasler_shiny_poison'

registerShinyEffect('sneasler', {
  id: 'sneasler_shiny_dire_claw',
  description: 'Ally attacks poison enemies for the first 10 seconds of combat.',
  onCombatStart(self: Unit, state: CombatState): void {
    const startTick = state.tick

    for (const ally of state.units.values()) {
      if (ally.team !== self.team || ally.isDummy) continue

      ally.attackModifiers.push({
        id: MODIFIER_ID,
        remainingCharges: 9999,
        onHit: (source: Unit, target: Unit, st: CombatState) => {
          if (st.tick >= startTick + POISON_WINDOW_TICKS) return
          if (target.state === 'dead') return

          addStatusEffect(target, {
            id: 'poison',
            sourceUnitId: source.id,
            durationTicks: POISON_DURATION_TICKS,
            magnitude: POISON_MAGNITUDE,
            tickInterval: TICK_RATE,
            stackId: 'sneasler_shiny_poison',
            tickEffect: (u: Unit, s2: CombatState) => {
              if (u.state === 'dead') return
              applyDamage(source, u, {
                baseAmount: POISON_MAGNITUDE,
                damageType: 'magic',
                canCrit: false,
                abilityScalingStat: 'special',
                abilityId: 'sneasler_shiny_poison',
              }, s2)
            },
          })
        },
      })

      addStatusEffect(ally, {
        id: 'sneasler_shiny_poison_window',
        sourceUnitId: self.id,
        durationTicks: POISON_WINDOW_TICKS,
        stackId: `sneasler_shiny_poison_window_${ally.id}`,
        onExpire: (u: Unit) => {
          u.attackModifiers = u.attackModifiers.filter(m => m.id !== MODIFIER_ID)
        },
      })
    }
  },
})
