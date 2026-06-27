import { setWorldConstructor, World, IWorldOptions } from '@cucumber/cucumber'
import { Builder, WebDriver, By, until, WebElement } from 'selenium-webdriver'
import { Options } from 'selenium-webdriver/chrome.js'
import * as path from 'path'
import * as fs from 'fs'

// ─── Hex geometry (mirrors src/core/hexGrid.ts + src/core/constants.ts) ───────
const HEX_SIZE   = 48
const HORIZ      = Math.sqrt(3) * HEX_SIZE     // ≈ 83.14 px
const VERT       = HEX_SIZE * 1.5              // 72 px
const BOARD_W    = (7 + 0.5) * HORIZ           // ≈ 623.5 px
const BOARD_H    = (8 - 1) * VERT + 2 * HEX_SIZE  // 600 px

/** Returns the pixel center of a hex (relative to canvas top-left). */
export function hexPixel(col: number, row: number): { x: number; y: number } {
  return {
    x: col * HORIZ + (row % 2 === 1 ? HORIZ / 2 : 0) + HORIZ / 2,
    y: row * VERT + HEX_SIZE,
  }
}

/** Offset from the canvas element's CENTER (for Selenium Actions). */
export function hexOffset(col: number, row: number): { dx: number; dy: number } {
  const { x, y } = hexPixel(col, row)
  return {
    dx: Math.round(x - BOARD_W / 2),
    dy: Math.round(y - BOARD_H / 2),
  }
}

// ─── App URL ──────────────────────────────────────────────────────────────────
export const APP_URL = 'http://localhost:5173'

// ─── Screenshot dir ───────────────────────────────────────────────────────────
const SCREENSHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots')
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

// ─── World ───────────────────────────────────────────────────────────────────

export interface PokeTFTWorld {
  driver: WebDriver
  jsErrors: string[]
  clickHex(col: number, row: number): Promise<void>
  selectUnit(unitId: string, tier: 1 | 2 | 3): Promise<void>
  selectDummy(tier: 1 | 2 | 3): Promise<void>
  enableTestMode(): Promise<void>
  startCombat(): Promise<void>
  waitForTicks(targetTicks: number, timeoutMs?: number): Promise<void>
  takeScreenshot(name: string): Promise<void>
  getConsoleErrors(): Promise<string[]>
}

class PokeTFTWorldImpl extends World implements PokeTFTWorld {
  driver!: WebDriver
  jsErrors: string[] = []

  constructor(options: IWorldOptions) {
    super(options)
  }

  // ─── Low-level: click on a canvas hex ────────────────────────────────────

  async clickHex(col: number, row: number): Promise<void> {
    const canvas = await this.driver.findElement(By.id('c-effects'))
    const { dx, dy } = hexOffset(col, row)
    await this.driver.actions()
      .move({ origin: canvas, x: dx, y: dy })
      .click()
      .perform()
    await this.driver.sleep(100)
  }

  // ─── Select a unit from the roster ───────────────────────────────────────

  async selectUnit(unitId: string, tier: 1 | 2 | 3): Promise<void> {
    // Click the unit button
    const unitBtn = await this.driver.findElement(By.css(`[data-uid="${unitId}"]`))
    await unitBtn.click()
    await this.driver.sleep(200)
    // Click the tier button
    const tierBtns = await this.driver.findElements(By.css('[data-tier]'))
    for (const btn of tierBtns) {
      const t = await btn.getAttribute('data-tier')
      if (t === String(tier)) { await btn.click(); break }
    }
    await this.driver.sleep(100)
  }

  // ─── Select a dummy target ────────────────────────────────────────────────

  async selectDummy(tier: 1 | 2 | 3): Promise<void> {
    const btn = await this.driver.findElement(By.css(`[data-dummy-tier="${tier}"]`))
    await btn.click()
    await this.driver.sleep(100)
  }

  // ─── Enable test mode ─────────────────────────────────────────────────────

  async enableTestMode(): Promise<void> {
    const chk = await this.driver.findElement(By.id('chk-test-mode'))
    const checked = await chk.isSelected()
    if (!checked) await chk.click()
    await this.driver.sleep(100)
  }

  // ─── Start combat ─────────────────────────────────────────────────────────

  async startCombat(): Promise<void> {
    await this.driver.findElement(By.id('btn-start')).click()
    await this.driver.sleep(300)
  }

  // ─── Wait for combat ticks to reach a target value ────────────────────────

  async waitForTicks(targetTicks: number, timeoutMs = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const infoText = await this.driver.findElement(By.id('combat-info')).getText()
      const match = infoText.match(/Tick:\s*(\d+)/)
      if (match && parseInt(match[1]) >= targetTicks) return
      await this.driver.sleep(200)
    }
    // Don't throw — combat may have ended (result shown instead of tick info)
  }

  // ─── Screenshot ───────────────────────────────────────────────────────────

  async takeScreenshot(name: string): Promise<void> {
    const png = await this.driver.takeScreenshot()
    const filePath = path.join(SCREENSHOT_DIR, `${name}.png`)
    fs.writeFileSync(filePath, Buffer.from(png, 'base64'))
  }

  // ─── Console error harvesting ─────────────────────────────────────────────

  async getConsoleErrors(): Promise<string[]> {
    try {
      const logs = await this.driver.manage().logs().get('browser')
      return logs
        .filter(l => l.level.name === 'SEVERE')
        .map(l => l.message)
    } catch {
      return []  // some Chrome configs don't expose logs
    }
  }
}

setWorldConstructor(PokeTFTWorldImpl)
