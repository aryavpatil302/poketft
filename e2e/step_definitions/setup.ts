import { Given, When, Then } from '@cucumber/cucumber'
import { By, until } from 'selenium-webdriver'
import type { PokeTFTWorld } from '../support/world.js'

// ─── Setup steps ──────────────────────────────────────────────────────────────

Given('the battle simulator is open in test mode', async function (this: PokeTFTWorld) {
  await this.enableTestMode()
})

Given(
  '{word} is placed as player at col {int} row {int} at tier {int}',
  async function (this: PokeTFTWorld, unitId: string, col: number, row: number, tier: number) {
    await this.selectUnit(unitId, tier as 1 | 2 | 3)
    await this.clickHex(col, row)
  },
)

Given(
  'a {word} dummy is placed at col {int} row {int}',
  async function (this: PokeTFTWorld, dummyLevel: string, col: number, row: number) {
    const tierMap: Record<string, 1 | 2 | 3> = { low: 1, mid: 2, high: 3, medium: 2 }
    const tier = tierMap[dummyLevel.toLowerCase()] ?? 1
    await this.selectDummy(tier)
    await this.clickHex(col, row)
  },
)

Given(
  'a {word} attacker is placed at col {int} row {int}',
  async function (this: PokeTFTWorld, attackerType: string, col: number, row: number) {
    const idMap: Record<string, string> = { melee: 'dummy_melee', ranged: 'dummy_ranged' }
    const unitId = idMap[attackerType.toLowerCase()] ?? 'dummy_melee'
    await this.selectUnit(unitId, 1)
    await this.clickHex(col, row)
  },
)

// ─── Combat steps ─────────────────────────────────────────────────────────────

When('I start combat and wait {int} seconds', { timeout: 120_000 }, async function (this: PokeTFTWorld, seconds: number) {
  await this.startCombat()
  await this.waitForTicks(seconds * 60, (seconds + 10) * 1000)
})

When('combat starts', async function (this: PokeTFTWorld) {
  await this.startCombat()
})

When('I wait {int} seconds', { timeout: 120_000 }, async function (this: PokeTFTWorld, seconds: number) {
  await this.driver.sleep(seconds * 1000)
})

When('I weaken the enemy at col {int} row {int} to {int} hp', async function (this: PokeTFTWorld, col: number, row: number, hp: number) {
  await this.driver.executeScript(`window.__pokeTFT?.weakenUnit(${col}, ${row}, ${hp})`)
})

// ─── Assertion steps ──────────────────────────────────────────────────────────

Then('combat should have run without JavaScript errors', async function (this: PokeTFTWorld) {
  const errors = await this.getConsoleErrors()
  const critical = errors.filter(e => !e.includes('favicon'))
  if (critical.length > 0) {
    throw new Error(`JavaScript errors in browser:\n${critical.join('\n')}`)
  }
})

Then(
  'a screenshot is taken named {string}',
  async function (this: PokeTFTWorld, name: string) {
    await this.takeScreenshot(name)
  },
)

Then('the player team should win', async function (this: PokeTFTWorld) {
  // Wait a bit for result box to appear
  await this.driver.sleep(2000)
  const resultBox = await this.driver.findElement(By.id('result-box'))
  const text = await resultBox.getText()
  if (!text.toLowerCase().includes('your team wins')) {
    throw new Error(`Expected player to win but result was: "${text}"`)
  }
})

Then('combat should still be running', async function (this: PokeTFTWorld) {
  const infoEl = await this.driver.findElement(By.id('combat-info'))
  const text = await infoEl.getText()
  if (!text.includes('Tick:')) {
    throw new Error(`Expected combat to be running but info shows: "${text}"`)
  }
  const match = text.match(/Tick:\s*(\d+)/)
  const ticks = match ? parseInt(match[1]) : 0
  if (ticks === 0) throw new Error('Combat did not advance any ticks')
})

Then('the combat info should show at least {int} ticks', async function (this: PokeTFTWorld, minTicks: number) {
  const infoEl = await this.driver.findElement(By.id('combat-info'))
  const text = await infoEl.getText()
  const match = text.match(/Tick:\s*(\d+)/)
  const ticks = match ? parseInt(match[1]) : 0
  if (ticks < minTicks) {
    throw new Error(`Expected at least ${minTicks} ticks but got ${ticks}`)
  }
})
