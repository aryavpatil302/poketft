import { UNIT_MAP } from '../data/units'
import { ITEM_MAP } from '../data/items'
import { DEFAULT_MOVE_SPEED, MAX_ATTACK_SPEED } from './constants'
import { traitOfEffect, asTraitOf } from './systems/traitAttribution'
import type { Unit, Team, ComputedStats, UnitBaseStats } from './types'

// ─── Star-scaling multipliers ─────────────────────────────────────────────────

const HP_SCALE  = [1, 1.8, 1.8] as const   // star 2 = star1 × 1.8, star 3 = star2 × 1.8
const ATK_SCALE = [1, 1.5, 1.5] as const

function scaleHp(base: number, tier: 1 | 2 | 3): number {
  let hp = base
  for (let s = 2; s <= tier; s++) hp = Math.round(hp * HP_SCALE[s - 1])
  return hp
}

function scaleAtk(base: number, tier: 1 | 2 | 3): number {
  let atk = base
  for (let s = 2; s <= tier; s++) atk = Math.round(atk * ATK_SCALE[s - 1])
  return atk
}

// ─── computeStats ─────────────────────────────────────────────────────────────
// Rebuilds _computedStats from base stats + equipped items + active status effects.
// Call this at the start of every tick for each living unit.

export function computeStats(unit: Unit, _traitBonuses?: Partial<UnitBaseStats>): ComputedStats {
  let attack    = unit.attack
  let special   = unit.special
  let defense   = unit.defense
  let spDefense = unit.spDefense
  let attackSpeed = unit.attackSpeed
  let critChance  = unit.critChance
  let critDamage  = unit.critDamage
  let range       = unit.range
  let maxHp       = unit.maxHp
  let moveSpeed   = unit.moveSpeed
  let omnivamp         = 0
  let healShieldPower  = 0

  // Apply item stat bonuses
  for (const itemId of unit.items) {
    const item = ITEM_MAP.get(itemId)
    if (!item) continue
    const b = item.statBonus
    if (b.attack)      attack      += b.attack
    if (b.special)     special     += b.special
    if (b.defense)     defense     += b.defense
    if (b.spDefense)   spDefense   += b.spDefense
    if (b.attackSpeed) attackSpeed += b.attackSpeed
    if (b.critChance)  critChance  += b.critChance
    if (b.critDamage)  critDamage  += b.critDamage
    if (b.hp)          maxHp       += b.hp
    // Percent / adaptive bonuses (things flat statBonus can't express)
    if (item.attackSpeedPct) attackSpeed *= (1 + item.attackSpeedPct)
    if (item.moveSpeedPct)   moveSpeed   *= (1 + item.moveSpeedPct)
    if (item.adaptiveForcePct) {
      const add = Math.round(item.adaptiveForcePct * Math.max(unit.attack, unit.special))
      if (unit.attack >= unit.special) attack += add
      else                             special += add
    }
    if (item.adaptiveForce) {
      if (unit.attack >= unit.special) attack += item.adaptiveForce
      else                             special += item.adaptiveForce
    }
  }

  // Apply trait bonuses (passed in from trait system)
  if (_traitBonuses) {
    const b = _traitBonuses
    if (b.attack)      attack      += b.attack
    if (b.special)     special     += b.special
    if (b.defense)     defense     += b.defense
    if (b.spDefense)   spDefense   += b.spDefense
    if (b.attackSpeed) attackSpeed += b.attackSpeed
    if (b.critChance)  critChance  += b.critChance
    if (b.critDamage)  critDamage  += b.critDamage
    if (b.hp)          maxHp       += b.hp
  }

  // Per-trait contribution to stats — tallied as each trait-sourced status effect is
  // applied below (see credit() calls). Turned into damage/heal/shield/mitigation
  // attribution by applyDamage/applyHeal/addShield. `as` (attack speed) drives the
  // "extra autos enabled" estimate.
  const traitStat: Record<string, { atk: number; sp: number; hsp: number; omni: number; def: number; spdef: number; as: number }> = {}
  const bump = (t: string | undefined, k: 'atk' | 'sp' | 'hsp' | 'omni' | 'def' | 'spdef' | 'as', d: number): void => {
    if (!t || !d) return
    const e = traitStat[t] ?? (traitStat[t] = { atk: 0, sp: 0, hsp: 0, omni: 0, def: 0, spdef: 0, as: 0 })
    e[k] += d
  }
  const credit = (fx: { id: string; stackId?: string }, k: 'atk' | 'sp' | 'hsp' | 'omni' | 'def' | 'spdef', d: number): void =>
    bump(traitOfEffect(fx.id, fx.stackId), k, d)

  // Apply status effect modifiers
  // Salamence Outrage: while Enraged, effects that lower attack are ignored
  const atkReductionImmune = unit.statusEffects.some(fx => fx.id === 'salamence_enraged')
  for (const fx of unit.statusEffects) {
    const mag = fx.magnitude ?? 0
    switch (fx.id) {
      case 'atkSpd_buff': {
        const d = attackSpeed * mag; attackSpeed += d  // fractional bonus
        bump(asTraitOf(fx.id, fx.stackId), 'as', d)
        break
      }
      case 'dmg_buff':
        attack += mag  // flat bonus
        break
      case 'chill':
        attackSpeed -= attackSpeed * mag
        break
      case 'slow':
        moveSpeed -= moveSpeed * mag
        break
      case 'armorShred':
        defense -= mag
        break
      case 'spDefShred':
        spDefense -= mag
        break
      case 'armorBuff':
        defense += mag; credit(fx, 'def', mag)      // trait-tagged (e.g. Ascender aura) → damage reduced
        break
      case 'spDefBuff':
        spDefense += mag; credit(fx, 'spdef', mag)
        break
      case 'atkSpd_cap':
        attackSpeed = Math.min(attackSpeed, mag)
        break
      case 'atkSpd_set':
        attackSpeed = mag
        break
      case 'sunder':
        defense = Math.max(0, defense - mag)
        break
      case 'shred':
        spDefense = Math.max(0, spDefense - mag)
        break
      case 'sunder_pct':
        defense = Math.max(0, defense * (1 - mag))
        break
      case 'shred_pct':
        spDefense = Math.max(0, spDefense * (1 - mag))
        break
      case 'charm':
        if (!atkReductionImmune) attack -= Math.round(attack * mag)
        special -= Math.round(special * mag)
        break
      case 'atk_reduction':
        if (!atkReductionImmune) attack = Math.max(0, attack - mag)
        break
      case 'atk_buff_pct': {
        const d = Math.round(attack * mag); attack += d; credit(fx, 'atk', d)
        break
      }
      case 'crit_chance_buff':
        critChance += mag
        break
      case 'iron_barbs_durability':
        defense   = Math.round(defense   * (1 + mag))
        spDefense = Math.round(spDefense * (1 + mag))
        break
      case 'assault_vest_buff':
        // Assault Vest: +30% Def & Sp.Def for 4s after casting
        defense   = Math.round(defense   * (1 + mag))
        spDefense = Math.round(spDefense * (1 + mag))
        break
      case 'aqua_ring_durability': {
        const dd = Math.round(defense   * (1 + mag)) - defense
        const ds = Math.round(spDefense * (1 + mag)) - spDefense
        defense += dd; spDefense += ds
        credit(fx, 'def', dd); credit(fx, 'spdef', ds)
        break
      }
      case 'bellibolt_charge':
        defense   += mag * 5
        spDefense += mag * 5
        break
      case 'oranguru_sp_buff':
        special += mag
        break
      case 'fez_durability':
        defense   = Math.round(defense   * (1 + mag))
        spDefense = Math.round(spDefense * (1 + mag))
        break
      case 'zen_form':
        // Darmanitan Zen: +10% durability while meditating
        defense   = Math.round(defense   * (1 + mag))
        spDefense = Math.round(spDefense * (1 + mag))
        break
      case 'mystic_sunder':
        // Mystic trait: durability stolen from this unit
        defense   = Math.max(0, Math.round(defense   * (1 - mag)))
        spDefense = Math.max(0, Math.round(spDefense * (1 - mag)))
        break
      case 'roughneck_atk':
        attack += mag; bump('roughneck', 'atk', mag)   // Roughneck flat +Attack (routed to a status)
        break
      case 'stalwart_def':
        defense += mag; spDefense += mag                // Stalwart HP-breakpoint +Def/SpDef
        bump('stalwart', 'def', mag); bump('stalwart', 'spdef', mag)
        break
      case 'mystic_durability': {
        // Mystic trait: durability stolen from enemies, granted team-wide
        const dd = Math.round(defense   * (1 + mag)) - defense
        const ds = Math.round(spDefense * (1 + mag)) - spDefense
        defense += dd; spDefense += ds
        credit(fx, 'def', dd); credit(fx, 'spdef', ds)
        break
      }
      case 'rayquaza_mega_atk':
        attack += mag
        break
      case 'ancient_power_stats':
        attack      = Math.round(attack      * (1 + mag))
        special     = Math.round(special     * (1 + mag))
        defense     = Math.round(defense     * (1 + mag))
        spDefense   = Math.round(spDefense   * (1 + mag))
        attackSpeed = attackSpeed * (1 + mag)
        moveSpeed   = moveSpeed   * (1 + mag)
        break
      case 'thick_fat':
        defense   += mag
        spDefense += mag
        break
      case 'salamence_enraged':
        moveSpeed *= 2.5  // Outrage: +50% move speed while Enraged
        break
      case 'sp_buff_pct': {
        const d = Math.round(special * mag); special += d; credit(fx, 'sp', d)
        break
      }
      case 'sp_reduction_pct':
        special = Math.max(0, Math.round(special * (1 - mag)))
        break
      case 'soul_bonded_apex': {
        // Latios + Latias both fielded: 1.5× special and sp. defense
        const d = Math.round(special * (1 + mag)) - special
        special   += d; credit(fx, 'sp', d)
        spDefense = Math.round(spDefense * (1 + mag))
        break
      }
      case 'omnivamp_buff':
        omnivamp += mag; credit(fx, 'omni', mag)
        break
      case 'jungle_healshield_bonus':
        healShieldPower += mag; credit(fx, 'hsp', mag)
        break
      case 'volcano_adaptive':
      case 'volcano_adaptive_sun':
      case 'sky_striker_adaptive':
        // Adaptive force: adds to whichever of attack/special is higher at base
        if (unit.attack >= unit.special) { attack += mag; credit(fx, 'atk', mag) }
        else { special += mag; credit(fx, 'sp', mag) }
        break
      case 'spellweaver_adaptive':
        // Spellweaver adaptive: follows the ability's scaling stat (derived from role)
        if (unit.role === 'attack caster' || unit.role === 'attack marksman' || unit.role === 'attack fighter') { attack += mag; credit(fx, 'atk', mag) }
        else if (unit.role === 'special caster' || unit.role === 'special marksman') { special += mag; credit(fx, 'sp', mag) }
        else if (unit.attack >= unit.special) { attack += mag; credit(fx, 'atk', mag) }
        else { special += mag; credit(fx, 'sp', mag) }
        break
      case 'sky_striker_tailwind':
      case 'sky_striker_kill_boost':
        // Additive attack speed bonus
        attackSpeed += mag
        break
    }
  }

  unit._computedStats = {
    maxHp:      Math.max(1,   Math.round(maxHp)),
    attack:     Math.max(0,   Math.round(attack)),
    special:    Math.max(0,   Math.round(special)),
    defense:    Math.max(-300, Math.round(defense)),
    spDefense:  Math.max(-300, Math.round(spDefense)),
    attackSpeed: Math.min(MAX_ATTACK_SPEED, Math.max(0.1, attackSpeed)),
    critChance:  Math.min(1, Math.max(0, critChance)),
    critDamage,
    range,
    moveSpeed:  Math.max(0.5, moveSpeed),
    omnivamp:        Math.max(0, omnivamp),
    healShieldPower: Math.max(0, healShieldPower),
  }
  unit._traitStat = traitStat
  return unit._computedStats
}

