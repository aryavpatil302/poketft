import type { CombatState, Unit, Shield } from '../types'
import { addStatusEffect, removeStatusEffectByStack } from './statusEffect'
import { setTerrain, initTerrainFromTapus } from './terrain'
import { hexId, hexesInRange, hexToPixel } from '../hexGrid'
import { findNearestOpenHex, claimHex, releaseHexes, cancelInFlightMovement } from './movement'
import { TICK_RATE, HEX_SIZE } from '../constants'
import { applyHeal } from './heal'
import { addShield } from './shield'
import { computeStats, makeUnit } from '../unitFactory'
import { applyDamage } from './damage'
import { gainManaOnHit, gainManaOnDamageTaken } from './mana'
import { UNIT_MAP } from '../../data/units'

// Thresholds for jungle trait: [count, teamBonus, jungleBonus]
const JUNGLE_THRESHOLDS: Array<[number, number, number]> = [
  [3, 0.05, 0.10],
  [5, 0.08, 0.15],
  [7, 0.10, 0.25],
]

function getJungleThreshold(count: number): [number, number] | null {
  let best: [number, number] | null = null
  for (const [req, teamBonus, jungleBonus] of JUNGLE_THRESHOLDS) {
    if (count >= req) best = [teamBonus, jungleBonus]
  }
  return best
}

export function initTraitEffects(state: CombatState): void {
  applyRogue(state)
  applySoulBonded(state)
  applyJungle(state)
  applyBruiser(state)
  applyBeachy(state)
  applyVolcano(state)
  applySkyStriker(state)
  applyCaveCrawler(state)
  applyRiver(state)
  applyTemporalWoods(state)
  applyRuiner(state)
  applyAscender(state)
  applyCorkscrew(state)
  applyRoughneck(state)
  applyFroststone(state)
  applyQuickclaw(state)
  applyStalwart(state)
  applyPromoter(state)
  applySubstitutor(state)
  applyKeenEye(state)
  applySpellweaver(state)
  applyMystic(state)
  applyCrashout(state)
  applyZen(state)
  initTerrainFromTapus(state)
  applyTerrainEffects(state)
}

// Soul Bonded: Latios fielded → team +10% attack & special. Latias fielded →
// team +10 defense & sp. defense. Both → both buffs, and Latios & Latias each
// gain 1.5× special and sp. defense ('soul_bonded_apex' in computeStats).
function applySoulBonded(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const latios = teamUnits.find(u => u.definitionId === 'latios')
    const latias = teamUnits.find(u => u.definitionId === 'latias')
    if (!latios && !latias) continue

    for (const unit of teamUnits) {
      if (latios) {
        addStatusEffect(unit, {
          id: 'atk_buff_pct', sourceUnitId: 'trait',
          durationTicks: -1, magnitude: 0.10, stackId: 'soul_bonded_atk',
        })
        addStatusEffect(unit, {
          id: 'sp_buff_pct', sourceUnitId: 'trait',
          durationTicks: -1, magnitude: 0.10, stackId: 'soul_bonded_sp',
        })
      }
      if (latias) {
        addStatusEffect(unit, {
          id: 'armorBuff', sourceUnitId: 'trait',
          durationTicks: -1, magnitude: 10, stackId: 'soul_bonded_def',
        })
        addStatusEffect(unit, {
          id: 'spDefBuff', sourceUnitId: 'trait',
          durationTicks: -1, magnitude: 10, stackId: 'soul_bonded_spdef',
        })
      }
    }

    if (latios && latias) {
      for (const bonded of [latios, latias]) {
        addStatusEffect(bonded, {
          id: 'soul_bonded_apex', sourceUnitId: 'trait',
          durationTicks: -1, magnitude: 0.5, stackId: 'soul_bonded_apex',
        })
      }
    }
  }
}

// Rogue: units that start combat without any adjacent allies gain a 500 HP shield
function applyRogue(state: CombatState): void {
  const ROGUE_SHIELD = 500

  for (const unit of state.units.values()) {
    if (unit.isDummy || !unit.types.includes('rogue')) continue

    const hasAdjacentAlly = hexesInRange(unit.hexPos, 1).some(h => {
      const occupantId = state.hexOccupancy.get(hexId(h))
      if (!occupantId || occupantId === unit.id) return false
      const occupant = state.units.get(occupantId)
      return occupant !== undefined && occupant.team === unit.team && occupant.state !== 'dead'
    })
    if (hasAdjacentAlly) continue

    const shield: Shield = {
      id: crypto.randomUUID(),
      sourceAbility: 'rogue_trait',
      value: ROGUE_SHIELD,
      maxValue: ROGUE_SHIELD,
      durationTicks: -1,
      effectiveMaxHp: unit.currentHp + ROGUE_SHIELD,
      traitSource: 'rogue',   // damage this shield absorbs → attributed to Rogue
    }
    unit.shields.push(shield)
    state.events.push({ type: 'shield', unitId: unit.id, amount: ROGUE_SHIELD, sourceId: unit.id })
  }
}

function applyTerrainEffects(state: CombatState): void {
  const DURATION_10S = 10 * TICK_RATE

  if (state.terrain.grassy) {
    // Heal each player unit 10% of their own HP every 2 seconds for 10 seconds
    for (const unit of state.units.values()) {
      if (unit.team !== 'player' || unit.isDummy) continue
      addStatusEffect(unit, {
        id: 'grassy_terrain_heal',
        sourceUnitId: unit.id,
        durationTicks: DURATION_10S,
        tickInterval: 2 * TICK_RATE,
        stackId: 'grassy_terrain_heal',
        tickEffect: (u, st) => {
          if (u.state === 'dead') return
          applyHeal(u, Math.round(u.maxHp * 0.10), u.id, st, 'earth_spirit')
        },
      })
    }
  }

  if (state.terrain.misty) {
    // CC immunity for all player units for 10 seconds
    for (const unit of state.units.values()) {
      if (unit.team !== 'player' || unit.isDummy) continue
      addStatusEffect(unit, {
        id: 'cc_immune',
        sourceUnitId: unit.id,
        durationTicks: DURATION_10S,
        stackId: 'cc_immune',
      })
    }
  }

  if (state.terrain.electric) {
    // +15% attack speed and 15% tenacity for all player units for 10 seconds
    for (const unit of state.units.values()) {
      if (unit.team !== 'player' || unit.isDummy) continue
      addStatusEffect(unit, {
        id: 'atkSpd_buff',
        sourceUnitId: unit.id,
        durationTicks: DURATION_10S,
        magnitude: 0.15,
        stackId: 'electric_terrain_as',
      })
      addStatusEffect(unit, {
        id: 'tenacity',
        sourceUnitId: unit.id,
        durationTicks: DURATION_10S,
        magnitude: 0.15,
        stackId: 'electric_terrain_tenacity',
      })
    }
  }

  if (state.terrain.psychic) {
    // Chill all enemies (25% attack speed reduction) for 10 seconds
    for (const unit of state.units.values()) {
      if (unit.team === 'player' || unit.isDummy) continue
      addStatusEffect(unit, {
        id: 'chill',
        sourceUnitId: unit.id,
        durationTicks: DURATION_10S,
        magnitude: 0.25,
        stackId: 'psychic_terrain_chill',
      })
    }
  }
}

function applyJungle(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const jungleSpecies = new Set(
      teamUnits.filter(u => u.types.includes('jungle')).map(u => u.definitionId)
    )
    const threshold = getJungleThreshold(jungleSpecies.size)
    if (!threshold) continue

    const [teamBonus, jungleBonus] = threshold

    for (const unit of teamUnits) {
      const isJungle = unit.types.includes('jungle')
      const magnitude = isJungle ? teamBonus + jungleBonus : teamBonus
      addStatusEffect(unit, {
        id: 'jungle_healshield_bonus',
        sourceUnitId: unit.id,
        durationTicks: -1,
        magnitude,
        stackId: 'jungle_healshield',
      })
    }
  }
}

