import { describe, it, expect } from 'vitest'
import { makeUnit, computeStats } from '../unitFactory'
import { createCombatState } from '../combatEngine'
import { tickAttack, startAttacking } from './attack'
import { tickStatusEffects, addStatusEffect } from './statusEffect'
import { triggerAbility, tickAbilityCast } from './ability'
import { applyDamage } from './damage'
import { ITEM_MAP } from '../../data/items'
import type { Unit, CombatState } from '../types'
import '../systems/ability'

// Drive a full ability cast to completion (Oranguru's cast is 20 ticks).
function castOnce(caster: Unit, state: CombatState, castTicks = 20): void {
  caster.currentMana = caster.maxMana
  triggerAbility(caster, state)
  for (let i = 0; i < castTicks; i++) tickAbilityCast(caster, state)
}

function equipMetronome(): { u: Unit; e: Unit; state: CombatState } {
  const u = makeUnit('tangela', 'player', 1); u.hexPos = { col: 3, row: 5 }
  const e = makeUnit('dummy', 'enemy', 1);     e.hexPos = { col: 3, row: 4 }
  u.items = ['metronome']
  const state = createCombatState([u], [e])
  return { u, e, state }
}

describe('Metronome item', () => {
  it('grants +30% attack speed and +10% adaptive force as base stats', () => {
    const bare = makeUnit('tangela', 'player', 1)
    const withItem = makeUnit('tangela', 'player', 1); withItem.items = ['metronome']
    const base = computeStats(bare)
    const buffed = computeStats(withItem)

    expect(buffed.attackSpeed).toBeCloseTo(base.attackSpeed * 1.30, 5)
    // Adaptive: +10% of the higher base offensive stat, added to that stat.
    const higher = Math.max(bare.attack, bare.special)
    const add = Math.round(0.10 * higher)
    if (bare.attack >= bare.special) expect(buffed.attack).toBe(base.attack + add)
    else                             expect(buffed.special).toBe(base.special + add)
  })

  it('registers the stacking-AS passive at combat start', () => {
    const { u } = equipMetronome()
    expect(u.passiveAttackHandlers.some(h => h.id === 'metronome_passive')).toBe(true)
  })

  it('each auto-attack adds a stacking attack-speed buff', () => {
    const { u, e, state } = equipMetronome()
    computeStats(u)
    const beforeAS = u._computedStats!.attackSpeed

    // Drive attacks until a few fire (windup → hit).
    u.targetId = e.id
    startAttacking(u)
    let autosSeen = 0
    let lastCount = u.attackCount
    for (let t = 0; t < 400 && autosSeen < 3; t++) {
      tickAttack(u, state)
      if (u.attackCount > lastCount) { autosSeen++; lastCount = u.attackCount }
    }
    expect(autosSeen).toBeGreaterThanOrEqual(3)

    const fx = u.statusEffects.find(f => f.stackId === 'metronome_as')
    expect(fx).toBeDefined()
    const asPerAuto = ITEM_MAP.get('metronome')!.effect!.asPerAuto
    expect(fx!.magnitude).toBeCloseTo(autosSeen * asPerAuto, 5)   // one stack per auto
    expect(computeStats(u).attackSpeed).toBeGreaterThan(beforeAS)   // AS actually rose
  })
})

function equipSitrus(): { u: Unit; state: CombatState } {
  const u = makeUnit('tangela', 'player', 1); u.hexPos = { col: 3, row: 5 }
  const e = makeUnit('dummy', 'enemy', 1);     e.hexPos = { col: 3, row: 4 }
  u.items = ['sitrus_berry']
  const state = createCombatState([u], [e])
  return { u, state }
}

