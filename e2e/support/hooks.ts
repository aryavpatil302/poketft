import { Before, After, Status } from '@cucumber/cucumber'
import { Builder } from 'selenium-webdriver'
import { Options } from 'selenium-webdriver/chrome.js'
import type { PokeTFTWorld } from './world.js'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import * as process from 'process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const chromedriverExe = resolve(__dirname, '../../node_modules/chromedriver/lib/chromedriver/chromedriver.exe')
// selenium-webdriver reads this env var to locate chromedriver
process.env['webdriver.chrome.driver'] = chromedriverExe
process.env.PATH = `${resolve(__dirname, '../../node_modules/chromedriver/lib/chromedriver')};${process.env.PATH ?? ''}`

Before({ timeout: 60_000 }, async function (this: PokeTFTWorld) {
  const opts = new Options()
  opts.setChromeBinaryPath('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  opts.addArguments(
    '--window-size=1400,900',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--log-level=0',
    '--enable-logging',
    '--enable-automation',
  )

  this.driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(opts)
    .build()

  this.jsErrors = []

  // Open the app
  await this.driver.get('http://localhost:5173')
  // Wait for the unit roster to appear (app is ready)
  const { until, By } = await import('selenium-webdriver')
  await this.driver.wait(until.elementLocated(By.id('unit-roster')), 15_000)
  await this.driver.sleep(500)
})

After(async function (this: PokeTFTWorld, scenario) {
  if (this.driver) {
    if (scenario.result?.status === Status.FAILED) {
      try {
        await this.takeScreenshot(`FAILED_${scenario.pickle.name.replace(/\W+/g, '_')}`)
      } catch {
        // Screenshot failed — driver may be in a bad state
      }
    }
    await this.driver.quit()
  }
})