function applyVolcano(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const volcanoUnits = teamUnits.filter(u => u.types.includes('volcanic'))
    const volcanoSpecies = new Set(volcanoUnits.map(u => u.definitionId))
    const n = volcanoSpecies.size

    let hpBonus = 0
    let adaptiveForce = 0
    let sunDelaySecs = Infinity

    if (n >= 7)      { hpBonus = 800; adaptiveForce = 75;  sunDelaySecs = 0  }
    else if (n >= 5) { hpBonus = 500; adaptiveForce = 45;  sunDelaySecs = 5  }
    else if (n >= 3) { hpBonus = 350; adaptiveForce = 30;  sunDelaySecs = 10 }

    if (n < 3) continue

    for (const unit of volcanoUnits) {
      unit.maxHp    += hpBonus
      unit.currentHp += hpBonus
      ;(unit._traitHp ??= {}).volcanic = (unit._traitHp.volcanic ?? 0) + hpBonus
      addStatusEffect(unit, {
        id: 'volcano_adaptive',
        sourceUnitId: unit.id,
        durationTicks: -1,
        magnitude: adaptiveForce,
        stackId: 'volcano_adaptive',
      })
    }

    // Sun activation callback — guarded so only the first expiry fires
    const activateSun = (u: Unit, s: CombatState) => {
      if (s.terrain.sunny) return
      setTerrain(s, 'sunny', true)

      // 50% extra HP and adaptive force under the sun
      const extraHp       = Math.round(hpBonus * 0.5)
      const extraAdaptive = Math.round(adaptiveForce * 0.5)
      for (const vu of s.units.values()) {
        if (vu.state === 'dead' || vu.team !== team || !vu.types.includes('volcanic')) continue
        vu.maxHp    += extraHp
        vu.currentHp = Math.min(vu.currentHp + extraHp, vu.maxHp)
        s.events.push({ type: 'heal', targetId: vu.id, amount: extraHp, sourceId: vu.id })
        if (extraAdaptive > 0) {
          addStatusEffect(vu, {
            id: 'volcano_adaptive_sun',
            sourceUnitId: vu.id,
            durationTicks: -1,
            magnitude: extraAdaptive,
            stackId: 'volcano_adaptive_sun',
          })
        }
      }

      // Burn all enemies for 3 seconds
      const BURN_TICKS = 3 * TICK_RATE
      for (const enemy of s.units.values()) {
        if (enemy.state === 'dead' || enemy.team === team) continue
        const burnPerSec = Math.max(1, Math.round(enemy.maxHp * 0.02))
        addStatusEffect(enemy, {
          id: 'volcano_sun_burn',
          sourceUnitId: u.id,
          durationTicks: BURN_TICKS,
          magnitude: burnPerSec,
          tickInterval: TICK_RATE,
          stackId: 'volcano_sun_burn',
          tickEffect: (target, st) => {
            const dealt = Math.min(target.currentHp, burnPerSec)
            target.currentHp = Math.max(0, target.currentHp - burnPerSec)
            st.events.push({ type: 'damage', targetId: target.id, amount: burnPerSec, damageType: 'true', isCrit: false, sourceId: u.id })
            u.traitDmg.volcanic = (u.traitDmg.volcanic ?? 0) + dealt   // attribute sun-burn to Volcano
            if (target.currentHp <= 0) {
              target.currentHp = 0; target.state = 'dead'
              releaseHexes(target, st)
              st.events.push({ type: 'death', unitId: target.id, sourceId: u.id })
            }
          },
        })
      }
    }

    const delayTicks = sunDelaySecs === 0 ? 1 : Math.round(sunDelaySecs * TICK_RATE)
    for (const unit of volcanoUnits) {
      addStatusEffect(unit, {
        id: 'volcano_sun_timer',
        sourceUnitId: unit.id,
        durationTicks: delayTicks,
        stackId: 'volcano_sun_timer',
        onExpire: activateSun,
      })
    }
  }
}

// Sky Striker trait: register execute marker + tailwind passiveCastHandler on first cast.
function applySkyStriker(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const skyUnits  = teamUnits.filter(u => u.types.includes('sky_striker'))
    const skySpecies = new Set(skyUnits.map(u => u.definitionId))
    const n = skySpecies.size

    let tailwindBonus = 0
    let executeThreshold = 0

    if (n >= 4)      { tailwindBonus = 0.60; executeThreshold = 0.15 }
    else if (n >= 2) { tailwindBonus = 0.30; executeThreshold = 0.10 }

    if (n < 2) continue

    // Mark every sky striker with execute threshold (checked in applyDamage)
    for (const unit of skyUnits) {
      addStatusEffect(unit, {
        id: 'sky_striker_execute',
        sourceUnitId: unit.id,
        durationTicks: -1,
        magnitude: executeThreshold,
        stackId: 'sky_striker_execute',
      })
    }

    // Register a passiveCastHandler on each sky striker:
    //  • First cast → summon tailwind (permanent atkspd buff to all sky strikers)
    //  • Every subsequent cast while in tailwind → temporarily boost adaptive force
    //    for the duration of that cast only (computed from current post-tailwind atkspd)
    const handler = {
      id: 'sky_striker_tailwind',
      onCast: (caster: Unit, s: CombatState) => {
        // Summon tailwind on this team's first cast (per-team: the other team
        // summons its own independently — one team's tailwind never touches the other).
        if (!s.tailwind[team]) {
          s.tailwind[team] = true
          for (const u of s.units.values()) {
            if (u.team !== team || !u.types.includes('sky_striker') || u.state === 'dead') continue
            addStatusEffect(u, {
              id: 'sky_striker_tailwind',
              sourceUnitId: caster.id,
              durationTicks: -1,
              magnitude: tailwindBonus,
              stackId: 'sky_striker_tailwind',
            })
            u._computedStats = null
          }
        }

        // Per-cast adaptive boost: 20% of current (post-tailwind) atkspd → adaptive force.
        // Applied just before the ability fires; afterCast removes it immediately after.
        if (s.tailwind[team] && caster.state !== 'dead') {
          const currentStats = caster._computedStats ?? computeStats(caster)
          const adaptiveGain = Math.floor(currentStats.attackSpeed * 100 * 0.20)
          if (adaptiveGain > 0) {
            const existing = caster.statusEffects.find(fx => fx.stackId === 'sky_striker_cast_adaptive')
            if (existing) {
              existing.magnitude = adaptiveGain
            } else {
              caster.statusEffects.push({
                id: 'sky_striker_adaptive',
                sourceUnitId: caster.id,
                durationTicks: -1,
                magnitude: adaptiveGain,
                stackId: 'sky_striker_cast_adaptive',
              })
            }
            caster._computedStats = null  // force recompute so ability damage sees the boost
          }
        }
      },
      afterCast: (caster: Unit, _s: CombatState) => {
        // Remove the temporary adaptive immediately after the ability fires
        const idx = caster.statusEffects.findIndex(fx => fx.stackId === 'sky_striker_cast_adaptive')
        if (idx >= 0) {
          caster.statusEffects.splice(idx, 1)
          caster._computedStats = null
        }
      },
    }

    for (const unit of skyUnits) {
      if (!unit.passiveCastHandlers.some(h => h.id === 'sky_striker_tailwind')) {
        unit.passiveCastHandlers.push(handler)
      }
    }
  }
}

// Cave Crawler trait: earthquake every 5s dealing true damage to all enemies. Damage = 300 ×
// (1 + 0.10 × total star points), where each cave crawler contributes 3^(tier-1) star points
// (1-star=1, 2-star=3, 3-star=9). The old (5) "+30 enemy mana cost" effect was reworked into an
// econ-layer reroll: earthquakes reward the crawler's owner with bench units / gold — that lives
// entirely in the econ layer (see rollCrawlerEarthquakeRewards), keyed off earthquakeCounts, since
// core is econ-agnostic and knows nothing about benches or gold.
//
// Each cave crawler gets a permanent tickEffect (fires every 5 * TICK_RATE ticks). A per-team guard
// key in earthquakeCounts ensures only one fires per interval even though all crawlers tick together.
function applyCaveCrawler(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits    = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const crawlerUnits = teamUnits.filter(u => u.types.includes('cave_crawler'))
    const crawlerSpecies = new Set(crawlerUnits.map(u => u.definitionId))
    const n = crawlerSpecies.size
    if (n < 3) continue

    const totalStarPoints = crawlerUnits.reduce((sum, u) => sum + Math.pow(3, u.tier - 1), 0)
    const earthquakeDamage = Math.round(150 * (1 + 0.02 * totalStarPoints))

    // Key used to dedup: if two crawlers both tick on the same tick, only the first fires.
    const guardKey = `${team}_lastTick`

    const fireEarthquake = (u: Unit, s: CombatState) => {
      const count = (s.earthquakeCounts.get(team) ?? 0) + 1
      s.earthquakeCounts.set(team, count)

      // Board flash + unit rumble VFX
      s.events.push({ type: 'vfx', effectId: 'earthquake', team })

      // Rumble all alive cave crawlers for ~0.4s (25 ticks)
      for (const cu of s.units.values()) {
        if (cu.team !== team || !cu.types.includes('cave_crawler') || cu.state === 'dead') continue
        addStatusEffect(cu, {
          id: 'cave_crawler_earthquake_rumble',
          sourceUnitId: cu.id,
          durationTicks: 25,
          magnitude: 25,   // original duration — used by renderer for decay calc
          stackId: 'cave_crawler_earthquake_rumble',
        })
      }

      // Physical damage to all enemies — goes through applyDamage so defense mitigates it
      for (const enemy of s.units.values()) {
        if (enemy.team === team || enemy.state === 'dead') continue
        applyDamage(u, enemy, { baseAmount: earthquakeDamage, damageType: 'physical', canCrit: false, traitSource: 'cave_crawler' }, s)
      }
      u.traitCount.cave_crawler = (u.traitCount.cave_crawler ?? 0) + 1   // count earthquakes
    }

    // Each cave crawler gets a permanent tickEffect that fires every 5 * TICK_RATE ticks.
    // The guard key ensures exactly one earthquake per interval even if multiple crawlers tick together.
    for (const unit of crawlerUnits) {
      addStatusEffect(unit, {
        id: 'cave_crawler_earthquake_timer',
        sourceUnitId: unit.id,
        durationTicks: -1,
        stackId: 'cave_crawler_earthquake_timer',
        tickInterval: 5 * TICK_RATE,
        tickEffect: (u, s) => {
          if ((s.earthquakeCounts.get(guardKey) ?? -1) === s.tick) return
          s.earthquakeCounts.set(guardKey, s.tick)
          fireEarthquake(u, s)
        },
      })
    }
  }
}

