// The "Rules and Controls" reference modal, opened from the Title Screen's
// third button. Unlike titleScreen.ts / lobbyScreen.ts, this module is a
// modal OVER a screen, not a screen itself: opening it never hides the Title
// Screen, and no game boots from anything in here.
//
// Split the way src/ui/fullscreen.ts splits: a pure, node-testable data
// layer (HELP_TABS / helpTab) with zero `document` reference, plus a thin DOM
// layer that only showHelpModal()/hideHelpModal()/renderBody() touch. That
// split is what keeps helpModal.test.ts importable in vitest's `node`
// environment (see vite.config.ts — there is no jsdom).

import {
  SCREEN_YELLOW, SCREEN_OUTLINE_BLUE, SCREEN_BUTTON_BLUE, SCREEN_FADE_MS,
  wireButtonFeedback, fadeScreenIn, fadeScreenOut,
} from './screenChrome'
import { escapeHtml } from './escapeHtml'
import {
  PLAYER_COUNT, STARTING_HP, STARTING_GOLD, STARTING_LEVEL, MAX_LEVEL,
  MAX_INTEREST, WIN_BONUS, SHOP_SLOTS, BENCH_SLOTS, REROLL_COST,
  XP_BUY_COST, XP_BUY_AMOUNT, XP_PER_ROUND, SHINY_PRICE_MULT, SHINY_TIER,
} from '../econ/constants'
import { CREEP_ROUND_COUNT, CREEP_ROUNDS, isItemRound } from '../econ/creeps'

// ─── Data layer (pure — no `document` anywhere near this section) ────────────

export type HelpTabId = 'rules' | 'controls'

export interface HelpSection {
  heading: string
  body: readonly string[]
}

export interface HelpTab {
  id: HelpTabId
  label: string
  sections: readonly HelpSection[]
}

// First item round after the creep opener: isItemRound() is true for
// round 3, then every 6 rounds after — pull it from source rather than
// hand-typing "3, 9, 15, 21" so this stays correct if the cadence changes.
const FIRST_ITEM_ROUNDS = [3, 9, 15, 21].filter(isItemRound)

const CREEP_ROUND_NAMES = Object.values(CREEP_ROUNDS).map(r => r.name).join(' then ')

const RULES_TAB: HelpTab = {
  id: 'rules',
  label: 'Rules',
  sections: [
    {
      heading: "What's an Autobattler?",
      body: [
        'Ah, hello there! This game is what folks call an autobattler, a different kind of Pokemon battle.',
        'Once a round starts, your Pokemon fight entirely on their own. No commands, no button mashing, just watching your plan play out.',
        'Your real work happens beforehand: scouting Pokemon, setting your formation, and deciding how to spend your gold.',
      ],
    },
    {
      heading: 'The Basics',
      body: [
        `${PLAYER_COUNT} trainers share every lobby, you and 5 AI opponents.`,
        `You begin with ${STARTING_HP} health, ${STARTING_GOLD} gold, and start at level ${STARTING_LEVEL}.`,
        "Every trainer draws from the same shared pool of Pokemon. What you want might already be someone else's pick.",
        'Whoever is the last trainer standing wins the day.',
      ],
    },
    {
      heading: 'Rounds and Battles',
      body: [
        'Each round opens with a short planning phase for shopping and placing your team, then the battle plays out by itself.',
        `Your first ${CREEP_ROUND_COUNT} rounds pit you against wild Pokemon (${CREEP_ROUND_NAMES}) so you can find your footing before facing other trainers.`,
        "After that, you're matched against a different opponent's board each round.",
        `Rounds ${FIRST_ITEM_ROUNDS.join(', ')} pause the fighting entirely, letting you pick a free item instead.`,
      ],
    },
    {
      heading: 'Gold and Leveling',
      body: [
        `Winning a round pays out ${WIN_BONUS} bonus gold, and holding a win or loss streak pays extra on top.`,
        `Banked gold earns interest too, up to ${MAX_INTEREST} gold a round.`,
        `Spend gold on experience to level up: ${XP_BUY_COST} gold buys ${XP_BUY_AMOUNT} XP, and you gain ${XP_PER_ROUND} more for free each round, up to level ${MAX_LEVEL}.`,
        'The higher your level, the more Pokemon you can field, and the better your chances of seeing rarer ones in the shop.',
      ],
    },
    {
      heading: 'Shop and Team Building',
      body: [
        `${SHOP_SLOTS} Pokemon appear in your shop each round. Don't like what you see? Reroll for ${REROLL_COST} gold.`,
        `Your bench holds up to ${BENCH_SLOTS} Pokemon waiting for their turn on the field.`,
        'Collect three of the same Pokemon and they evolve into a stronger 2 star. Three 2 stars make a 3 star.',
      ],
    },
    {
      heading: 'Traits',
      body: [
        'Every Pokemon carries one or more traits, tying it to others of its kind.',
        'Field enough Pokemon sharing a trait and that trait switches on, granting your whole team a bonus. Field even more and it grows stronger still.',
        "Watch the badges beside your board. They'll show you exactly which traits are active and how close you are to the next tier.",
      ],
    },
    {
      heading: 'Shiny Pokemon',
      body: [
        'Every so often a shiny Pokemon turns up in your shop, a rare and sparkling variant.',
        `Shinies cost ${SHINY_PRICE_MULT} times as much, but they arrive already at ${SHINY_TIER} stars and hit a little harder across the board.`,
        'Each shiny also brings a trait of its own choosing, and a special trick in battle all its own.',
      ],
    },
    {
      heading: 'Combat',
      body: [
        'Once the fight begins, your Pokemon take it from here. They cross the field, trade blows, and unleash their move the moment their energy is full.',
        "Lose a fight and you take damage based on the stage and how many of the rival's Pokemon are left standing.",
        "Run out of health, and you're out of the running.",
      ],
    },
  ],
}