describe('Sitrus Berry item', () => {
  it('grants +200 HP, +20 defense, +20 sp. defense', () => {
    const bare = makeUnit('tangela', 'player', 1)
    const withItem = makeUnit('tangela', 'player', 1); withItem.items = ['sitrus_berry']
    const base = computeStats(bare)
    const buffed = computeStats(withItem)
    expect(buffed.maxHp).toBe(base.maxHp + 200)
    expect(buffed.defense).toBe(base.defense + 20)
    expect(buffed.spDefense).toBe(base.spDefense + 20)
  })

  it('heals 25% max HP once, the first time the holder drops below 50%', () => {
    const { u, state } = equipSitrus()
    // Above the threshold — no heal.
    u.currentHp = Math.floor(u.maxHp * 0.6)
    tickStatusEffects(state.units, state)
    expect(u.currentHp).toBe(Math.floor(u.maxHp * 0.6))

    // Drop below 50% — heals 25% of max HP.
    u.currentHp = Math.floor(u.maxHp * 0.4)
    const before = u.currentHp
    tickStatusEffects(state.units, state)
    const expected = Math.min(u.maxHp, before + Math.round(u.maxHp * 0.25))
    expect(u.currentHp).toBe(expected)

    // Only once per combat — dropping low again does not heal.
    u.currentHp = Math.floor(u.maxHp * 0.3)
    const before2 = u.currentHp
    state.tick++; tickStatusEffects(state.units, state)
    expect(u.currentHp).toBe(before2)
  })
})

describe('Assault Vest item', () => {
  it('grants +100 HP and +35 sp. defense', () => {
    const bare = makeUnit('oranguru', 'player', 1)
    const withItem = makeUnit('oranguru', 'player', 1); withItem.items = ['assault_vest']
    const base = computeStats(bare)
    const buffed = computeStats(withItem)
    expect(buffed.maxHp).toBe(base.maxHp + 100)
    expect(buffed.spDefense).toBe(base.spDefense + 35)
  })

  it('grants +30% def & sp.def for 4s after casting', () => {
    const u = makeUnit('oranguru', 'player', 1); u.hexPos = { col: 3, row: 5 }
    u.items = ['assault_vest']
    const e = makeUnit('dummy', 'enemy', 1); e.hexPos = { col: 3, row: 2 }
    const state = createCombatState([u], [e])

    const defBefore = computeStats(u).defense
    const spDefBefore = computeStats(u).spDefense
    expect(u.statusEffects.some(fx => fx.stackId === 'assault_vest_buff')).toBe(false)

    castOnce(u, state)

    const fx = u.statusEffects.find(f => f.stackId === 'assault_vest_buff')
    expect(fx).toBeDefined()
    expect(fx!.magnitude).toBeCloseTo(0.30, 5)
    expect(fx!.durationTicks).toBe(4 * 60)
    expect(computeStats(u).defense).toBe(Math.round(defBefore * 1.30))
    expect(computeStats(u).spDefense).toBe(Math.round(spDefBefore * 1.30))
  })
})

describe('Rocky Helmet item', () => {
  it('grants +100 HP and +35 defense', () => {
    const bare = makeUnit('oranguru', 'player', 1)
    const withItem = makeUnit('oranguru', 'player', 1); withItem.items = ['rocky_helmet']
    const base = computeStats(bare)
    const buffed = computeStats(withItem)
    expect(buffed.maxHp).toBe(base.maxHp + 100)
    expect(buffed.defense).toBe(base.defense + 35)
  })

  it('reflects magic damage to a unit that auto-attacks the holder', () => {
    const holder = makeUnit('oranguru', 'player', 1); holder.hexPos = { col: 3, row: 5 }
    holder.items = ['rocky_helmet']
    const attacker = makeUnit('dummy', 'enemy', 1); attacker.hexPos = { col: 3, row: 4 }
    const state = createCombatState([holder], [attacker])
    expect(holder.statusEffects.some(fx => fx.id === 'rocky_helmet')).toBe(true)

    const attackerHpBefore = attacker.currentHp
    applyDamage(attacker, holder, {
      baseAmount: 10, damageType: 'physical', canCrit: false, abilityId: 'auto_attack',
    }, state)
    // Attacker took reflected damage: 33% of the holder's defense as magic.
    expect(attacker.currentHp).toBeLessThan(attackerHpBefore)
  })

  it('does not reflect on non-auto-attack damage', () => {
    const holder = makeUnit('oranguru', 'player', 1); holder.hexPos = { col: 3, row: 5 }
    holder.items = ['rocky_helmet']
    const attacker = makeUnit('dummy', 'enemy', 1); attacker.hexPos = { col: 3, row: 4 }
    const state = createCombatState([holder], [attacker])

    const attackerHpBefore = attacker.currentHp
    applyDamage(attacker, holder, {
      baseAmount: 10, damageType: 'magic', canCrit: false, abilityId: 'some_ability',
    }, state)
    expect(attacker.currentHp).toBe(attackerHpBefore)
  })
})