// River trait: the strongest river Pokémon carries Aqua Ring — durability + omnivamp + death explosion.
// Ring passes to the next strongest alive river unit on death.
// (2) 10% durability, 15% omnivamp, 10% maxHp explosion in 1-hex radius
// (3) 15% durability, 25% omnivamp, 15% maxHp explosion in 1-hex radius
// (4) ring holder gains 10% HP and 10% size at ring grant
function applyRiver(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits   = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const riverUnits  = teamUnits.filter(u => u.types.includes('river'))
    const riverSpecies = new Set(riverUnits.map(u => u.definitionId))
    const n = riverSpecies.size
    if (n < 2) continue

    const omnivamp      = n >= 3 ? 0.25 : 0.15
    const durability    = n >= 3 ? 0.15 : 0.10
    const explosionPct  = n >= 3 ? 0.15 : 0.10
    const hasSizeBoost  = n >= 4

    // Strength order: most items first, then highest tier, then highest cost when
    // tier and cost are tied, most recently placed (highest placedAt) wins the tiebreak.
    const allRiverOrdered = [...state.units.values()]
      .filter(u => u.team === team && !u.isDummy && u.types.includes('river'))
    const costOf = (u: Unit) => UNIT_MAP.get(u.definitionId)?.cost ?? 0
    const byStrength = [...allRiverOrdered].sort((a, b) =>
      b.items.length - a.items.length ||
      b.tier - a.tier ||
      costOf(b) - costOf(a) ||
      b.placedAt - a.placedAt,
    )

    const FLIGHT_TICKS = 26  // 125ms pulse + 300ms fly = 425ms ≈ 26 ticks at 60 ticks/s

    const grantRing = (holder: Unit) => {
      addStatusEffect(holder, {
        id: 'aqua_ring_durability', sourceUnitId: holder.id,
        durationTicks: -1, magnitude: durability,
        stackId: 'aqua_ring_durability',
      })
      addStatusEffect(holder, {
        id: 'omnivamp_buff', sourceUnitId: holder.id,
        durationTicks: -1, magnitude: omnivamp,
        stackId: 'aqua_ring_omnivamp',
      })
      if (hasSizeBoost) {
        const hpBoost = Math.round(holder.maxHp * 0.10)
        holder.maxHp     += hpBoost
        holder.currentHp += hpBoost
        ;(holder._traitHp ??= {}).river = (holder._traitHp.river ?? 0) + hpBoost
        addStatusEffect(holder, {
          id: 'aqua_ring_size', sourceUnitId: holder.id,
          durationTicks: -1, magnitude: 1.10,
          stackId: 'aqua_ring_size',
        })
      }
      // Main marker — carries the onDeath explosion + pass logic.
      // magnitude encodes the threshold level (2/3/4) so the renderer can tint by depth.
      const ringLevel = hasSizeBoost ? 4 : n >= 3 ? 3 : 2
      addStatusEffect(holder, {
        id: 'aqua_ring', sourceUnitId: holder.id,
        durationTicks: -1, magnitude: ringLevel, stackId: 'aqua_ring',
        onDeath: (dead, s2) => {
          // Explosion: magic damage = explosionPct × dead unit's max HP, within 1 hex
          const dmg = Math.round(dead.maxHp * explosionPct)
          for (const hex of hexesInRange(dead.hexPos, 1)) {
            const tid = s2.hexOccupancy.get(hexId(hex))
            if (!tid) continue
            const target = s2.units.get(tid)
            if (!target || target.team === team || target.state === 'dead') continue
            applyDamage(dead, target, { baseAmount: dmg, damageType: 'magic', canCrit: false, traitSource: 'river' }, s2)
          }
          // Find next strongest alive river Pokémon (river-type only, never non-river units)
          const next = [...s2.units.values()]
            .filter(u =>
              u.team === team &&
              u.types.includes('river') &&
              u.state !== 'dead' &&
              u.id !== dead.id &&
              !u.statusEffects.some(fx => fx.stackId === 'aqua_ring') &&
              !u.statusEffects.some(fx => fx.stackId === 'aqua_ring_incoming'),
            )
            .sort((a, b) =>
              b.items.length - a.items.length ||
              b.tier - a.tier ||
              costOf(b) - costOf(a) ||
              b.placedAt - a.placedAt,
            )[0]
          if (!next) return
          // Emit VFX so the renderer can animate the ring flying across the board
          s2.events.push({
            type: 'vfx', effectId: 'aqua_ring_pass',
            fromX: dead.visualPos.x, fromY: dead.visualPos.y,
            toX: next.visualPos.x, toY: next.visualPos.y,
            toUnitId: next.id, level: ringLevel,
          })
          // Delay actual ring grant until the animation lands (FLIGHT_TICKS ticks later)
          addStatusEffect(next, {
            id: 'aqua_ring_incoming', sourceUnitId: dead.id,
            durationTicks: FLIGHT_TICKS, stackId: 'aqua_ring_incoming',
            onExpire: (u) => grantRing(u),
          })
        },
      })
      holder._computedStats = null
    }

    if (byStrength.length > 0) grantRing(byStrength[0])
  }
}

// Bruiser trait: all allies gain 150 max HP. Bruisers also gain a percentage of their max HP.
// (2) +25%  (4) +40%  (6) +60%
function applyBruiser(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const bruiserSpecies = new Set(
      teamUnits.filter(u => u.types.includes('bruiser')).map(u => u.definitionId)
    )
    const n = bruiserSpecies.size
    if (n < 2) continue
    const pct = n >= 6 ? 0.60 : n >= 4 ? 0.40 : 0.25

    for (const unit of teamUnits) {
      const bruiserBonus = unit.types.includes('bruiser') ? Math.round(unit.maxHp * pct) : 0
      const bonus = 150 + bruiserBonus
      unit.maxHp     += bonus
      unit.currentHp += bonus
      ;(unit._traitHp ??= {}).bruiser = (unit._traitHp.bruiser ?? 0) + bonus
    }
  }
}

// Beachy trait: grant bonus HP at combat start. 2/4/6 unique species → +150/+300/+450 HP to beachy units.
function applyBeachy(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const beachySpecies = new Set(
      teamUnits.filter(u => u.types.includes('beachy')).map(u => u.definitionId)
    )
    const n = beachySpecies.size
    const hpBonus = n >= 6 ? 450 : n >= 4 ? 300 : n >= 2 ? 150 : 0
    if (hpBonus === 0) continue

    for (const unit of teamUnits) {
      if (!unit.types.includes('beachy')) continue
      unit.maxHp += hpBonus
      unit.currentHp += hpBonus
      ;(unit._traitHp ??= {}).beachy = (unit._traitHp.beachy ?? 0) + hpBonus
    }
  }
}

function applyTemporalWoods(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const twSpecies = new Set(
      teamUnits.filter(u => u.types.includes('temporal_woods')).map(u => u.definitionId)
    )
    const n = twSpecies.size
    const level = n >= 6 ? 6 : n >= 4 ? 4 : n >= 2 ? 2 : 0
    if (level === 0) continue

    for (const unit of teamUnits.filter(u => u.types.includes('temporal_woods'))) {
      addStatusEffect(unit, {
        id: 'temporal_woods_active',
        sourceUnitId: 'trait',
        durationTicks: -1,
        magnitude: level,
        stackId: 'temporal_woods_active',
      })
    }
  }
}

// ─── Ruiner ───────────────────────────────────────────────────────────────────

function starContribution(tier: number): number {
  return tier === 3 ? 9 : tier === 2 ? 3 : 1
}

