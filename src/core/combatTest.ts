import { makeUnit } from './unitFactory'
import { createCombatState, runCombat } from './combatEngine'

const player = makeUnit('tangela', 'player', 1)
player.hexPos = { col: 0, row: 3 }

const enemy = makeUnit('vigoroth', 'enemy', 1)
enemy.hexPos = { col: 6, row: 0 }

const state = createCombatState([player], [enemy])
const result = runCombat(state, { maxTicks: 1800, verbose: true })

console.log(`\n--- RESULT ---`)
console.log(`Winner: ${result.winner}`)
console.log(`Duration: ${result.ticksElapsed} ticks (${(result.ticksElapsed / 60).toFixed(1)}s)`)
console.log(`Tangela final HP: ${result.finalState.units.get(player.id)?.currentHp ?? 'dead'}`)
console.log(`Vigoroth final HP: ${result.finalState.units.get(enemy.id)?.currentHp ?? 'dead'}`)
console.log(`Tangela final mana: ${result.finalState.units.get(player.id)?.currentMana ?? '?'}`)
console.log(`Vigoroth final mana: ${result.finalState.units.get(enemy.id)?.currentMana ?? '?'}`)