const CONTROLS_TAB: HelpTab = {
  id: 'controls',
  label: 'Controls',
  sections: [
    {
      heading: 'Shop & Gold',
      body: [
        'Click a shop card to buy that Pokemon onto your bench.',
        `Reroll (d) rerolls the shop for ${REROLL_COST} gold.`,
        `Buy XP (f) buys ${XP_BUY_AMOUNT} XP for ${XP_BUY_COST} gold.`,
        'The 🔒 button keeps your shop the same into the next round.',
      ],
    },
    {
      heading: 'Moving Units',
      body: [
        'Click a Pokemon on your bench or board to pick it up. It rides your cursor until you set it down.',
        'Click a hex on the board or an open bench slot to put it down.',
        'This is click and carry, not drag and drop.',
        'Your board space is capped by your level.',
      ],
    },
    {
      heading: 'Selling',
      body: [
        "While you're carrying a Pokemon, the shop bar turns into a sell target. Click it to sell.",
        'Or hover a Pokemon on your bench or board and press e to sell it.',
      ],
    },
    {
      heading: 'Items',
      body: [
        'The Items panel sits at the bottom left. Click an item to pick it up, then click a Pokemon to equip it.',
        'Hover a Pokemon holding an item and press r to pull it back off. It returns to the Items bench, not your cursor.',
        'Use the ▲▼ arrows to page through more items.',
      ],
    },
    {
      heading: 'Inspecting',
      body: [
        'Hover any Pokemon to see its card.',
        'During battle, selecting a Pokemon opens its info panel.',
      ],
    },
    {
      heading: 'Test Mode',
      body: [
        'Pick a Pokemon and a star level from the sidebar, then click a hex to place it.',
        'The top rows belong to the enemy team, the bottom rows are yours. Right click removes a Pokemon.',
        'The floating Combat panel runs the fight: start, pause, stop, reset, and speed controls.',
        '← Back to Menu in the sidebar returns you to the Title Screen.',
      ],
    },
  ],
}

export const HELP_TABS: readonly HelpTab[] = [RULES_TAB, CONTROLS_TAB]

export function helpTab(id: HelpTabId): HelpTab {
  const tab = HELP_TABS.find(t => t.id === id)
  if (!tab) throw new Error(`helpTab: unknown tab id ${id as string}`)
  return tab
}

// ─── DOM layer ────────────────────────────────────────────────────────────────

// Sits between the Title/Lobby screens (SCREEN_Z_INDEX = 500, so this covers
// them) and the 9999 network-status banner in src/main.ts, which must stay
// readable on top of everything, including this modal.
const HELP_Z_INDEX = 600

let rootEl: HTMLDivElement | null = null