function applyRuiner(state: CombatState): void {
  const ARISE_TICKS = 30  // 0.5 seconds at TICK_RATE=60 — spawn pulse + invulnerability window
  const GOLEM_IDS = { 3: 'golett', 5: 'golurk', 7: 'mega_golurk' } as const

  for (const team of ['player', 'enemy'] as const) {
    const teamUnits = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const ruinerUnits = teamUnits.filter(u => u.types.includes('ruiner'))
    const ruinerSpecies = new Set(ruinerUnits.map(u => u.definitionId))
    const n = ruinerSpecies.size
    const threshold = n >= 7 ? 7 : n >= 5 ? 5 : n >= 3 ? 3 : 0
    if (threshold === 0) continue

    const totalLevels = ruinerUnits.reduce((sum, u) => sum + starContribution(u.tier), 0)
    const golemTier: 1 | 2 | 3 = totalLevels >= 21 ? 3 : totalLevels >= 11 ? 2 : 1
    const golemId = GOLEM_IDS[threshold as 3 | 5 | 7]

    // Stone hex: middle of the team's half
    const playerHalf = team === 'player'
    const rowStart   = playerHalf ? 4 : 0
    const rowEnd     = playerHalf ? 8 : 4
    const stoneHex   = { col: 3, row: playerHalf ? 4 : 3 }
    const stoneHexId = hexId(stoneHex)

    // Push any occupant of the stone hex to the nearest free hex in their half.
    // The stone is the one thing that DOES evict — it spawns at a fixed hex.
    // rowRange keeps the displaced unit on its own side; the occupant still
    // holds stoneHex here, so the search skips it without needing an exclusion.
    const occupantId = state.hexOccupancy.get(stoneHexId)
    if (occupantId) {
      const occupant = state.units.get(occupantId)
      if (occupant) {
        const dest = findNearestOpenHex(stoneHex, state, { rowRange: [rowStart, rowEnd - 1] })
        if (dest) claimHex(occupant, dest, state)
      }
    }

    // Create the ruiner stone as a dummy unit at the stone hex
    const stonePx = hexToPixel(stoneHex, HEX_SIZE)
    const teamStartHp = teamUnits.reduce((s, u) => s + u.currentHp, 0)

    const stone: Unit = {
      id: `ruiner_stone_${team}`,
      definitionId: 'ruiner_stone',
      name: 'Ruiner Stone',
      team,
      tier: 1,
      hexPos:    { ...stoneHex },
      visualPos: { ...stonePx },
      moveProgress: 0,
      path: [],
      maxHp: 999999, currentHp: 999999,
      maxMana: 0,    currentMana: 0,
      attack: 0, special: 0, defense: 0, spDefense: 0,
      attackSpeed: 0, critChance: 0, critDamage: 1, range: 0,
      moveSpeed: 0,
      isDummy: true,
      state: 'idle',
      targetId: null,
      attackTimer: 0, attackWindupTimer: 0, isInWindup: false, pendingCrit: false,
      manaLockTimer: 0, abilityCastTimer: 0,
      items: [], types: ['ruiner_stone'],
      statusEffects: [], shields: [],
      attackModifiers: [], passiveAttackHandlers: [], passiveCastHandlers: [],
      role: undefined,
      placedAt: 0,
      attackCount: 0, damageTakenThisCombat: 0, damageDealtThisCombat: 0, traitDmg: {}, traitHeal: {}, traitShield: {}, traitMitigated: {}, traitCount: {},
      silenced: false, whirlpooled: false, marks: [],
      incomingDamageMult: 1.0,
      _computedStats: null,
    }

    state.units.set(stone.id, stone)
    state.hexOccupancy.set(stoneHexId, stone.id)

    // Tick effect on the stone: update proximity magnitude and watch for spawn trigger
    stone.statusEffects.push({
      id: 'ruiner_stone',
      sourceUnitId: 'trait',
      durationTicks: -1,
      magnitude: 0,  // proximity 0→1 as team approaches 20% HP loss; renderer reads this for rumble
      stackId: 'ruiner_stone',
      tickEffect: (_stone, st) => {
        const allies = [...st.units.values()].filter(a => a.team === team && a.state !== 'dead' && !a.isDummy)
        const currentHp = allies.reduce((s, a) => s + a.currentHp, 0)
        const ratio = currentHp / teamStartHp  // 1.0 at start, 0.8 = threshold
        const proximity = Math.max(0, Math.min(1, (1 - ratio) / 0.20))  // 0=full HP, 1=at threshold
        const fx = _stone.statusEffects.find(e => e.stackId === 'ruiner_stone')
        if (fx) fx.magnitude = proximity

        if (ratio > 0.80) return

        // Threshold reached — remove stone, spawn golem
        st.units.delete(stone.id)
        st.hexOccupancy.delete(stoneHexId)

        const golem = makeUnit(golemId, team, golemTier)
        golem._traitOwner = 'ruiner'   // its damage dealt / soaked → attributed to Ruiner
        golem.maxHp     = Math.round(golem.maxHp * (1 + 0.10 * totalLevels))
        golem.currentHp = golem.maxHp
        golem.special   = Math.round(golem.special * (1 + 0.02 * totalLevels))
        golem._computedStats = null

        golem.hexPos    = { ...stoneHex }
        golem.visualPos = { ...stonePx }
        st.hexOccupancy.set(stoneHexId, golem.id)
        st.units.set(golem.id, golem)

        golem.statusEffects.push({
          id: 'ruiner_arise',
          sourceUnitId: 'trait',
          durationTicks: ARISE_TICKS,
          magnitude: ARISE_TICKS,
          stackId: 'ruiner_arise',
        })
      },
    })
  }
}

// ─── Ascender ─────────────────────────────────────────────────────────────────
// Cliffs are placed by the player before combat. At combat start this:
//   1. Buffs adjacent (non-cliff) allies with armor + MR
//   2. Wires an onDeath callback that fires the fall: true damage + stun in a
//      4-hex column extending forward from the cliff's position.

function applyAscender(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const nonDummyUnits = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const ascenderSpecies = new Set(
      nonDummyUnits.filter(u => u.types.includes('ascender')).map(u => u.definitionId)
    )
    const n = ascenderSpecies.size
    const level = n >= 4 ? 4 : n >= 2 ? 2 : 0
    if (level === 0) continue

    const armorBonus  = level >= 4 ? 30 : 20
    const fallDamage  = level >= 4 ? 500 : 300

    const cliffs = [...state.units.values()].filter(
      u => u.team === team && (u.definitionId === 'cliff_l' || u.definitionId === 'cliff_r')
    )

    for (const cliff of cliffs) {
      if (level >= 4) {
        cliff.maxHp     += 300
        cliff.currentHp += 300
        cliff.defense   += 20
        cliff.spDefense += 20
      }
      // Buff adjacent allies
      for (const adjHex of hexesInRange(cliff.hexPos, 1)) {
        const adjId = state.hexOccupancy.get(hexId(adjHex))
        if (!adjId) continue
        const adj = state.units.get(adjId)
        if (!adj || adj.team !== team || adj.isDummy || adj.state === 'dead') continue
        addStatusEffect(adj, {
          id: 'armorBuff', sourceUnitId: cliff.id, durationTicks: -1,
          magnitude: armorBonus, stackId: `ascender_armor_${cliff.id}`,
        })
        addStatusEffect(adj, {
          id: 'spDefBuff', sourceUnitId: cliff.id, durationTicks: -1,
          magnitude: armorBonus, stackId: `ascender_spdef_${cliff.id}`,
        })
      }

      // Register fall on cliff death
      const capturedTeam    = team
      const capturedDamage  = fallDamage
      const capturedIsLeft  = cliff.definitionId === 'cliff_l'
      cliff.statusEffects.push({
        id: 'cliff_trait',
        sourceUnitId: 'trait',
        durationTicks: -1,
        stackId: 'cliff_trait',
        onDeath: (c, st) => {
          const direction = capturedTeam === 'player' ? -1 : 1 as -1 | 1
          const col = c.hexPos.col
          st.events.push({
            type: 'vfx', effectId: 'cliff_fall',
            x: c.visualPos.x, y: c.visualPos.y,
            direction: direction as -1 | 1, col, row: c.hexPos.row, isLeft: capturedIsLeft,
          })
          // 2-1-2-1 tumble pattern: odd steps hit 2 hexes, even steps hit 1
          const stepCols: number[][] = [
            [col - 1, col],   // step 1: left + col
            [col],            // step 2: col only
            [col - 1, col],   // step 3: left + col
            [col],            // step 4: col only
          ]
          for (let step = 1; step <= 4; step++) {
            const row = c.hexPos.row + step * direction
            if (row < 0 || row > 7) continue
            for (const affectedCol of stepCols[step - 1]) {
              if (affectedCol < 0 || affectedCol > 6) continue
              const tgtId = st.hexOccupancy.get(hexId({ col: affectedCol, row }))
              if (!tgtId) continue
              const tgt = st.units.get(tgtId)
              if (!tgt || tgt.team === capturedTeam || tgt.state === 'dead') continue
              applyDamage(c, tgt, { baseAmount: capturedDamage, damageType: 'true', canCrit: false, abilityId: 'cliff_fall', traitSource: 'ascender' }, st)
              if (tgt.currentHp > 0) {
                addStatusEffect(tgt, { id: 'stun', sourceUnitId: c.id, durationTicks: 2 * TICK_RATE })
              }
            }
          }
        },
      })
    }
  }
}