describe('Leftovers item', () => {
  it('grants +400 HP', () => {
    const bare = makeUnit('oranguru', 'player', 1)
    const withItem = makeUnit('oranguru', 'player', 1); withItem.items = ['leftovers']
    expect(computeStats(withItem).maxHp).toBe(computeStats(bare).maxHp + 400)
  })

  it('heals 6% of max HP every second', () => {
    const u = makeUnit('oranguru', 'player', 1); u.hexPos = { col: 3, row: 5 }
    u.items = ['leftovers']
    const e = makeUnit('dummy', 'enemy', 1); e.hexPos = { col: 3, row: 2 }
    const state = createCombatState([u], [e])

    u.currentHp = Math.floor(u.maxHp * 0.3)
    const before = u.currentHp
    // tickInterval gates on state.tick % 60 === 0 — advance to a one-second boundary.
    state.tick = 60
    tickStatusEffects(state.units, state)
    const healPctPerSec = ITEM_MAP.get('leftovers')!.effect!.healPctPerSec
    expect(u.currentHp).toBe(Math.min(u.maxHp, before + Math.round(u.maxHp * healPctPerSec)))
  })
})

describe('Spell Tag item', () => {
  it('grants +10 attack and +10 special', () => {
    const bare = makeUnit('oranguru', 'player', 1)
    const withItem = makeUnit('oranguru', 'player', 1); withItem.items = ['spell_tag']
    const base = computeStats(bare)
    const buffed = computeStats(withItem)
    expect(buffed.attack).toBe(base.attack + 10)
    expect(buffed.special).toBe(base.special + 10)
  })

  it('restores 10 mana after finishing a cast', () => {
    const u = makeUnit('oranguru', 'player', 1); u.hexPos = { col: 3, row: 5 }
    u.items = ['spell_tag']
    const e = makeUnit('dummy', 'enemy', 1); e.hexPos = { col: 3, row: 2 }
    const state = createCombatState([u], [e])
    expect(u.manaRefundOnCast).toBe(10)

    castOnce(u, state)
    // Post-cast the mana lock zeroes mana, then Spell Tag refunds 10.
    expect(u.currentMana).toBe(10)
  })
})

describe('Charcoal / Flame Orb — on-hit burn', () => {
  it('Charcoal grants +20 special and Flame Orb +10 atk & +10% attack speed', () => {
    const base = computeStats(makeUnit('oranguru', 'player', 1))
    const char = makeUnit('oranguru', 'player', 1); char.items = ['charcoal']
    const orb  = makeUnit('oranguru', 'player', 1); orb.items = ['flame_orb']
    expect(computeStats(char).special).toBe(base.special + 20)
    const orbStats = computeStats(orb)
    expect(orbStats.attack).toBe(base.attack + 10)
    expect(orbStats.attackSpeed).toBeCloseTo(base.attackSpeed * 1.10, 5)
  })

  it('an auto-attack from a Charcoal holder burns the target (burn + heal cut)', () => {
    const holder = makeUnit('oranguru', 'player', 1); holder.hexPos = { col: 3, row: 5 }; holder.items = ['charcoal']
    const enemy  = makeUnit('dummy', 'enemy', 1); enemy.hexPos = { col: 3, row: 4 }
    const state = createCombatState([holder], [enemy])
    expect(holder.appliesBurnOnHit).toBe(true)
    applyDamage(holder, enemy, { baseAmount: 10, damageType: 'physical', canCrit: false, abilityId: 'auto_attack' }, state)
    expect(enemy.statusEffects.some(fx => fx.id === 'burn')).toBe(true)
    expect(enemy.statusEffects.some(fx => fx.id === 'healBlock')).toBe(true)
  })

  it('an ability hit from a Flame Orb holder also burns the target', () => {
    const holder = makeUnit('oranguru', 'player', 1); holder.hexPos = { col: 3, row: 5 }; holder.items = ['flame_orb']
    const enemy  = makeUnit('dummy', 'enemy', 1); enemy.hexPos = { col: 3, row: 4 }
    const state = createCombatState([holder], [enemy])
    applyDamage(holder, enemy, { baseAmount: 10, damageType: 'magic', canCrit: false, abilityId: 'some_ability' }, state)
    expect(enemy.statusEffects.some(fx => fx.id === 'burn')).toBe(true)
  })
})