function renderBody(tabId: HelpTabId): void {
  const root = rootEl
  if (root === null) return

  const body = root.querySelector<HTMLElement>('#help-body')
  if (body !== null) {
    const tab = helpTab(tabId)
    body.innerHTML = tab.sections.map(section => `
      <div style="margin-bottom:16px;">
        <div style="color:${SCREEN_YELLOW};font-weight:900;font-size:14px;margin-bottom:4px;">${escapeHtml(section.heading)}</div>
        ${section.body.map(line => `<div style="font-size:12px;line-height:1.5;color:#cce;">${escapeHtml(line)}</div>`).join('')}
      </div>
    `).join('')
    // Reset scroll on every tab switch so the new tab starts at the top
    // instead of inheriting the previous tab's scroll offset.
    body.scrollTop = 0
  }

  for (const tab of HELP_TABS) {
    const btn = root.querySelector<HTMLButtonElement>(`#help-tab-${tab.id}`)
    if (btn === null) continue
    const active = tab.id === tabId
    btn.style.background = active ? SCREEN_BUTTON_BLUE : 'transparent'
    btn.style.color = active ? SCREEN_YELLOW : '#8899bb'
  }
}

function tabButtonCss(): string {
  return [
    'border: none',
    'border-radius: 8px',
    'padding: 8px 16px',
    'font-family: sans-serif',
    'font-weight: 700',
    'font-size: 12px',
    'letter-spacing: 0.04em',
    'cursor: pointer',
    'transition: background 0.15s ease, color 0.15s ease',
  ].join('; ')
}

// Attached to document.body, never to #app — same reasoning titleScreen.ts's
// header comment gives: renderEconUI() / updateEconVisibility() rebuild
// subtrees inside #app wholesale.
function ensureRoot(): HTMLDivElement {
  if (rootEl !== null) return rootEl
  const el = document.createElement('div')
  el.id = 'help-modal'
  el.style.cssText = [
    'position: fixed',
    'inset: 0',
    `z-index: ${HELP_Z_INDEX}`,
    'background: rgba(4,8,18,0.72)',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'opacity: 0',
    `transition: opacity ${SCREEN_FADE_MS / 1000}s ease`,
  ].join('; ')
  el.innerHTML = `
    <div id="help-panel" style="
      width: min(760px, 92vw);
      background: #0a0e1a;
      border: 2px solid ${SCREEN_OUTLINE_BLUE};
      border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.6);
      font-family: sans-serif;
      display: flex;
      flex-direction: column;
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px 0;">
        <div style="color:${SCREEN_YELLOW};font-weight:900;font-size:18px;letter-spacing:0.04em;">Rules and Controls</div>
        <button id="btn-help-close" type="button" style="
          background: transparent; border: none; color: #8899bb;
          font-size: 20px; cursor: pointer; line-height: 1; padding: 4px 8px;
        ">✕</button>
      </div>
      <div style="display:flex;gap:8px;padding:12px 20px 0;">
        <button id="help-tab-rules" type="button" style="${tabButtonCss()}">Rules</button>
        <button id="help-tab-controls" type="button" style="${tabButtonCss()}">Controls</button>
      </div>
      <div id="help-body" style="
        max-height: 62vh;
        overflow-y: auto;
        padding: 16px 20px 20px;
      "></div>
    </div>
  `
  document.body.appendChild(el)

  // No per-show callbacks on this module (unlike titleScreen.ts's handlers
  // object), so there is no stale closure to avoid — these listeners are
  // wired once, here, for the life of the page.
  const closeBtn = el.querySelector<HTMLButtonElement>('#btn-help-close')
  if (closeBtn !== null) {
    wireButtonFeedback(closeBtn)
    closeBtn.addEventListener('click', hideHelpModal)
  }
  const rulesBtn = el.querySelector<HTMLButtonElement>('#help-tab-rules')
  const controlsBtn = el.querySelector<HTMLButtonElement>('#help-tab-controls')
  rulesBtn?.addEventListener('click', () => renderBody('rules'))
  controlsBtn?.addEventListener('click', () => renderBody('controls'))

  // Backdrop click closes, but only when the click lands on the backdrop
  // itself — a click inside the panel must never close the modal.
  el.addEventListener('click', (e) => {
    if (e.target === el) hideHelpModal()
  })

  document.addEventListener('keydown', (e) => {
    if (!isHelpModalOpen()) return
    if (e.key === 'Escape') hideHelpModal()
  })

  rootEl = el
  return el
}

export function showHelpModal(): void {
  const root = ensureRoot()
  renderBody('rules')
  fadeScreenIn(root)
}

export function hideHelpModal(): void {
  if (rootEl === null) return
  fadeScreenOut(rootEl)
}

export function isHelpModalOpen(): boolean {
  return rootEl !== null && rootEl.style.display !== 'none' && rootEl.style.opacity !== '0'
}