// ─── Corkscrew ────────────────────────────────────────────────────────────────
// First auto on a new target: dash through and back — 2 physical hits at % attack,
// permanently removes % of target's defense. All corkscrew units gain move speed.
// (2) 60%/10%/+0.20ms  (3) 70%/20%/+0.25ms  (4) 80%/30%/+0.30ms  (5) 100%/50%/+0.35ms
function applyCorkscrew(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits      = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const corkscrewUnits = teamUnits.filter(u => u.types.includes('corkscrew'))
    const n              = new Set(corkscrewUnits.map(u => u.definitionId)).size
    const level          = n >= 5 ? 5 : n >= 4 ? 4 : n >= 3 ? 3 : n >= 2 ? 2 : 0
    if (level === 0) continue

    const dmgPct      = level >= 5 ? 1.00 : level >= 4 ? 0.80 : level >= 3 ? 0.70 : 0.60
    const defShredPct = level >= 5 ? 0.50 : level >= 4 ? 0.30 : level >= 3 ? 0.20 : 0.10
    const msBonus     = level >= 5 ? 0.35 : level >= 4 ? 0.30 : level >= 3 ? 0.25 : 0.20

    for (const unit of corkscrewUnits) {
      unit.moveSpeed += msBonus

      let lastTargetId: string | null = null

      // Reset on ability cast so the first auto after a cast always triggers the dash
      unit.passiveCastHandlers.push({
        id: 'corkscrew_cast_reset',
        onCast: () => {},
        afterCast: (_src: Unit, _st: CombatState) => { lastTargetId = null },
      })

      unit.passiveAttackHandlers.push({
        id: 'corkscrew_strike',
        suppressBaseAttack: true,

        onAttack(src: Unit, tgt: Unit, st: CombatState): void {
          // An attack modifier is driving this attack (e.g. Weavile empowered autos) —
          // skip corkscrew logic entirely so lastTargetId stays clear for the first regular auto after cast.
          if (src.attackModifiers.length > 0) return

          const srcStats    = src._computedStats ?? computeStats(src)
          const isNewTarget = tgt.id !== lastTargetId
          lastTargetId      = tgt.id

          if (isNewTarget) {
            // Visual: signals unitLayer to play deep lunge + spinning return
            addStatusEffect(src, {
              id: 'corkscrew_dash', sourceUnitId: src.id,
              durationTicks: 20, magnitude: 20,
              stackId: 'corkscrew_dash',
            })

            const dmg = Math.round(srcStats.attack * dmgPct)
            // Corkscrew's share of each dash hit = its bonus over a normal 100%-attack
            // auto, spread across the two hits: (2·dmgPct − 1) / (2·dmgPct).
            const corkFrac = Math.max(0, (2 * dmgPct - 1) / (2 * dmgPct))

            // Hit 1: dash through
            if (tgt.state !== 'dead') {
              const r1 = applyDamage(src, tgt, {
                baseAmount: dmg, damageType: 'physical',
                canCrit: true, forceCrit: src.pendingCrit,
                isAutoAttack: true,   // Corkscrew replaces the base auto — this IS the auto attack
                abilityId: 'corkscrew_dash',
                traitFrac: { trait: 'corkscrew', frac: corkFrac },
              }, st)
              gainManaOnDamageTaken(tgt, r1.preMitigDamage)
            }

            // Defense shred — permanent, unique per attacker so multiple corkscrews can stack
            if (tgt.state !== 'dead') {
              const shredId = `corkscrew_def_shred_${src.id}`
              if (!tgt.statusEffects.some(fx => fx.stackId === shredId)) {
                addStatusEffect(tgt, {
                  id: 'sunder_pct', sourceUnitId: src.id,
                  durationTicks: -1, magnitude: defShredPct,
                  stackId: shredId,
                })
                tgt._computedStats = null
              }
            }

            // Hit 2: dash back (attacker gains mana again; attack.ts already gave one hit's worth)
            if (tgt.state !== 'dead') {
              const r2 = applyDamage(src, tgt, {
                baseAmount: dmg, damageType: 'physical',
                canCrit: true, forceCrit: src.pendingCrit,
                isAutoAttack: true,   // Corkscrew replaces the base auto — this IS the auto attack
                abilityId: 'corkscrew_dash',
                traitFrac: { trait: 'corkscrew', frac: corkFrac },
              }, st)
              gainManaOnHit(src)
              gainManaOnDamageTaken(tgt, r2.preMitigDamage)
            }
          } else {
            // Same target: normal melee auto (attack.ts already calls gainManaOnHit)
            const result = applyDamage(src, tgt, {
              baseAmount: srcStats.attack, damageType: 'physical',
              canCrit: false, forceCrit: src.pendingCrit,
              abilityId: 'auto_attack',
            }, st)
            gainManaOnDamageTaken(tgt, result.preMitigDamage)
          }
        },
      })
    }
  }
}

// ─── Roughneck ────────────────────────────────────────────────────────────────
// Roughneck units gain flat Attack, Omnivamp, and deal bonus damage to targets
// below 50% HP. The bonus-damage flag is read in damage.ts.
// (2) +20 atk, 10% vamp, 5%   (3) +25, 13%, 7%   (4) +30, 16%, 10%   (5) +40, 20%, 15%
function applyRoughneck(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits      = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const roughneckUnits = teamUnits.filter(u => u.types.includes('roughneck'))
    const n              = new Set(roughneckUnits.map(u => u.definitionId)).size
    const level          = n >= 5 ? 5 : n >= 4 ? 4 : n >= 3 ? 3 : n >= 2 ? 2 : 0
    if (level === 0) continue

    const atkBonus    = level >= 5 ? 40 : level >= 4 ? 30 : level >= 3 ? 25 : 20
    const omnivamp    = level >= 5 ? 0.20 : level >= 4 ? 0.16 : level >= 3 ? 0.13 : 0.10
    const bonusDmgPct = level >= 5 ? 0.15 : level >= 4 ? 0.10 : level >= 3 ? 0.07 : 0.05

    for (const unit of roughneckUnits) {
      // +Attack via a tagged status (not a base mutation) so computeStats attributes it.
      addStatusEffect(unit, {
        id: 'roughneck_atk', sourceUnitId: 'trait',
        durationTicks: -1, magnitude: atkBonus,
        stackId: 'roughneck_atk',
      })
      unit._computedStats = null
      addStatusEffect(unit, {
        id: 'omnivamp_buff', sourceUnitId: 'trait',
        durationTicks: -1, magnitude: omnivamp,
        stackId: 'roughneck_omnivamp',
      })
      addStatusEffect(unit, {
        id: 'roughneck_bonus_dmg', sourceUnitId: 'trait',
        durationTicks: -1, magnitude: bonusDmgPct,
        stackId: 'roughneck_bonus_dmg',
      })
    }
  }
}

// ─── Quickclaw ────────────────────────────────────────────────────────────────
// Quickclaw units gain attack speed on each attack, stacking up to 10 times.
// (2) 4%  (3) 6%  (4) 8%  (5) 10%
function applyQuickclaw(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits      = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const quickclawUnits = teamUnits.filter(u => u.types.includes('quickclaw'))
    const n              = new Set(quickclawUnits.map(u => u.definitionId)).size
    const level          = n >= 5 ? 5 : n >= 4 ? 4 : n >= 3 ? 3 : n >= 2 ? 2 : 0
    if (level === 0) continue

    const perStack  = level >= 5 ? 0.10 : level >= 4 ? 0.08 : level >= 3 ? 0.06 : 0.04
    const MAX_STACKS = 10
    const cap       = perStack * MAX_STACKS

    for (const unit of quickclawUnits) {
      if (unit.passiveAttackHandlers.some(h => h.id === 'quickclaw_stack')) continue
      unit.passiveAttackHandlers.push({
        id: 'quickclaw_stack',
        onAttack(src: Unit, _tgt: Unit, _st: CombatState) {
          const fx = src.statusEffects.find(e => e.stackId === 'quickclaw_atkspd')
          if (fx) {
            if ((fx.magnitude ?? 0) >= cap) return
            fx.magnitude = Math.min(cap, (fx.magnitude ?? 0) + perStack)
          } else {
            addStatusEffect(src, {
              id: 'atkSpd_buff', sourceUnitId: 'trait',
              durationTicks: -1, magnitude: perStack,
              stackId: 'quickclaw_atkspd',
            })
          }
          src._computedStats = null
        },
      })
    }
  }
}

