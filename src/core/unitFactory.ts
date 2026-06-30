import { UNIT_MAP } from '../data/units'
import { ITEM_MAP } from '../data/items'
import { DEFAULT_MOVE_SPEED } from './constants'
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

  // Apply status effect modifiers
  for (const fx of unit.statusEffects) {
    const mag = fx.magnitude ?? 0
    switch (fx.id) {
      case 'atkSpd_buff':
        attackSpeed += attackSpeed * mag  // fractional bonus
        break
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
        defense += mag
        break
      case 'spDefBuff':
        spDefense += mag
        break
      case 'atkSpd_cap':
        attackSpeed = Math.min(attackSpeed, mag)
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
        attack  -= Math.round(attack  * mag)
        special -= Math.round(special * mag)
        break
      case 'atk_reduction':
        attack = Math.max(0, attack - mag)
        break
      case 'atk_buff_pct':
        attack += Math.round(attack * mag)
        break
      case 'iron_barbs_durability':
        defense   = Math.round(defense   * (1 + mag))
        spDefense = Math.round(spDefense * (1 + mag))
        break
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
      case 'rayquaza_mega_atk':
        attack += mag
        break
      case 'rayquaza_mega_aspd':
        attackSpeed += attackSpeed * mag
        break
    }
  }

  unit._computedStats = {
    maxHp:      Math.max(1,   Math.round(maxHp)),
    attack:     Math.max(0,   Math.round(attack)),
    special:    Math.max(0,   Math.round(special)),
    defense:    Math.max(-300, Math.round(defense)),
    spDefense:  Math.max(-300, Math.round(spDefense)),
    attackSpeed: Math.max(0.1, attackSpeed),
    critChance:  Math.min(1, Math.max(0, critChance)),
    critDamage,
    range,
    moveSpeed:  Math.max(0.5, moveSpeed),
  }
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

    isDummy:  def.isDummy ?? false,

    state:    'idle',
    targetId: null,

    attackTimer:       0,
    attackWindupTimer: 0,
    isInWindup:        false,

    manaLockTimer:    0,
    abilityCastTimer: 0,

    items:  [],
    traits: [...def.traits],

    statusEffects: [],
    shields:       [],

    attackModifiers: [],
    passiveAttackHandlers: [],
    attackCount: 0,
    damageTakenThisCombat: 0,
    damageDealtThisCombat: 0,
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
