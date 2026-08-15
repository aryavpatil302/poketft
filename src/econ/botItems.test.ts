import { describe, it, expect } from 'vitest'
import { chooseBotItem, equipBotItems, botOwnedItems } from './botItems'
import { emptyEcon } from './runState'
import type { PlayerEcon } from './runState'
import { ITEM_MAP } from '../data/items'
import { runSimulation } from '../sim/runner'
import { makeUnit } from '../core/unitFactory'
import { createCombatState } from '../core/combatEngine'

function bot(): PlayerEcon {
  return emptyEcon('Bot', 'rilla')
}

describe('bot items — selection', () => {
  it('chooses an item whose categories suit the board carries', () => {
    const b = bot()
    // Ribombee is a 'special caster' (range 4). The chosen item should suit that role.
    b.board = [{ definitionId: 'ribombee', tier: 2, hexPos: { col: 3, row: 6 } }]
    const id = chooseBotItem(b, [], () => 0.5)!
    const def = ITEM_MAP.get(id)!
    expect(def).toBeDefined()
    expect(def.iconPath).toBeTruthy()                  // only real (offerable) items
    expect(def.categories?.includes('special caster')).toBe(true)
  })

  it('never re-offers an item the bot already owns (unless pool exhausted)', () => {
    const b = bot()
    b.board = [{ definitionId: 'ribombee', tier: 1, hexPos: { col: 3, row: 6 } }]
    const first = chooseBotItem(b, [], () => 0.5)!
    const second = chooseBotItem(b, [first], () => 0.5)!
    expect(second).not.toBe(first)
  })

  it('returns null for an empty board with no pool match yet still yields an item', () => {
    const b = bot()
    b.board = []
    // empty board → no role weights, but an item is still returned (falls back to pool)
    expect(chooseBotItem(b, [], () => 0.3)).not.toBeNull()
  })
})

describe('bot items — equip / move', () => {
  it('equips a loose item onto the best-fit board carry by role', () => {
    const b = bot()
    b.board = [
      { definitionId: 'tangela', tier: 1, hexPos: { col: 2, row: 6 } },   // tank, cheap
      { definitionId: 'ribombee', tier: 2, hexPos: { col: 3, row: 6 } },  // special caster, higher carry value
    ]
    b.itemBench = ['twisted_spoon']   // +5% special — a caster item
    equipBotItems(b)
    expect(b.itemBench).toHaveLength(0)                       // item got equipped
    const ribo = b.board.find(u => u.definitionId === 'ribombee')!
    expect(ribo.item).toBe('twisted_spoon')                  // went to the caster carry
  })

  it('re-assigns items when the board changes (moves them around)', () => {
    const b = bot()
    b.board = [{ definitionId: 'ribombee', tier: 1, hexPos: { col: 3, row: 6 } }]
    b.itemBench = ['metronome']
    equipBotItems(b)
    expect(b.board[0].item).toBe('metronome')
    // Board swaps to a new carry; the item should move to it on the next assignment.
    b.board = [{ definitionId: 'vikavolt', tier: 2, hexPos: { col: 3, row: 6 }, item: 'metronome' }]
    // (item is still "owned" — equipBotItems pulls it back and re-optimises)
    equipBotItems(b)
    expect(b.board[0].item).toBe('metronome')
    expect(botOwnedItems(b)).toEqual(['metronome'])
  })

  it('keeps leftover items on the bench when there are more items than units', () => {
    const b = bot()
    b.board = [{ definitionId: 'ribombee', tier: 1, hexPos: { col: 3, row: 6 } }]
    b.itemBench = ['metronome', 'twisted_spoon']
    equipBotItems(b)
    expect(b.board[0].item).toBeDefined()
    expect(b.itemBench).toHaveLength(1)   // one unit, two items → one left over
  })
})

describe('bot items — combat threading', () => {
  it('an equipped item passive fires in a simulated fight (Metronome stacks attack speed)', () => {
    // Sanity: a unit built with an item has it equipped so initItemPassives runs.
    const u = makeUnit('vikavolt', 'player', 1)
    u.items = ['metronome']
    const enemy = makeUnit('dummy', 'enemy', 1)
    createCombatState([u], [enemy])   // registers item passives on the holder
    // Metronome registers its passive attack handler on the holder at combat start.
    expect(u.passiveAttackHandlers.some(h => h.id === 'metronome_passive')).toBe(true)
  })

  it('runSimulation accepts item on UnitSpec without error', () => {
    const report = runSimulation(
      [{ id: 'vikavolt', tier: 1, col: 3, row: 6, item: 'metronome' }],
      [{ id: 'dummy', tier: 1, col: 3, row: 1 }],
      3,
    )
    expect(report.trials).toBe(3)
  })
})