// ─── Froststone ───────────────────────────────────────────────────────────────
// Auto attacks mark enemies (up to 5 stacks) dealing scaling true damage.
// Hitting a fully-stacked target consumes all marks for bonus special damage.

function applyFroststoneMark(
  source: Unit, target: Unit, state: CombatState,
  perMarkDmg: number,
): void {
  if (target.team === source.team || target.state === 'dead') return

  const markFx        = target.statusEffects.find(fx => fx.stackId === 'froststone_mark')
  const currentStacks = markFx?.magnitude ?? 0
  if (currentStacks >= 5) return  // fully stacked — only spells consume

  // Apply mark + bonus true damage scaled by current stacks
  const bonusDmg = perMarkDmg * (1 + currentStacks)
  applyDamage(source, target, { baseAmount: bonusDmg, damageType: 'magic', canCrit: false, traitSource: 'froststone' }, state)
  const newStacks = currentStacks + 1
  if (markFx) {
    markFx.magnitude = newStacks
  } else {
    target.statusEffects.push({ id: 'froststone_mark', sourceUnitId: source.id, durationTicks: -1, magnitude: newStacks, stackId: 'froststone_mark' })
  }
}


function applyFroststone(state: CombatState): void {
  const froststoneUnits = [...state.units.values()].filter(u =>
    u.team === 'player' && !u.isDummy && u.types.includes('froststone')
  )
  const n = new Set(froststoneUnits.map(u => u.definitionId)).size
  const level = n >= 6 ? 6 : n >= 4 ? 4 : n >= 2 ? 2 : 0
  if (level === 0) return

  const perMarkDmg   = level >= 6 ? 25 : level >= 4 ? 19 : 13
  const consumeBonus = level >= 6 ? 200 : level >= 4 ? 150 : 100

  for (const unit of froststoneUnits) {
    if (unit.passiveAttackHandlers.some(h => h.id === 'froststone_mark')) continue

    // Store consume bonus on the unit so tryConsumeFroststoneMark can read it
    if (!unit.statusEffects.some(fx => fx.stackId === 'froststone_active')) {
      unit.statusEffects.push({ id: 'froststone_active', sourceUnitId: 'trait', durationTicks: -1, magnitude: consumeBonus, stackId: 'froststone_active' })
    }

    const stats    = unit._computedStats ?? computeStats(unit)
    const isRanged = stats.range > 1

    unit.passiveAttackHandlers.push({
      id: 'froststone_mark',
      onAttack(source: Unit, target: Unit, st: CombatState) {
        if (isRanged) return  // ranged units apply mark on projectile hit
        applyFroststoneMark(source, target, st, perMarkDmg)
      },
      onProjectileHit(source: Unit, target: Unit, st: CombatState) {
        applyFroststoneMark(source, target, st, perMarkDmg)
      },
    })
  }
}

// ─── Promoter ─────────────────────────────────────────────────────────────────
// Each Promoter pulses a 1-hex aura at combat start. Every ally in range (including
// the Promoter itself) receives one shield per Promoter they're adjacent to — shields
// stack, but the attack-speed buff does not. The buff is removed when all Promoter
// shields on that unit have expired or been broken.
// Promoters receive a +5% larger shield from their own aura.
// (2) 10% HP shield, 10% atkSpd   (4) 30%/20%   (6) 45%/30%
function applyPromoter(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits     = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const promoterUnits = teamUnits.filter(u => u.types.includes('promoter'))
    const n             = new Set(promoterUnits.map(u => u.definitionId)).size
    const shieldFlat    = n >= 6 ? 450 : n >= 4 ? 300 : n >= 2 ? 200 : 0
    const atkspdBonus   = n >= 6 ? 0.30 : n >= 4 ? 0.20 : n >= 2 ? 0.10 : 0
    if (shieldFlat === 0) continue

    const SHIELD_TICKS = 10 * TICK_RATE

    const removeAtkspdIfExhausted = (u: Unit, sh: Shield) => {
      if (!u.shields.some(s => s !== sh && s.sourceAbility === 'promoter_aura')) {
        const idx = u.statusEffects.findIndex(fx => fx.stackId === 'promoter_atkspd')
        if (idx >= 0) { u.statusEffects.splice(idx, 1); u._computedStats = null }
      }
    }

    for (const promoter of promoterUnits) {
      for (const hex of hexesInRange(promoter.hexPos, 1)) {
        const unitId = state.hexOccupancy.get(hexId(hex))
        if (!unitId) continue
        const ally = state.units.get(unitId)
        if (!ally || ally.team !== team || ally.isDummy || ally.state === 'dead') continue

        const isPromoter  = ally.types.includes('promoter')
        const shieldValue = isPromoter ? Math.round(shieldFlat * 1.05) : shieldFlat

        const shield: Shield = {
          id: crypto.randomUUID(),
          sourceAbility: 'promoter_aura',
          value: shieldValue,
          maxValue: shieldValue,
          durationTicks: SHIELD_TICKS,
          effectiveMaxHp: ally.currentHp + shieldValue,
          traitSource: 'promoter',   // damage this shield absorbs → attributed to Promoter
          onExpire: (u, sh) => removeAtkspdIfExhausted(u, sh),
        }
        ally.shields.push(shield)
        state.events.push({ type: 'shield', unitId: ally.id, amount: shieldValue, sourceId: promoter.id })

        // Atkspd buff: apply once per unit, not once per shield
        if (!ally.statusEffects.some(fx => fx.stackId === 'promoter_atkspd')) {
          addStatusEffect(ally, {
            id: 'atkSpd_buff',
            sourceUnitId: 'trait',
            durationTicks: -1,
            magnitude: atkspdBonus,
            stackId: 'promoter_atkspd',
          })
          ally._computedStats = null
        }
      }
    }
  }
}

// ─── Substitutor ──────────────────────────────────────────────────────────────
// On death, each Substitutor spawns a stationary dummy at its hex that enemies
// must defeat before moving on. HP scales with the number of Substitutor species.
// (1) 30% of dead unit's maxHp  (3) 50%  (5) 70%
// Substitute HP is scaled by a stage multiplier that climbs linearly from
// SUB_HP_START_MULT at stage 1 to full (1.0) at SUB_HP_PLATEAU_STAGE and holds.
const SUB_HP_START_MULT    = 0.4   // stage 1 → 40% of the breakpoint HP
const SUB_HP_PLATEAU_STAGE = 5     // full strength from stage 5 onward

function applySubstitutor(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits        = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const substitutorUnits = teamUnits.filter(u => u.types.includes('substitutor'))
    const n   = new Set(substitutorUnits.map(u => u.definitionId)).size
    // Substitute HP ramps with the stage instead of being full-strength from
    // round 1 — an early substitute was so much effective HP that fights kept
    // stalling into overtime. The same multiplier scales all three breakpoints,
    // so growth is consistent across the low/med/high subs. Headless/test
    // combats leave state.stage undefined and get full strength.
    const baseSubHp = n >= 5 ? 3000 : n >= 3 ? 2200 : 1500
    const stage = state.stage ?? SUB_HP_PLATEAU_STAGE
    const t = (stage - 1) / (SUB_HP_PLATEAU_STAGE - 1)
    const mult = Math.min(1, Math.max(SUB_HP_START_MULT, SUB_HP_START_MULT + (1 - SUB_HP_START_MULT) * t))
    const subHp = Math.round(baseSubHp * mult)

    for (const unit of substitutorUnits) {
      addStatusEffect(unit, {
        id: 'substitutor_onDeath',
        sourceUnitId: 'trait',
        durationTicks: -1,
        stackId: 'substitutor_onDeath',
        onDeath: (dead, st) => {
          // Hex is freed before onDeath fires — only spawn if still clear
          const hx = dead.hexPos
          if (st.hexOccupancy.has(hexId(hx))) return

          const sub: import('../types').Unit = {
            id: `substitutor_sub_${dead.id}`,
            definitionId: 'substitutor_sub',
            name: 'Substitute',
            team,
            tier: 1,
            _traitOwner: 'substitutor',   // damage it soaks (as a decoy) → attributed to Substitutor
            hexPos:    { ...hx },
            visualPos: { ...dead.visualPos },
            moveProgress: 0, path: [],
            maxHp: subHp, currentHp: subHp,
            maxMana: 0, currentMana: 0,
            attack: 0, special: 0, defense: 0, spDefense: 0,
            attackSpeed: 0, critChance: 0, critDamage: 1, range: 0,
            moveSpeed: 0,
            isDummy: true,
            state: 'idle',
            targetId: null,
            attackTimer: 0, attackWindupTimer: 0, isInWindup: false, pendingCrit: false,
            manaLockTimer: 0, abilityCastTimer: 0,
            items: [], types: ['substitutor_sub'],
            statusEffects: [], shields: [],
            attackModifiers: [], passiveAttackHandlers: [], passiveCastHandlers: [],
            role: undefined, placedAt: 0,
            attackCount: 0, damageTakenThisCombat: 0, damageDealtThisCombat: 0, traitDmg: {}, traitHeal: {}, traitShield: {}, traitMitigated: {}, traitCount: {},
            silenced: false, whirlpooled: false, marks: [],
            incomingDamageMult: 1.0,
            _computedStats: null,
          }
          st.units.set(sub.id, sub)
          st.hexOccupancy.set(hexId(hx), sub.id)
        },
      })
    }
  }
}

