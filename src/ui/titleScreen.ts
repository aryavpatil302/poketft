// The Title Screen (04-UI-SPEC.md §Screens 1) — the first thing the app shows
// when the URL carries no `?lobby=` code.
//
// DOM only. No game logic, no networking, no imports that reach either: this
// module renders four buttons and calls back. src/main.ts owns what those
// callbacks mean, which is what keeps the solo boot path and the lobby boot
// path both readable in one place instead of leaking into the view.

import {
  screenRootCss, screenHeaderHtml, wireLogoFallback,
  screenButtonCss, wireButtonFeedback, fadeScreenIn, fadeScreenOut,
} from './screenChrome'

export interface TitleScreenHandlers {
  onSolo: () => void
  onMultiplayer: () => void
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
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(2, auto);
      gap: 18px 22px;
      width: min(680px, 84vw);
    ">
      <button id="btn-title-solo" type="button" style="${screenButtonCss()}">Start Solo Game</button>
      <button id="btn-title-multiplayer" type="button" style="${screenButtonCss()}">Start Multiplayer Game</button>
      <button id="btn-title-tutorial" type="button" style="${screenButtonCss()}">Tutorial</button>
      <button id="btn-title-cheatsheet" type="button" style="${screenButtonCss()}">Cheat Sheet</button>
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
  const tutorial = button(root, 'btn-title-tutorial')
  const cheatsheet = button(root, 'btn-title-cheatsheet')

  // onclick (not addEventListener) so a re-show replaces the previous handler
  // instead of stacking a second one that would fire the callback twice.
  if (solo !== null) solo.onclick = () => handlers.onSolo()
  if (multiplayer !== null) multiplayer.onclick = () => handlers.onMultiplayer()

  // Tutorial and Cheat Sheet render and are clickable, and do nothing at all.
  // 04-UI-SPEC.md §Explicitly Out of Scope puts their CONTENT out of this
  // phase; the buttons exist now so the 2x2 layout is the real layout rather
  // than something a later phase has to re-lay-out around.
  if (tutorial !== null) tutorial.onclick = () => { /* no-op: see comment above */ }
  if (cheatsheet !== null) cheatsheet.onclick = () => { /* no-op: see comment above */ }

  fadeScreenIn(root)
}

export function hideTitleScreen(): void {
  if (rootEl === null) return
  fadeScreenOut(rootEl)
}

export function isTitleScreenVisible(): boolean {
  return rootEl !== null && rootEl.style.display !== 'none' && rootEl.style.opacity !== '0'
}
