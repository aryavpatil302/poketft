import type { Unit, CombatState, DamagePayload } from '../types'
import { computeStats } from '../unitFactory'
import { releaseHexes } from './movement'
import { TICK_RATE, OVERTIME_START_TICK, OVERTIME_DAMAGE_AMP, OVERTIME_DURABILITY_LOSS } from '../constants'
import { applyHeal } from './heal'
import { applyBurn } from './statusEffect'
import { AMP_EFFECT_TRAIT } from './traitAttribution'
import { combatRng } from '../rng'

// ─── Mitigation formula ───────────────────────────────────────────────────────
// Same formula as League of Legends:
//   armor >= 0 → reduction = armor / (armor + 100)
//   armor <  0 → reduction = 1 - (100 / (100 - armor))  which gives a multiplier > 1

export function mitigationFactor(resistance: number): number {
  if (resistance >= 0) {
    return resistance / (resistance + 100)
  } else {
    return 1 - 100 / (100 - resistance)
  }
}

// Attribute "damage reduced" to durability-granting traits (River aqua-ring): for
// each trait contributing armor/sp.def to the target, credit the extra damage its
// mitigation prevented on this hit (what would have landed at that much less
// durability, minus what actually landed).
function creditMitigation(target: Unit, preMitig: number, effDef: number, statKey: 'def' | 'spdef', durMult: number, piercePct?: number): void {
  const ts = target._traitStat
  if (!ts) return
  const landed = preMitig * (1 - mitigationFactor(effDef))
  for (const t in ts) {
    const raw = ts[t][statKey]
    if (raw <= 0) continue
    const effTrait = (piercePct ? raw * (1 - piercePct) : raw) * durMult
    const withoutTrait = preMitig * (1 - mitigationFactor(effDef - effTrait))
    const saved = withoutTrait - landed
    if (saved > 0) target.traitMitigated[t] = (target.traitMitigated[t] ?? 0) + saved
  }
}

export function rollCrit(unit: Unit): boolean {
  const stats = unit._computedStats
  const chance = stats ? stats.critChance : unit.critChance
  return combatRng() < chance
}

// ─── Shield absorption ────────────────────────────────────────────────────────
// Returns the remaining damage after shields have absorbed as much as possible.
// Shields absorb from front (index 0) to back.

function absorbWithShields(unit: Unit, damage: number, _state: CombatState): number {
  let remaining = damage
  for (const shield of unit.shields) {
    if (shield.value <= 0 || remaining <= 0) continue
    const absorbed = Math.min(shield.value, remaining)
    shield.value -= absorbed
    remaining -= absorbed
    // Attribute damage absorbed by a trait-granted shield (e.g. Zen) to that trait.
    if (shield.traitSource && absorbed > 0) unit.traitMitigated[shield.traitSource] = (unit.traitMitigated[shield.traitSource] ?? 0) + absorbed
    if (shield.value <= 0) {
      // Shield broke — fire onExpire
      if (shield.onExpire) shield.onExpire(unit, shield)
    }
  }
  // Remove broken shields
  unit.shields = unit.shields.filter(s => s.value > 0)
  return remaining
}

// ─── Main damage pipeline ─────────────────────────────────────────────────────

export interface ApplyDamageResult {
  finalDamage: number    // damage that actually hit HP (after shields)
  preMitigDamage: number // damage before mitigation (for mana gain)
  isCrit: boolean
}