// ─── Keen Eye ─────────────────────────────────────────────────────────────────
// All allies gain +1 mana per second. Keen Eye units gain 25%/40% more mana
// from all sources (on-hit, on-damage-taken, and per-second regen).
function applyKeenEye(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const keenUnits = teamUnits.filter(u => u.types.includes('keen_eye'))
    const n = new Set(keenUnits.map(u => u.definitionId)).size
    if (n < 2) continue

    // Breakpoints 2 / 4 / 6: +1/+2/+3 mana per second team-wide, and Keen Eye
    // units themselves gain 25%/50%/75% more mana from all sources.
    const tier      = n >= 6 ? 3 : n >= 4 ? 2 : 1
    const bonus     = tier * 0.25   // 0.25 / 0.50 / 0.75
    const baseRegen = tier          // 1 / 2 / 3

    // Keen Eye units get the mana multiplier first so the tick effect can read it
    for (const unit of keenUnits) {
      addStatusEffect(unit, {
        id: 'keen_eye_mana_boost',
        sourceUnitId: 'trait',
        durationTicks: -1,
        magnitude: bonus,
        stackId: 'keen_eye_mana_boost',
      })
    }

    // All allies: +baseRegen mana per second (keen eye units get the multiplier applied)
    for (const unit of teamUnits) {
      addStatusEffect(unit, {
        id: 'keen_eye_regen',
        sourceUnitId: 'trait',
        durationTicks: -1,
        stackId: 'keen_eye_regen',
        tickInterval: TICK_RATE,
        tickEffect: (u, _s) => {
          if (u.state === 'dead' || u.maxMana === 0) return
          const keenFx = u.statusEffects.find(fx => fx.stackId === 'keen_eye_mana_boost')
          const mult = keenFx ? 1 + (keenFx.magnitude ?? 0) : 1
          const before = u.currentMana
          u.currentMana = Math.min(u.maxMana, u.currentMana + Math.round(baseRegen * mult))
          // Extra casts enabled: mana Keen Eye actually granted ÷ mana per cast.
          u.traitCount.keen_eye = (u.traitCount.keen_eye ?? 0) + (u.currentMana - before) / u.maxMana
        },
      })
    }
  }
}

// ─── Stalwart ─────────────────────────────────────────────────────────────────
// At 60% and 30% HP, each Stalwart unit permanently gains Defense and Sp. Def.
// Each threshold fires at most once per unit per combat.
// (2) +20  (4) +40  (6) +60
function applyStalwart(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits     = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const stalwartUnits = teamUnits.filter(u => u.types.includes('stalwart'))
    const n             = new Set(stalwartUnits.map(u => u.definitionId)).size
    const bonus         = n >= 6 ? 60 : n >= 4 ? 40 : n >= 2 ? 20 : 0
    if (bonus === 0) continue

    for (const unit of stalwartUnits) {
      addStatusEffect(unit, {
        id: 'stalwart_watch',
        sourceUnitId: 'trait',
        durationTicks: -1,
        stackId: 'stalwart_watch',
        tickEffect: (u, _s) => {
          if (u.state === 'dead' || u.maxHp === 0) return
          const pct = u.currentHp / u.maxHp

          // +Def/SpDef via a tagged status (not a base mutation) so computeStats
          // attributes the damage it reduces. The stalwart_60/30 marker still guards
          // the once-per-breakpoint trigger (and drives the renderer).
          if (pct <= 0.60 && !u.statusEffects.some(fx => fx.stackId === 'stalwart_60')) {
            u.statusEffects.push({ id: 'stalwart_triggered', sourceUnitId: 'trait', durationTicks: -1, stackId: 'stalwart_60' })
            addStatusEffect(u, { id: 'stalwart_def', sourceUnitId: 'trait', durationTicks: -1, magnitude: bonus, stackId: 'stalwart_def_60' })
            u._computedStats = null
          }

          if (pct <= 0.30 && !u.statusEffects.some(fx => fx.stackId === 'stalwart_30')) {
            u.statusEffects.push({ id: 'stalwart_triggered', sourceUnitId: 'trait', durationTicks: -1, stackId: 'stalwart_30' })
            addStatusEffect(u, { id: 'stalwart_def', sourceUnitId: 'trait', durationTicks: -1, magnitude: bonus, stackId: 'stalwart_def_30' })
            u._computedStats = null
          }
        },
      })
    }
  }
}

// ─── Spellweaver ──────────────────────────────────────────────────────────────
// All allies gain +15 adaptive force. Spellweavers gain more, plus extra per cast.
// Adaptive goes to the stat the ability scales off (role: special caster/marksman → special; attack roles → attack).
// (2) +20 adaptive, +1 per cast  (4) +35 adaptive, +2 per cast  (6) +80 adaptive, +4 per cast
function applySpellweaver(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits        = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const spellweaverUnits = teamUnits.filter(u => u.types.includes('spellweaver'))
    const n = new Set(spellweaverUnits.map(u => u.definitionId)).size
    if (n < 2) continue

    const unitAdaptive  = n >= 6 ? 80 : n >= 4 ? 35 : 20
    const perCast       = n >= 6 ? 4  : n >= 4 ? 2  : 1
    const TEAM_ADAPTIVE = 15

    // All allies: +15 adaptive force
    for (const unit of teamUnits) {
      addStatusEffect(unit, {
        id: 'spellweaver_adaptive', sourceUnitId: 'trait',
        durationTicks: -1, magnitude: TEAM_ADAPTIVE,
        stackId: 'spellweaver_team_adaptive',
      })
      unit._computedStats = null
    }

    // Spellweavers: extra adaptive on top of the team bonus
    for (const unit of spellweaverUnits) {
      addStatusEffect(unit, {
        id: 'spellweaver_adaptive', sourceUnitId: 'trait',
        durationTicks: -1, magnitude: unitAdaptive - TEAM_ADAPTIVE,
        stackId: 'spellweaver_unit_adaptive',
      })
      unit._computedStats = null
    }

    // On-cast: when ANY ally casts, all alive spellweavers on the team gain +perCast adaptive
    for (const unit of teamUnits) {
      if (unit.passiveCastHandlers.some(h => h.id === 'spellweaver_cast')) continue
      unit.passiveCastHandlers.push({
        id: 'spellweaver_cast',
        onCast(_src: Unit, st: CombatState) {
          for (const u of st.units.values()) {
            if (u.team !== team || u.state === 'dead' || !u.types.includes('spellweaver')) continue
            const fx = u.statusEffects.find(e => e.stackId === 'spellweaver_cast_stacks')
            if (fx) {
              fx.magnitude = (fx.magnitude ?? 0) + perCast
            } else {
              addStatusEffect(u, {
                id: 'spellweaver_adaptive', sourceUnitId: 'trait',
                durationTicks: -1, magnitude: perCast,
                stackId: 'spellweaver_cast_stacks',
              })
            }
            u._computedStats = null
          }
        },
      })
    }
  }
}

// ─── Mystic ───────────────────────────────────────────────────────────────────
// Mystic abilities steal enemy durability (defense + spDefense %) and grant it team-wide.
// (2) 3% per ability hit, up to 18% per enemy and max 18% for the team
// (4) 5% per ability hit, up to 20% per enemy and max 20% for the team
// The steal itself happens in damage.ts (applyDamage) — this marker arms mystic units
// with the threshold level so the damage pipeline knows the steal rate and caps.
function applyMystic(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const teamUnits   = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const mysticUnits = teamUnits.filter(u => u.types.includes('mystic'))
    const n = new Set(mysticUnits.map(u => u.definitionId)).size
    if (n < 2) continue

    const level = n >= 4 ? 4 : 2

    for (const unit of mysticUnits) {
      addStatusEffect(unit, {
        id: 'mystic_active', sourceUnitId: 'trait',
        durationTicks: -1, magnitude: level,
        stackId: 'mystic_active',
      })
    }
  }
}

