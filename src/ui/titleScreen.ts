// The Title Screen (04-UI-SPEC.md §Screens 1) — the first thing the app shows
// when the URL carries no `?lobby=` code.
//
// DOM only. No game logic, no networking, no imports that reach either: this
// module renders five buttons and calls back. src/main.ts owns what those
// callbacks mean, which is what keeps the solo boot path and the lobby boot
// path both readable in one place instead of leaking into the view.

import {
  screenRootCss, screenHeaderHtml, wireLogoFallback,
  screenButtonCss, wireButtonFeedback, fadeScreenIn, fadeScreenOut,
} from './screenChrome'

export interface TitleScreenHandlers {
  onSolo: () => void
  onMultiplayer: () => void
  onHelp: () => void
  onTestMode: () => void
  onOverview: () => void
  onBlog: () => void
  // Temporary kill switch (src/main.ts owns the actual flag) — greys the
  // button out and relabels it instead of wiring a click that would reach a
  // known-broken flow. Optional so every existing caller keeps compiling;
  // undefined reads the same as false.
  multiplayerDisabled?: boolean
}

// ─── Overlay element ──────────────────────────────────────────────────────────

let rootEl: HTMLDivElement | null = null

// Attached to document.body, never to #app. renderEconUI() and
// updateEconVisibility() rebuild subtrees inside #app wholesale, and a screen
// living in there would be silently torn out by the first re-render — the
// same reasoning src/main.ts's network banner already carries.
function ensureRoot(): HTMLDivElement {
  if (rootEl !== null) return rootEl
  const el = document.createElement('div')
  el.id = 'title-screen'
  el.style.cssText = screenRootCss()
  el.innerHTML = `
    ${screenHeaderHtml('title-screen')}

    <div style="
      display: flex;
      flex-direction: column;
      gap: 18px 22px;
      width: min(680px, 84vw);
    ">
      <div style="
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-template-rows: repeat(2, auto);
        gap: 18px 22px;
      ">
        <button id="btn-title-solo" type="button" style="${screenButtonCss()}">Start Solo Game</button>
        <button id="btn-title-multiplayer" type="button" style="${screenButtonCss()}">Start Multiplayer Game</button>
        <button id="btn-title-help" type="button" style="${screenButtonCss()}">Rules and Controls</button>
        <button id="btn-title-testmode" type="button" style="${screenButtonCss()}">Test Mode</button>
      </div>
      <div style="
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px 22px;
      ">
        <button id="btn-title-overview" type="button" style="${screenButtonCss()}">Trait and Unit Overview</button>
        <button id="btn-title-blog" type="button" style="${screenButtonCss()}">Dev Blog</button>
      </div>
    </div>
  `
  document.body.appendChild(el)
  wireLogoFallback(el, 'title-screen')
  // Hover/press feedback is wired once, here, and never in showTitleScreen:
  // it uses addEventListener, so re-wiring it on every show would stack a
  // fresh listener per show.
  for (const btn of el.querySelectorAll<HTMLButtonElement>('button')) wireButtonFeedback(btn)
  rootEl = el
  return el
}

function button(root: HTMLElement, id: string): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>(`#${id}`)
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

// Deliberately re-wires the click handlers on every call rather than only on
// creation: `handlers` closes over src/main.ts state, and a screen that is
// hidden and shown again must not keep calling into a stale closure.
export function showTitleScreen(handlers: TitleScreenHandlers): void {
  const root = ensureRoot()

  const solo = button(root, 'btn-title-solo')
  const multiplayer = button(root, 'btn-title-multiplayer')
  const help = button(root, 'btn-title-help')
  const testmode = button(root, 'btn-title-testmode')
  const overview = button(root, 'btn-title-overview')
  const blog = button(root, 'btn-title-blog')

  // onclick (not addEventListener) so a re-show replaces the previous handler
  // instead of stacking a second one that would fire the callback twice.
  if (solo !== null) solo.onclick = () => handlers.onSolo()
  if (multiplayer !== null) {
    // Reset every call (not just when disabled) — the button element
    // persists across show/hide cycles, so a later re-enable must be able
    // to clear a still-dimmed, still-relabeled button from an earlier show.
    if (handlers.multiplayerDisabled) {
      multiplayer.onclick = null
      multiplayer.disabled = true
      multiplayer.style.opacity = '0.5'
      multiplayer.style.cursor = 'not-allowed'
      multiplayer.textContent = 'Multiplayer (Temporarily Unavailable)'
    } else {
      multiplayer.onclick = () => handlers.onMultiplayer()
      multiplayer.disabled = false
      multiplayer.style.opacity = ''
      multiplayer.style.cursor = ''
      multiplayer.textContent = 'Start Multiplayer Game'
    }
  }
  if (testmode !== null) testmode.onclick = () => handlers.onTestMode()

  // Opens the help modal OVER this screen — the Title Screen is deliberately
  // never hidden here, because the modal is reference material, not a
  // destination like Solo/Multiplayer/Test Mode.
  if (help !== null) help.onclick = () => handlers.onHelp()

  // Opens the overview PDF and blog in a new tab, same reasoning as Help
  // above — the Title Screen stays up so switching back to this tab lands
  // on a live screen.
  if (overview !== null) overview.onclick = () => handlers.onOverview()
  if (blog !== null) blog.onclick = () => handlers.onBlog()

  fadeScreenIn(root)
}

export function hideTitleScreen(): void {
  if (rootEl === null) return
  fadeScreenOut(rootEl)
}

export function isTitleScreenVisible(): boolean {
  return rootEl !== null && rootEl.style.display !== 'none' && rootEl.style.opacity !== '0'
}