describe('Leek / Razor Claw — ability crit', () => {
  it('grant +25% crit chance (Leek +20 special, Razor Claw +20 attack)', () => {
    const base = computeStats(makeUnit('oranguru', 'player', 1))
    const leek = makeUnit('oranguru', 'player', 1); leek.items = ['leek']
    const claw = makeUnit('oranguru', 'player', 1); claw.items = ['razor_claw']
    const ls = computeStats(leek), cs = computeStats(claw)
    expect(ls.critChance).toBeCloseTo(base.critChance + 0.25, 5)
    expect(ls.special).toBe(base.special + 20)
    expect(cs.critChance).toBeCloseTo(base.critChance + 0.25, 5)
    expect(cs.attack).toBe(base.attack + 20)
  })

  it('ability damage crits for a Leek holder, but not without the item', () => {
    function hitAbility(items: string[]): boolean {
      const holder = makeUnit('oranguru', 'player', 1); holder.hexPos = { col: 3, row: 5 }; holder.items = items
      const enemy  = makeUnit('dummy', 'enemy', 1); enemy.hexPos = { col: 3, row: 4 }
      enemy.defense = 0; enemy.spDefense = 0; enemy.maxHp = 1e6; enemy.currentHp = 1e6; enemy._computedStats = null
      const state = createCombatState([holder], [enemy])
      computeStats(holder)   // populate _computedStats so rollCrit sees the item's crit chance
      const orig = Math.random
      Math.random = () => 0   // guaranteed crit roll (0 < critChance)
      try {
        applyDamage(holder, enemy, { baseAmount: 100, damageType: 'magic', canCrit: true, abilityId: 'some_ability' }, state)
      } finally { Math.random = orig }
      const dmg = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
      return dmg?.type === 'damage' ? dmg.isCrit : false
    }
    expect(hitAbility(['leek'])).toBe(true)     // item enables ability crit
    expect(hitAbility([])).toBe(false)          // no item → spells never crit
  })

  it('sets abilitiesCanCrit on the holder at combat start', () => {
    const u = makeUnit('oranguru', 'player', 1); u.hexPos = { col: 3, row: 5 }; u.items = ['razor_claw']
    const e = makeUnit('dummy', 'enemy', 1); e.hexPos = { col: 3, row: 4 }
    createCombatState([u], [e])
    expect(u.abilitiesCanCrit).toBe(true)
  })
})

describe('Covert Cloak — CC immunity + stats', () => {
  it('grants +10 adaptive force (to the higher offensive stat) and +20% move speed', () => {
    const base = computeStats(makeUnit('oranguru', 'player', 1))
    const withItem = makeUnit('oranguru', 'player', 1); withItem.items = ['covert_cloak']
    const s = computeStats(withItem)
    expect(Math.max(s.attack, s.special)).toBe(Math.max(base.attack, base.special) + 10)
    expect(s.moveSpeed).toBeCloseTo(base.moveSpeed * 1.20, 5)
  })

  it('makes the holder immune to crowd control', () => {
    const u = makeUnit('oranguru', 'player', 1); u.hexPos = { col: 3, row: 5 }; u.items = ['covert_cloak']
    const e = makeUnit('dummy', 'enemy', 1); e.hexPos = { col: 3, row: 4 }
    createCombatState([u], [e])
    expect(u.statusEffects.some(fx => fx.id === 'cc_immune')).toBe(true)
    for (const cc of ['stun', 'knockUp', 'charm', 'chill', 'silence']) {
      addStatusEffect(u, { id: cc, sourceUnitId: e.id, durationTicks: 60 })
      expect(u.statusEffects.some(fx => fx.id === cc)).toBe(false)   // blocked
    }
  })
})