// ─── Crashout ─────────────────────────────────────────────────────────────────
// Team-wide damage amp; Crash Outs gain double while team health is below 75%.
// (2) 5%   (3) 6%   (4) 8%
// The amp is a 'damage_amp' status read by applyDamage (multiplies all outgoing
// damage). Each crashout carries a permanent monitor that toggles the extra amp
// (stackId 'crashout_rage_amp') plus a 'crashout_rage' marker for the red tint.
function applyCrashout(state: CombatState): void {
  const LOW_HP_RATIO     = 0.75
  const RAGE_ENTER_TICKS = 40  // ~0.67s of invulnerability + hop/rumble animation

  for (const team of ['player', 'enemy'] as const) {
    const teamUnits     = [...state.units.values()].filter(u => u.team === team && !u.isDummy)
    const crashoutUnits = teamUnits.filter(u => u.types.includes('crashout'))
    const n = new Set(crashoutUnits.map(u => u.definitionId)).size
    if (n < 2) continue

    const amp = n >= 4 ? 0.08 : n >= 3 ? 0.06 : 0.05

    // All allies: flat damage amp
    for (const unit of teamUnits) {
      addStatusEffect(unit, {
        id: 'damage_amp', sourceUnitId: 'trait',
        durationTicks: -1, magnitude: amp,
        stackId: 'crashout_team_amp',
      })
    }

    // Each crashout: monitor team health and toggle the doubled amp + rage tint
    for (const unit of crashoutUnits) {
      addStatusEffect(unit, {
        id: 'crashout_monitor', sourceUnitId: 'trait',
        durationTicks: -1, stackId: 'crashout_monitor',
        tickEffect: (u: Unit, st: CombatState) => {
          if (u.state === 'dead') return

          let cur = 0
          let max = 0
          for (const other of st.units.values()) {
            if (other.team !== team || other.isDummy) continue
            max += other.maxHp
            if (other.state !== 'dead') cur += other.currentHp
          }
          const low = max > 0 && cur / max < LOW_HP_RATIO

          const hasRage = u.statusEffects.some(fx => fx.stackId === 'crashout_rage_amp')
          if (low && !hasRage) {
            addStatusEffect(u, {
              id: 'damage_amp', sourceUnitId: 'trait',
              durationTicks: -1, magnitude: amp,
              stackId: 'crashout_rage_amp',
            })
            addStatusEffect(u, {
              id: 'crashout_rage', sourceUnitId: 'trait',
              durationTicks: -1, stackId: 'crashout_rage',
            })
            // Rage entry: brief invulnerability + hop-and-rumble animation
            u.incomingDamageMult = 0
            addStatusEffect(u, {
              id: 'crashout_rage_enter', sourceUnitId: 'trait',
              durationTicks: RAGE_ENTER_TICKS, magnitude: RAGE_ENTER_TICKS,
              stackId: 'crashout_rage_enter',
              onExpire: (u2: Unit) => { u2.incomingDamageMult = 1.0 },
            })
          } else if (!low && hasRage) {
            removeStatusEffectByStack(u, 'crashout_rage_amp')
            removeStatusEffectByStack(u, 'crashout_rage')
          }
        },
      })
    }
  }
}

// ─── Zen ───────────────────────────────────────────────────────────────────────
// At 50% health, a Zen unit enters Zen form: a 1200 health shield + 200 HP/sec
// heal. It reverts to angry form when the shield breaks OR it reaches full HP.
// Its first cast after entering Zen deals 50% more damage (a one-shot marker the
// ability consumes). Each Zen unit carries a permanent self-monitor.
//
// Form/heal state is driven by these per-unit status effects (all read by the
// renderer for the sprite swap + rumble):
//   'zen_form'    — present while in Zen form (sprite swap + shield heal tick)
//   'zen_shift'   — short rumble marker added on every form transition
//   'zen_empower_cast' — one-shot: next Flair Blitz deals +50%
// The monitor's magnitude is an "armed" edge-detector: it only enters Zen on the
// falling edge through 50%, and re-arms once HP climbs back above 50% — so a
// shield that breaks at low HP doesn't instantly re-trigger Zen.
const ZEN_SHIELD       = 1200
const ZEN_HEAL_PER_SEC = 200
const ZEN_SHIFT_TICKS  = 30   // ~0.5s rumble on each form change

const ZEN_DURABILITY  = 0.10   // +10% defense & sp. defense while meditating
const ZEN_MAX_MANA    = 60     // permanent max-mana pool after the first Zen ends

function enterZen(unit: Unit, state: CombatState): void {
  // Meditating: he can't act. Bail out of any in-flight dash first so hex
  // occupancy stays consistent (mirrors the stun/knockUp handling), then hold
  // him in the inert 'ascended' state — tickUnit skips it, so no move/attack/
  // cast; the monitor keeps healing him every tick regardless of state.
  if (unit.state === 'moving' || unit.state === 'leaping') cancelInFlightMovement(unit, state)
  unit.state = 'ascended'

  addStatusEffect(unit, {
    // suppressManaGain: no mana from hits or damage taken while in Zen.
    // magnitude drives the +10% durability computeStats case.
    id: 'zen_form', sourceUnitId: unit.id, durationTicks: -1, stackId: 'zen_form',
    magnitude: ZEN_DURABILITY, suppressManaGain: true,
  })
  addStatusEffect(unit, {
    id: 'zen_empower_cast', sourceUnitId: unit.id, durationTicks: -1, stackId: 'zen_empower_cast',
  })
  addStatusEffect(unit, {
    id: 'zen_shift', sourceUnitId: unit.id, durationTicks: ZEN_SHIFT_TICKS,
    magnitude: ZEN_SHIFT_TICKS, stackId: 'zen_shift',
  })
  addShield(unit, {
    id: `zen_shield_${unit.id}`,
    sourceAbility: 'zen',
    value: ZEN_SHIELD,
    maxValue: ZEN_SHIELD,
    durationTicks: -1,   // breaks only by damage
    onExpire: (u) => exitZen(u),
  }, state, 'zen')
}

function exitZen(unit: Unit): void {
  if (!unit.statusEffects.some(fx => fx.stackId === 'zen_form')) return
  removeStatusEffectByStack(unit, 'zen_form')
  // Drop any surviving Zen shield (the full-heal exit path) and re-rumble.
  unit.shields = unit.shields.filter(s => s.sourceAbility !== 'zen')
  // Release him from the meditation freeze so he fights again.
  if (unit.state === 'ascended') unit.state = 'idle'
  // Permanent -20 max mana for the rest of combat (80 → 60).
  unit.maxMana = ZEN_MAX_MANA
  if (unit.currentMana > unit.maxMana) unit.currentMana = unit.maxMana
  addStatusEffect(unit, {
    id: 'zen_shift', sourceUnitId: unit.id, durationTicks: ZEN_SHIFT_TICKS,
    magnitude: ZEN_SHIFT_TICKS, stackId: 'zen_shift',
  })
}

function applyZen(state: CombatState): void {
  for (const team of ['player', 'enemy'] as const) {
    const zenUnits = [...state.units.values()]
      .filter(u => u.team === team && !u.isDummy && u.types.includes('zen'))

    for (const unit of zenUnits) {
      // Per-tick heal accumulator (see below). Zen is once per combat, so this
      // single per-unit closure never needs resetting.
      let zenHealTick = 0
      addStatusEffect(unit, {
        id: 'zen_monitor', sourceUnitId: 'trait', durationTicks: -1,
        magnitude: 1,  // 1 = Zen still available, 0 = already used (once per combat)
        stackId: 'zen_monitor',
        tickEffect: (u: Unit, st: CombatState) => {
          if (u.state === 'dead') return
          const monitor = u.statusEffects.find(fx => fx.stackId === 'zen_monitor')
          if (!monitor) return

          if (u.statusEffects.some(fx => fx.stackId === 'zen_form')) {
            // In Zen: heal smoothly every tick (not in one lump each second),
            // like Fezandipiti — cumulative rounding keeps the per-second total
            // exactly ZEN_HEAL_PER_SEC with no drift. Revert on reaching full HP.
            zenHealTick++
            const target = Math.round(ZEN_HEAL_PER_SEC * zenHealTick / TICK_RATE)
            const prev   = Math.round(ZEN_HEAL_PER_SEC * (zenHealTick - 1) / TICK_RATE)
            const gain   = target - prev
            if (gain > 0) applyHeal(u, gain, u.id, st, 'zen')
            if (u.currentHp >= u.maxHp) exitZen(u)
            return
          }

          // Angry form: enter Zen once, the first time HP drops to 50%. The
          // marker is spent permanently — Zen does not re-trigger this combat.
          //
          // Don't interrupt an ability mid-cast/mid-dash: if HP crosses the
          // threshold while he's winding up or dashing (Flair Blitz), stay armed
          // and let the dashing attack finish — Zen triggers on a later tick once
          // he's back to a settled state. Freezing him mid-dash would strand the
          // leap and cut the attack short.
          const busy = u.state === 'casting' || u.state === 'leaping'
          const ratio = u.maxHp > 0 ? u.currentHp / u.maxHp : 1
          if ((monitor.magnitude ?? 0) >= 1 && ratio <= 0.5 && !busy) {
            monitor.magnitude = 0
            enterZen(u, st)
          }
        },
      })
    }
  }
}