export function applyDamage(
  source: Unit,
  target: Unit,
  payload: DamagePayload,
  state: CombatState,
): ApplyDamageResult {
  if (target.state === 'dead') return { finalDamage: 0, preMitigDamage: 0, isCrit: false }
  if (target.definitionId === 'ruiner_stone') return { finalDamage: 0, preMitigDamage: 0, isCrit: false }
  if (target.statusEffects.some(fx => fx.stackId === 'ruiner_arise')) return { finalDamage: 0, preMitigDamage: 0, isCrit: false }

  const targetStats = target._computedStats ?? computeStats(target)
  const sourceStats = source._computedStats ?? computeStats(source)

  // Additive scaling: base += stat * ratio  (e.g. Toucannon 700% attack)
  let base = payload.baseAmount
  if (payload.scalingStat && payload.scalingRatio) {
    const scaleStat = payload.scalingStat === 'attack' ? sourceStats.attack : sourceStats.special
    base += scaleStat * payload.scalingRatio
  }
  // Multiplicative ability scaling: base *= stat / 100  (special = 100 → no change)
  if (payload.abilityScalingStat) {
    const scaleStat = payload.abilityScalingStat === 'attack' ? sourceStats.attack : sourceStats.special
    base = Math.round(base * scaleStat / 100)
  }

  // Incoming damage multiplier (Future Sight, etc.)
  if (target.incomingDamageMult !== 1.0) {
    base = Math.round(base * target.incomingDamageMult)
  }

  // Salamence Outrage: while Enraged, take 50% reduced damage from every
  // enemy except the current attack target
  const enragedFx = target.statusEffects.find(fx => fx.id === 'salamence_enraged')
  if (enragedFx && source.id !== target.targetId && source.id !== target.id) {
    base = Math.round(base * (1 - (enragedFx.magnitude ?? 0.5)))
  }

  // Roughneck: bonus damage to targets below 50% HP
  const roughneckFx = source.statusEffects.find(fx => fx.stackId === 'roughneck_bonus_dmg')
  let roughneckAmpMag = 0   // captured for trait attribution (HP re-checked post-damage otherwise)
  if (roughneckFx && target.maxHp > 0 && target.currentHp / target.maxHp < 0.5) {
    roughneckAmpMag = roughneckFx.magnitude ?? 0
    base = Math.round(base * (1 + roughneckAmpMag))
  }

  // Damage amp (Crashout trait, etc.): multiplies all outgoing damage.
  // Multiple amp statuses stack additively (team amp + rage amp = double).
  let ampTotal = 0
  for (const fx of source.statusEffects) {
    if (fx.id === 'damage_amp') ampTotal += fx.magnitude ?? 0
  }
  // Overtime: every unit deals +30% to force a result out of a stalemate.
  if (state.tick >= OVERTIME_START_TICK) ampTotal += OVERTIME_DAMAGE_AMP
  if (ampTotal > 0) base = Math.round(base * (1 + ampTotal))

  // Life Orb: the holder's ability (non-auto) damage is amplified.
  if (source.abilityDamageMult && payload.abilityId && payload.abilityId !== 'auto_attack') {
    base = Math.round(base * source.abilityDamageMult)
  }

  // Crit — base auto-attack damage always can. Ability damage (including the
  // extra bonus/splash damage tacked onto an empowered auto) can ONLY crit if
  // the source holds a crit-enabling item (Leek / Razor Claw, which sets
  // abilitiesCanCrit) AND the specific damage instance opts in via
  // payload.canCrit — some instances (DoT ticks, etc.) deliberately don't.
  // Auto attacks are the standard auto (abilityId 'auto_attack') and passives
  // that replace the base auto (Corkscrew, Drednaw), which set isAutoAttack.
  const isAutoAttack = payload.isAutoAttack === true || payload.abilityId === 'auto_attack'
  const abilityCanCrit = !isAutoAttack && payload.canCrit === true
    && !!payload.abilityId && source.abilitiesCanCrit === true
  let isCrit = false
  if ((isAutoAttack || abilityCanCrit) && (payload.forceCrit || (payload.canCrit && rollCrit(source)))) {
    base *= sourceStats.critDamage
    isCrit = true
  }

  const preMitigDamage = Math.round(base)

  // Track cumulative pre-mitigation damage for targeting heuristics
  target.damageTakenThisCombat += preMitigDamage

  // Mitigation. Overtime strips 30% of the target's durability (armor & sp.
  // defense) so fights don't stall — applied after armor-pierce, before the
  // mitigation curve. true damage ignores durability entirely, so it's untouched.
  const durabilityMult = state.tick >= OVERTIME_START_TICK ? (1 - OVERTIME_DURABILITY_LOSS) : 1
  let finalPreShield = preMitigDamage
  if (payload.damageType === 'physical') {
    const effectiveDefense = (payload.armorPiercePct
      ? targetStats.defense * (1 - payload.armorPiercePct)
      : targetStats.defense) * durabilityMult
    const red = mitigationFactor(effectiveDefense)
    finalPreShield = Math.round(preMitigDamage * (1 - red))
    creditMitigation(target, preMitigDamage, effectiveDefense, 'def', durabilityMult, payload.armorPiercePct)
  } else if (payload.damageType === 'magic') {
    const effectiveSpDef = (payload.spDefPiercePct
      ? targetStats.spDefense * (1 - payload.spDefPiercePct)
      : targetStats.spDefense) * durabilityMult
    const red = mitigationFactor(effectiveSpDef)
    finalPreShield = Math.round(preMitigDamage * (1 - red))
    creditMitigation(target, preMitigDamage, effectiveSpDef, 'spdef', durabilityMult, payload.spDefPiercePct)
  }
  // true damage: no mitigation

  // Note whether Ice Body shield is active before absorption (may be destroyed by it)
  const hadIceBodyShield = finalPreShield > 0
    && target.shields.some(s => s.sourceAbility === 'snorunt_ice_body' && s.value > 0)

  // Shields absorb before HP
  const hpDamage = absorbWithShields(target, finalPreShield, state)

  // Apply HP damage
  target.currentHp = Math.max(0, target.currentHp - hpDamage)

  // Track damage dealt by the source
  source.damageDealtThisCombat += hpDamage

  // Effective-HP: bonus max-HP traits (Bruiser/Volcano/Beachy/River) soak a share of
  // every hit proportional to how much of this unit's max HP they granted.
  if (hpDamage > 0 && target._traitHp && target.maxHp > 0) {
    for (const t in target._traitHp) {
      const share = target._traitHp[t] / target.maxHp
      if (share > 0) target.traitMitigated[t] = (target.traitMitigated[t] ?? 0) + hpDamage * Math.min(1, share)
    }
  }
  // Summon decoys/golems (Ruiner, Substitutor): all damage they soak is the trait's.
  if (hpDamage > 0 && target._traitOwner) target.traitMitigated[target._traitOwner] = (target.traitMitigated[target._traitOwner] ?? 0) + hpDamage

  // ── Trait contribution attribution (report's "trait contributions") ──────────
  // Partition this hit's HP damage by the marginal effect of each contributing
  // trait: trait-sourced amps (Crashout/Roughneck) get the portion they multiplied
  // on; the remaining base portion goes to direct trait damage (traitSource, 100%)
  // or is shared among stat-buff traits by their share of the scaling stat.
  if (hpDamage > 0) {
    const add = (t: string | undefined, amt: number): void => {
      if (!t || amt <= 0) return
      source.traitDmg[t] = (source.traitDmg[t] ?? 0) + amt
    }
    // Summoned units (Ruiner golem, Substitutor decoy): their whole output is the
    // trait's — credit the full hit to the owner trait and skip the shares below.
    if (source._traitOwner) source.traitDmg[source._traitOwner] = (source.traitDmg[source._traitOwner] ?? 0) + hpDamage
    let ampTot = 0
    const ampBits: Array<[string, number]> = []
    for (const fx of source.statusEffects) {
      if (fx.id === 'damage_amp' && (fx.magnitude ?? 0) > 0) { ampBits.push([AMP_EFFECT_TRAIT.damage_amp, fx.magnitude!]); ampTot += fx.magnitude! }
    }
    if (roughneckAmpMag > 0) { ampBits.push([AMP_EFFECT_TRAIT.roughneck_bonus_dmg, roughneckAmpMag]); ampTot += roughneckAmpMag }
    const basePortion = hpDamage / (1 + ampTot)
    for (const [t, m] of ampBits) add(t, hpDamage * m / (1 + ampTot))
    if (payload.traitSource) {
      add(payload.traitSource, basePortion)               // direct trait damage
    } else {
      // Flat trait fractions (Beachy spell buff, Corkscrew's extra dash hit) — a % of
      // the hit baked in by a trait. Split them off first so they aren't double-counted
      // by the stat-scaling share below.
      let flatFrac = 0
      const beachyFrac = Math.min(1, Math.max(0, payload.beachyFrac ?? 0))
      if (beachyFrac > 0) { add('beachy', basePortion * beachyFrac); flatFrac += beachyFrac }
      if (payload.traitFrac && payload.traitFrac.frac > 0) {
        const f = Math.min(1, payload.traitFrac.frac)
        add(payload.traitFrac.trait, basePortion * f); flatFrac += f
      }
      const statPortion = basePortion * Math.max(0, 1 - flatFrac)
      let scaleKey: 'atk' | 'sp' | null = null            // the stat this hit scaled off
      if (isAutoAttack) scaleKey = 'atk'
      else if (payload.scalingStat) scaleKey = payload.scalingStat === 'attack' ? 'atk' : 'sp'
      else if (payload.abilityScalingStat) scaleKey = payload.abilityScalingStat === 'attack' ? 'atk' : 'sp'
      const ts = source._traitStat
      if (scaleKey && ts) {
        const total = scaleKey === 'atk' ? sourceStats.attack : sourceStats.special
        if (total > 0) for (const t in ts) { const s = ts[t][scaleKey]; if (s > 0) add(t, statPortion * s / total) }
      }
    }
    // Attack-speed traits (Quickclaw, Sky Striker tailwind, Electric terrain): the
    // extra attacks they enable → a share of AUTO damage (bonusAS / totalAS).
    const tsAS = source._traitStat
    if (isAutoAttack && tsAS && sourceStats.attackSpeed > 0) {
      for (const t in tsAS) { const a = tsAS[t].as; if (a > 0) add(t, hpDamage * Math.min(a, sourceStats.attackSpeed) / sourceStats.attackSpeed) }
    }
    // Mystic sunder: the durability this hit's target lost to a Mystic ability let the
    // attacker deal more — credit that extra to Mystic.
    if (payload.damageType !== 'true') {
      const sunder = target.statusEffects.find(fx => fx.id === 'mystic_sunder')
      const m = sunder?.magnitude ?? 0
      if (m > 0 && m < 1) {
        const effDef = payload.damageType === 'physical' ? targetStats.defense : targetStats.spDefense
        const without = effDef / (1 - m)   // durability the target would have without the sunder
        const extra = preMitigDamage * (mitigationFactor(without) - mitigationFactor(effDef))
        if (extra > 0) add('mystic', extra * (hpDamage / Math.max(1, finalPreShield)))   // scale to post-shield
      }
    }
  }

  // Omnivamp: heal source for a fraction of HP damage dealt
  if (hpDamage > 0 && source.state !== 'dead') {
    const sourceStats = source._computedStats
    if (sourceStats && sourceStats.omnivamp > 0) {
      const heal = Math.round(hpDamage * sourceStats.omnivamp)
      if (heal > 0) {
        const actual = applyHeal(source, heal, source.id, state)
        // Attribute the omnivamp heal to omnivamp-granting traits (River) by share,
        // pre-amplification (Jungle's amplification is credited inside applyHeal).
        const ts = source._traitStat
        if (actual > 0 && ts) {
          const base = sourceStats.healShieldPower > 0 ? actual / (1 + sourceStats.healShieldPower) : actual
          for (const t in ts) { const o = ts[t].omni; if (o > 0) source.traitHeal[t] = (source.traitHeal[t] ?? 0) + base * o / sourceStats.omnivamp }
        }
      }
    }
  }

  // Emit event (absorbed = the portion shields ate, so consumers can report shield mitigation)
  state.events.push({
    type: 'damage',
    targetId: target.id,
    amount: hpDamage,
    damageType: payload.damageType,
    isCrit,
    sourceId: source.id,
    abilityId: payload.abilityId,
    absorbed: finalPreShield - hpDamage,
    empowered: payload.empowered === true || source._empoweredAuto === true,
  })

  // Death check
  if (target.currentHp <= 0) {
    target.currentHp = 0
    target.state = 'dead'
    releaseHexes(target, state)
    state.events.push({ type: 'death', unitId: target.id, sourceId: source.id, abilityId: payload.abilityId })
    for (const fx of target.statusEffects) fx.onDeath?.(target, state)
    for (const mark of target.marks) mark.onCarrierDeath?.(target, mark, state)
  }

  // Charcoal / Flame Orb: the holder's attacks and spells set the target ablaze —
  // a small burn plus reduced healing. Fires on any offensive hit from the holder
  // (auto or ability), not on burn ticks themselves.
  if (source.appliesBurnOnHit && target.state !== 'dead' && source.state !== 'dead'
      && source.team !== target.team && !!payload.abilityId && payload.abilityId !== 'burn') {
    applyBurn(target, source.id, state)
  }

  // Sky Striker execute: only active during the SOURCE team's tailwind — instantly kill targets at or below threshold HP
  if (target.state !== 'dead' && state.tailwind[source.team] && source.types.includes('sky_striker')) {
    const execFx = source.statusEffects.find(fx => fx.id === 'sky_striker_execute')
    if (execFx && execFx.magnitude !== undefined && target.currentHp / target.maxHp <= execFx.magnitude) {
      // Attribute the executed HP as Sky Striker damage, and count the execute.
      source.traitDmg.sky_striker = (source.traitDmg.sky_striker ?? 0) + target.currentHp
      source.traitCount.sky_striker = (source.traitCount.sky_striker ?? 0) + 1
      target.currentHp = 0
      target.state = 'dead'
      releaseHexes(target, state)
      state.events.push({ type: 'death', unitId: target.id, sourceId: source.id, abilityId: payload.abilityId })
      for (const fx of target.statusEffects) fx.onDeath?.(target, state)
      for (const mark of target.marks) mark.onCarrierDeath?.(target, mark, state)
    }
  }

  // Sky Striker kill bonus: killer gets double tailwind atkspd for 3s (killer only, not team-wide)
  if (target.state === 'dead' && source.state !== 'dead' && source.types.includes('sky_striker') && state.tailwind[source.team]) {
    const tailwindFx = source.statusEffects.find(fx => fx.id === 'sky_striker_tailwind')
    if (tailwindFx) {
      const existing = source.statusEffects.find(fx => fx.stackId === 'sky_striker_kill_boost')
      if (existing) {
        existing.durationTicks = 3 * TICK_RATE  // refresh duration
      } else {
        source.statusEffects.push({
          id: 'sky_striker_kill_boost',
          sourceUnitId: source.id,
          durationTicks: 3 * TICK_RATE,
          magnitude: tailwindFx.magnitude,
          stackId: 'sky_striker_kill_boost',
        })
        source._computedStats = null
      }
    }
  }

  // Ice Body retaliation — any attacker hitting while the shield is up gets chilled
  if (hadIceBodyShield && source.state !== 'dead' && target.state !== 'dead') {
    const chillId = `ice_body_chill_${source.id}`
    const existing = source.statusEffects.find(fx => fx.stackId === chillId)
    if (existing) {
      existing.durationTicks = Math.round(1.5 * TICK_RATE)  // refresh
    } else {
      source.statusEffects.push({
        id: 'chill',
        sourceUnitId: target.id,
        durationTicks: Math.round(1.5 * TICK_RATE),
        magnitude: 0.30,
        stackId: chillId,
      })
      source._computedStats = null
    }
  }

  // Iron Barbs retaliation — auto-attacks hitting an active Ferrothorn bounce damage back
  if (payload.abilityId === 'auto_attack' && target.state !== 'dead' && source.state !== 'dead') {
    const ironBarbs = target.statusEffects.find(fx => fx.id === 'iron_barbs')
    if (ironBarbs?.magnitude) {
      applyDamage(target, source, {
        baseAmount:        ironBarbs.magnitude,
        damageType:        'magic',
        canCrit:           false,
        abilityScalingStat: 'special',
        abilityId:         'ferrothorn_iron_barbs',
      }, state)
      // Refresh hit-flash pulse on Ferrothorn (scale bump handled in unitLayer)
      const flashIdx = target.statusEffects.findIndex(fx => fx.stackId === 'ferrothorn_hit_flash')
      if (flashIdx >= 0) {
        target.statusEffects[flashIdx].durationTicks = 10
      } else {
        target.statusEffects.push({
          id: 'ferrothorn_hit_flash',
          sourceUnitId: target.id,
          durationTicks: 10,
          stackId: 'ferrothorn_hit_flash',
        })
      }
    }

    // Rocky Helmet — auto-attacking the holder reflects 33% of the holder's total
    // Defense back at the attacker as magic damage.
    const rockyHelmet = target.statusEffects.find(fx => fx.id === 'rocky_helmet')
    if (rockyHelmet) {
      const holderDef = (target._computedStats ?? computeStats(target)).defense
      const reflect = Math.round(holderDef * (rockyHelmet.magnitude ?? 0.33))
      if (reflect > 0) {
        applyDamage(target, source, {
          baseAmount: reflect,
          damageType: 'magic',
          canCrit:    false,
          abilityId:  'rocky_helmet',
        }, state)
      }
    }
  }

  // Temporal Woods: ability damage from a temporal_woods unit debuffs the target
  if (payload.abilityId && payload.abilityId !== 'auto_attack' && target.state !== 'dead') {
    const twActive = source.statusEffects.find(fx => fx.stackId === 'temporal_woods_active')
    if (twActive?.magnitude) {
      const level = twActive.magnitude
      const DEBUFF_TICKS = 3 * TICK_RATE
      const existDebuff = target.statusEffects.find(fx => fx.stackId === 'temporal_woods_debuff')
      if (existDebuff) {
        existDebuff.durationTicks = DEBUFF_TICKS
        existDebuff.magnitude = level
      } else {
        target.statusEffects.push({ id: 'temporal_woods_debuff', sourceUnitId: source.id, durationTicks: DEBUFF_TICKS, magnitude: level, stackId: 'temporal_woods_debuff' })
        target._computedStats = null
      }
      const charmMag = level >= 6 ? 0.50 : 0.33
      const existCharm = target.statusEffects.find(fx => fx.stackId === 'tw_charm')
      if (existCharm) { existCharm.durationTicks = DEBUFF_TICKS; existCharm.magnitude = charmMag }
      else {
        target.statusEffects.push({ id: 'charm', sourceUnitId: source.id, durationTicks: DEBUFF_TICKS, magnitude: charmMag, stackId: 'tw_charm' }); target._computedStats = null
        source.traitCount.temporal_woods = (source.traitCount.temporal_woods ?? 0) + 1   // count charms applied
      }
      if (level >= 4) {
        const hbMag = level >= 6 ? 0.50 : 0.33
        const existHB = target.statusEffects.find(fx => fx.stackId === 'tw_healblock')
        if (existHB) { existHB.durationTicks = DEBUFF_TICKS; existHB.magnitude = hbMag }
        else { target.statusEffects.push({ id: 'healBlock', sourceUnitId: source.id, durationTicks: DEBUFF_TICKS, magnitude: hbMag, stackId: 'tw_healblock' }); target._computedStats = null }
      }
    }
  }

  // Mystic: ability damage from a mystic unit steals durability from the target
  // and grants it team-wide. Steal rate and caps depend on the trait threshold.
  if (payload.abilityId && payload.abilityId !== 'auto_attack' && target.state !== 'dead' && target.team !== source.team) {
    const mysticActive = source.statusEffects.find(fx => fx.stackId === 'mystic_active')
    if (mysticActive?.magnitude) {
      const level    = mysticActive.magnitude
      const stealPct = level >= 4 ? 0.05 : 0.03
      const cap      = level >= 4 ? 0.20 : 0.18

      const debuff  = target.statusEffects.find(fx => fx.stackId === 'mystic_sunder')
      const current = debuff?.magnitude ?? 0
      const stolen  = Math.min(stealPct, cap - current)
      if (stolen > 1e-9) {
        if (debuff) {
          debuff.magnitude = current + stolen
        } else {
          target.statusEffects.push({
            id: 'mystic_sunder', sourceUnitId: source.id,
            durationTicks: -1, magnitude: stolen, stackId: 'mystic_sunder',
          })
        }
        target._computedStats = null

        // Grant the stolen durability to every living ally, capped team-wide
        for (const ally of state.units.values()) {
          if (ally.team !== source.team || ally.state === 'dead' || ally.isDummy) continue
          const buff = ally.statusEffects.find(fx => fx.stackId === 'mystic_durability')
          const cur  = buff?.magnitude ?? 0
          const gain = Math.min(stolen, cap - cur)
          if (gain <= 1e-9) continue
          if (buff) {
            buff.magnitude = cur + gain
          } else {
            ally.statusEffects.push({
              id: 'mystic_durability', sourceUnitId: source.id,
              durationTicks: -1, magnitude: gain, stackId: 'mystic_durability',
            })
          }
          ally._computedStats = null
        }
      }
    }
  }

  // Temporal Woods confuse: unit with the debuff (level 6) takes 150 magic damage when it auto-attacks
  if (payload.abilityId === 'auto_attack' && source.state !== 'dead') {
    const twDebuff = source.statusEffects.find(fx => fx.stackId === 'temporal_woods_debuff')
    if ((twDebuff?.magnitude ?? 0) >= 6) {
      const r = applyDamage(source, source, { baseAmount: 150, damageType: 'magic', canCrit: false, abilityId: 'temporal_woods_confuse' }, state)
      // Credit the confuse damage to the Temporal Woods unit that applied the debuff
      // (the victim damages itself, so attribute to the debuff's caster, not the victim).
      const owner = twDebuff!.sourceUnitId ? state.units.get(twDebuff!.sourceUnitId) : undefined
      if (owner) owner.traitDmg.temporal_woods = (owner.traitDmg.temporal_woods ?? 0) + r.finalDamage
    }
  }

  // Froststone: each ability damage instance from a froststone unit adds a mark.
  // At 5 stacks, consume (bonus magic damage + animation) then immediately start a new mark.
  if (payload.abilityId && payload.abilityId !== 'auto_attack' && payload.abilityId !== 'froststone_consume'
      && source.types.includes('froststone') && target.state !== 'dead') {
    const activeFx = source.statusEffects.find(fx => fx.stackId === 'froststone_active')
    if (activeFx) {
      let currentStacks = target.statusEffects.find(fx => fx.stackId === 'froststone_mark')?.magnitude ?? 0

      if (currentStacks >= 5) {
        // Consume: clear marks and deal bonus magic damage
        const consumeBonus = activeFx.magnitude ?? 100
        const markIdx = target.statusEffects.findIndex(fx => fx.stackId === 'froststone_mark')
        if (markIdx >= 0) target.statusEffects.splice(markIdx, 1)
        applyDamage(source, target, { baseAmount: consumeBonus, damageType: 'true', canCrit: false, abilityId: 'froststone_consume', traitSource: 'froststone' }, state)
        const existAnim = target.statusEffects.find(fx => fx.stackId === 'froststone_consume_anim')
        if (existAnim) { existAnim.durationTicks = 45 }
        else { target.statusEffects.push({ id: 'froststone_consume_anim', sourceUnitId: source.id, durationTicks: 45, magnitude: 45, stackId: 'froststone_consume_anim' }) }
      } else {
        // Apply 1 mark from this spell hit (no per-mark true damage — that's autos only)
        const existMark = target.statusEffects.find(fx => fx.stackId === 'froststone_mark')
        if (existMark) {
          existMark.magnitude = currentStacks + 1
        } else {
          target.statusEffects.push({ id: 'froststone_mark', sourceUnitId: source.id, durationTicks: -1, magnitude: 1, stackId: 'froststone_mark' })
        }
      }
    }
  }

  // Bellibolt: accumulate a charge on any incoming hit
  if (target.definitionId === 'bellibolt' && target.state !== 'dead') {
    const existing = target.statusEffects.find(fx => fx.stackId === 'bellibolt_charge')
    if (existing) {
      if ((existing.magnitude ?? 0) < 10) {
        existing.magnitude = (existing.magnitude ?? 0) + 1
        target._computedStats = null
      }
    } else {
      target.statusEffects.push({
        id: 'bellibolt_charge',
        sourceUnitId: target.id,
        durationTicks: -1,
        magnitude: 1,
        stackId: 'bellibolt_charge',
      })
      target._computedStats = null
    }
  }

  return { finalDamage: hpDamage, preMitigDamage, isCrit }
}