// ─── makeUnit ─────────────────────────────────────────────────────────────────
// Primary factory: instantiate a Unit from a definition ID + tier + team.

export function makeUnit(
  definitionId: string,
  team: Team,
  tier: 1 | 2 | 3 = 1,
): Unit {
  const def = UNIT_MAP.get(definitionId)
  if (!def) throw new Error(`Unknown unit definition: "${definitionId}"`)

  const b = def.baseStats
  const scaledHp  = scaleHp(b.hp, tier)
  const scaledAtk = scaleAtk(b.attack, tier)
  const scaledStartMana = Math.min(b.startMana, b.maxMana)

  const unit: Unit = {
    id: `${definitionId}_${team}_${Math.random().toString(36).slice(2, 7)}`,
    definitionId,
    name: def.name,
    team,
    tier,

    hexPos:       { col: 0, row: 0 },
    visualPos:    { x: 0, y: 0 },
    moveProgress: 0,
    path:         [],

    maxHp:        scaledHp,
    currentHp:    scaledHp,
    maxMana:      b.maxMana,
    currentMana:  scaledStartMana,

    attack:     scaledAtk,
    special:    b.special,
    defense:    b.defense,
    spDefense:  b.spDefense,
    attackSpeed: b.attackSpeed,
    critChance:  b.critChance,
    critDamage:  b.critDamage,
    range:       b.range,
    moveSpeed:   DEFAULT_MOVE_SPEED,

    role:     def.role,
    isDummy:  def.isDummy ?? false,

    state:    'idle',
    targetId: null,

    attackTimer:       0,
    attackWindupTimer: 0,
    isInWindup:        false,
    pendingCrit:       false,

    manaLockTimer:    0,
    abilityCastTimer: 0,

    items:  [],
    types: [...def.types],

    statusEffects: [],
    shields:       [],

    attackModifiers: [],
    passiveAttackHandlers: [],
    passiveCastHandlers: [],
    placedAt: 0,
    attackCount: 0,
    damageTakenThisCombat: 0,
    damageDealtThisCombat: 0,
    traitDmg: {},
    traitHeal: {},
    traitShield: {},
    traitMitigated: {},
    traitCount: {},
    silenced: false,
    whirlpooled: false,
    marks: [],
    incomingDamageMult: 1.0,

    _computedStats: null,
  }

  // Compute initial stats
  computeStats(unit)

  return unit
}
