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
  XP_BUY_COST, XP_BUY_AMOUNT, XP_PER_ROUND, POOL_COPIES,
  BASE_INCOME_BY_ROUND, BASE_INCOME_CAP, SHINY_PRICE_MULT, SHINY_TIER,
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

// Pool copy counts, cost 1 through 5, in cost order — read straight out of
// POOL_COPIES rather than re-typing the table.
const POOL_COPIES_BY_COST = [1, 2, 3, 4, 5].map(cost => `${POOL_COPIES[cost]} of each ${cost}-cost`).join(', ')

const CREEP_ROUND_NAMES = Object.values(CREEP_ROUNDS).map(r => r.name).join(' then ')

const RULES_TAB: HelpTab = {
  id: 'rules',
  label: 'Rules',
  sections: [
    {
      heading: 'The Basics',
      body: [
        `${PLAYER_COUNT} seats in every lobby — you plus 5 AI bots.`,
        `Everyone draws from one shared unit pool (${POOL_COPIES_BY_COST}), so a contested unit can genuinely run out.`,
        `You start at ${STARTING_HP} health, ${STARTING_GOLD} gold, level ${STARTING_LEVEL}.`,
        'Last player standing wins.',
      ],
    },
    {
      heading: 'The Round Loop',
      body: [
        'Each round is a planning phase (shop, place, rearrange) on a countdown, then an auto-resolved fight.',
        `Rounds 1-${CREEP_ROUND_COUNT} are PvE creep rounds (${CREEP_ROUND_NAMES}) before any player-vs-player combat.`,
        `Rounds ${FIRST_ITEM_ROUNDS.join(', ')} are item rounds — no combat, pick one of three offered items instead.`,
        'After the creep rounds you are paired against a bot opponent each round.',
      ],
    },
    {
      heading: 'Gold and Income',
      body: [
        `Base income ramps ${BASE_INCOME_BY_ROUND.join(' → ')} gold over the first rounds, capped at ${BASE_INCOME_CAP} after that.`,
        `Interest pays 1 gold per 10 banked, up to ${MAX_INTEREST} gold.`,
        `Winning a round pays ${WIN_BONUS} bonus gold, and win/loss streaks pay extra on top.`,
      ],
    },
    {
      heading: 'Levelling',
      body: [
        `You gain ${XP_PER_ROUND} free XP every round; buying XP costs ${XP_BUY_COST} gold for ${XP_BUY_AMOUNT} XP.`,
        `Levels cap at ${MAX_LEVEL}.`,
        'Your level is your board slot cap, and it also shifts the shop odds toward higher-cost units.',
      ],
    },
    {
      heading: 'Shop, Bench and Star-ups',
      body: [
        `The shop offers ${SHOP_SLOTS} cards, refreshed each round; rerolling costs ${REROLL_COST} gold.`,
        `The bench holds ${BENCH_SLOTS} units.`,
        'Three copies of a unit combine into a 2-star; three 2-stars combine into a 3-star.',
        `A rare shiny variant costs ${SHINY_PRICE_MULT}x, arrives as a ${SHINY_TIER}-star, and carries a chosen trait.`,
      ],
    },
    {
      heading: 'Traits',
      body: [
        'Fielding units that share a trait activates that trait at its breakpoints.',
        'The badges beside the board show which traits are live and at what tier.',
      ],
    },
    {
      heading: 'Combat and Damage',
      body: [
        'Combat is fully automatic once the fight starts: units path across the hex board, auto-attack, build mana, and cast at full mana.',
        'Losing a round costs health scaled by the current stage plus the star level of every enemy unit still alive.',
        'Reaching 0 health eliminates you.',
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
        'Click a shop card to buy that unit onto your bench.',
        `Reroll ↻ (d) rerolls the shop for ${REROLL_COST} gold.`,
        `Buy XP (f) buys ${XP_BUY_AMOUNT} XP for ${XP_BUY_COST} gold.`,
        'The 🔒 button locks the shop so it survives into the next round.',
      ],
    },
    {
      heading: 'Moving Units',
      body: [
        'Click a unit on the bench or the board to pick it up — it rides the cursor.',
        'Click a board hex or a bench slot to put it down.',
        'This is click-carry, not drag-and-drop.',
        'Your board cap is your level.',
      ],
    },
    {
      heading: 'Selling',
      body: [
        'While carrying a unit, the shop bar becomes a sell target — click it to sell.',
        'Or hover a unit on the bench or board and press e to sell it.',
      ],
    },
    {
      heading: 'Items',
      body: [
        'The Items panel sits bottom-left; click an item to pick it up, then click a unit to equip it.',
        'Hover a unit holding an item and press r to pull the item back off — it returns to the Items bench, not to your cursor.',
        'The ▲▼ pager moves between item pages.',
      ],
    },
    {
      heading: 'Inspecting',
      body: [
        'Hovering a unit shows its card.',
        'A unit info panel appears during combat when a unit is selected.',
      ],
    },
    {
      heading: 'Test Mode',
      body: [
        'Pick a unit and a star level in the left sidebar, then click a hex to place it.',
        'The top rows are the enemy team; the bottom rows are yours. Right-click removes a unit.',
        'The floating Combat panel runs the fight: start, pause, stop, reset, and speed buttons.',
        '← Back to Menu in the sidebar returns to the Title Screen.',
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