describe('Expert Belt / Twisted Spoon — flat % offense', () => {
  it('Expert Belt: +30 Attack and +5% Attack', () => {
    const base = computeStats(makeUnit('oranguru', 'player', 1))
    const u = makeUnit('oranguru', 'player', 1); u.hexPos = { col: 3, row: 5 }; u.items = ['expert_belt']
    const e = makeUnit('dummy', 'enemy', 1); e.hexPos = { col: 3, row: 4 }
    createCombatState([u], [e])   // registers the +5% status
    const flat = base.attack + 30
    expect(computeStats(u).attack).toBe(flat + Math.round(flat * 0.05))
  })

  it('Twisted Spoon: +30 Special and +5% Special', () => {
    const base = computeStats(makeUnit('oranguru', 'player', 1))
    const u = makeUnit('oranguru', 'player', 1); u.hexPos = { col: 3, row: 5 }; u.items = ['twisted_spoon']
    const e = makeUnit('dummy', 'enemy', 1); e.hexPos = { col: 3, row: 4 }
    createCombatState([u], [e])
    const flat = base.special + 30
    expect(computeStats(u).special).toBe(flat + Math.round(flat * 0.05))
  })
})

describe('Focus Band — scales with missing health', () => {
  it('gives +5 each at full HP and +20 each at/below 25% HP', () => {
    const base = computeStats(makeUnit('oranguru', 'player', 1))
    const u = makeUnit('oranguru', 'player', 1); u.hexPos = { col: 3, row: 5 }; u.items = ['focus_band']
    const e = makeUnit('dummy', 'enemy', 1); e.hexPos = { col: 3, row: 4 }
    const state = createCombatState([u], [e])

    u.currentHp = u.maxHp
    tickStatusEffects(state.units, state)
    expect(computeStats(u).attack).toBe(base.attack + 5)
    expect(computeStats(u).defense).toBe(base.defense + 5)

    u.currentHp = Math.floor(u.maxHp * 0.25)
    tickStatusEffects(state.units, state)
    expect(computeStats(u).attack).toBe(base.attack + 20)
    expect(computeStats(u).defense).toBe(base.defense + 20)
    expect(computeStats(u).spDefense).toBe(base.spDefense + 20)
  })
})

describe('Life Orb — ability amp, recoil, adaptive force', () => {
  it('grants +10 adaptive force to the higher offensive stat', () => {
    const base = computeStats(makeUnit('oranguru', 'player', 1))
    const withItem = makeUnit('oranguru', 'player', 1); withItem.items = ['life_orb']
    const s = computeStats(withItem)
    expect(Math.max(s.attack, s.special)).toBe(Math.max(base.attack, base.special) + 10)
  })

  it('amplifies ability damage by 33% (autos unaffected)', () => {
    const holder = makeUnit('oranguru', 'player', 1); holder.hexPos = { col: 3, row: 5 }; holder.items = ['life_orb']
    const enemy  = makeUnit('dummy', 'enemy', 1); enemy.hexPos = { col: 3, row: 4 }
    enemy.spDefense = 0; enemy.maxHp = 1e6; enemy.currentHp = 1e6; enemy._computedStats = null
    const state = createCombatState([holder], [enemy])
    expect(holder.abilityDamageMult).toBeCloseTo(1.33, 5)
    applyDamage(holder, enemy, { baseAmount: 100, damageType: 'magic', canCrit: false, abilityId: 'some_ability' }, state)
    const dmg = state.events.find(e => e.type === 'damage' && e.targetId === enemy.id)
    if (dmg?.type === 'damage') expect(dmg.amount).toBe(133)
  })

  it('each cast costs 10% of max HP (never lethal)', () => {
    const u = makeUnit('oranguru', 'player', 1); u.hexPos = { col: 3, row: 5 }; u.items = ['life_orb']
    const e = makeUnit('dummy', 'enemy', 1); e.hexPos = { col: 3, row: 2 }
    const state = createCombatState([u], [e])
    u.currentHp = u.maxHp
    const before = u.currentHp
    castOnce(u, state)
    expect(u.currentHp).toBe(before - Math.round(u.maxHp * 0.10))
  })
})
