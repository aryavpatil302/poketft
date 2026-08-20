// The Lobby Screen (04-UI-SPEC.md §Screens 2) — the shareable link, the live
// list of connected humans, and the host's Start control.
//
// DOM only, with no networking of any kind: it receives data through
// updateLobbyScreen() and emits intent through the callbacks in
// LobbyScreenProps. src/main.ts owns the socket, so nothing here can send a
// frame, and this screen can be reasoned about purely as a function of the
// last `lobby` view the server broadcast.
//
// This module emits NO logging statements, deliberately. The shareable link
// is a bearer capability — anyone holding it can take a seat in the room —
// and a single log line would put it in the browser's developer output and in
// any downstream sink a future error reporter attaches (T-04-10). The link is
// disclosed only through the clipboard write the user explicitly asked for.
// The grep in this plan's acceptance criteria enforces the absence
// mechanically, which is why even this comment avoids the literal token.

import { escapeHtml } from './escapeHtml'
import {
  screenRootCss, screenHeaderHtml, wireLogoFallback,
  screenButtonCss, wireButtonFeedback, fadeScreenIn, fadeScreenOut,
  SCREEN_YELLOW, SCREEN_FADE_MS,
} from './screenChrome'
import type { LobbySeatView } from '../net/protocol'

export interface LobbyScreenProps {
  shareUrl: string
  isHost: boolean
  onStart: () => void
}

export interface LobbyScreenView {
  seats: LobbySeatView[]
  localSeat: number
}

const COPIED_FEEDBACK_MS = 1500

// ─── Overlay element ──────────────────────────────────────────────────────────

let rootEl: HTMLDivElement | null = null
let currentShareUrl = ''
let copiedTimer: ReturnType<typeof setTimeout> | null = null

// An inline SVG rather than an asset: public/visuals/gui icons/ has no copy
// glyph, and 04-UI-SPEC.md allows inline SVG explicitly. Two offset rounded
// rectangles — the universal "copy" mark.
const COPY_ICON_SVG = `
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
       stroke="${SCREEN_YELLOW}" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="12" height="12" rx="2"></rect>
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"></path>
  </svg>
`

// Attached to document.body for the same reason the Title Screen is: #app
// subtrees are rebuilt wholesale by renderEconUI()/updateEconVisibility().
function ensureRoot(): HTMLDivElement {
  if (rootEl !== null) return rootEl
  const el = document.createElement('div')
  el.id = 'lobby-screen'
  el.style.cssText = screenRootCss()
  el.innerHTML = `
    ${screenHeaderHtml('lobby-screen')}

    <div style="display:flex;flex-direction:column;align-items:center;gap:2.4vh;width:min(720px, 88vw);">

      <div style="width:100%;">
        <div style="
          color:${SCREEN_YELLOW};font-weight:900;font-size:13px;letter-spacing:0.1em;
          margin-bottom:6px;text-shadow:0 2px 4px rgba(0,0,0,0.7);
        ">Link here</div>
        <div id="lobby-link-bar" role="button" tabindex="0" title="Copy the lobby link" style="
          display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;
          background:#2f63c7;border:3px solid #000;border-radius:12px;
          padding:12px 16px;cursor:pointer;
          box-shadow:0 4px 0 #16306b, 0 8px 18px rgba(0,0,0,0.45);
        ">
          <span id="lobby-link-text" style="
            flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
            color:#fff;font-family:monospace;font-size:15px;letter-spacing:0.02em;
            transition:opacity ${SCREEN_FADE_MS / 1000}s ease;
          "></span>
          <span id="lobby-copy-icon" style="display:flex;align-items:center;flex-shrink:0;">
            ${COPY_ICON_SVG}
          </span>
        </div>
      </div>

      <div style="width:100%;">
        <div style="
          color:${SCREEN_YELLOW};font-weight:900;font-size:13px;letter-spacing:0.1em;
          margin-bottom:6px;text-shadow:0 2px 4px rgba(0,0,0,0.7);
        ">Current players</div>
        <div id="lobby-players" style="
          background:rgba(8,12,24,0.72);border:2px solid #6aa4ff;border-radius:12px;
          padding:12px 16px;color:#cde;font-size:15px;line-height:1.7;min-height:28px;
        "></div>
      </div>

      <div id="lobby-start-slot" style="display:flex;justify-content:center;min-height:52px;"></div>

      <div id="lobby-message" style="
        display:none;max-width:100%;text-align:center;
        color:#ff8080;font-size:13px;line-height:1.5;
        background:rgba(8,12,24,0.8);border:1px solid #ff6666;border-radius:8px;
        padding:8px 14px;
      "></div>
    </div>
  `
  document.body.appendChild(el)
  wireLogoFallback(el, 'lobby-screen')
  wireLinkBar(el)
  rootEl = el
  return el
}

// ─── Link bar ─────────────────────────────────────────────────────────────────

// The whole bar is the copy target, not just the icon — the spec says
// "clicking anywhere on the bar or the icon". Wired once at creation because
// it closes over nothing but module state (currentShareUrl), which
// showLobbyScreen keeps current.
function wireLinkBar(root: HTMLElement): void {
  const bar = root.querySelector<HTMLElement>('#lobby-link-bar')
  if (bar === null) return
  bar.addEventListener('click', () => { void copyShareUrl() })
  bar.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    void copyShareUrl()
  })
}

function linkTextEl(): HTMLElement | null {
  return rootEl === null ? null : rootEl.querySelector<HTMLElement>('#lobby-link-text')
}

// The single writer of the link bar's visible text, so the escape cannot be
// skipped by one of the two callers (initial render and the "Copied!" swap).
function setLinkText(el: HTMLElement, value: string): void {
  el.innerHTML = escapeHtml(value)
}

// Feedback fires on success AND on failure alike. A clipboard write can be
// refused for reasons the player cannot act on (an insecure origin, a denied
// permission, a browser that has no Clipboard API at all), and a bar that
// silently does nothing reads as a broken button. The link is still visible
// and selectable either way, so "Copied!" is at worst optimistic, never a
// dead end.
async function copyShareUrl(): Promise<void> {
  try {
    await navigator.clipboard?.writeText(currentShareUrl)
  } catch {
    // Intentionally swallowed — see above.
  }
  flashCopied()
}

// Matches the app's opacity-transition fade (tooltipFadeIn/tooltipHide in
// src/main.ts): fade the URL out, swap the text, fade back in, and reverse it
// after COPIED_FEEDBACK_MS.
function flashCopied(): void {
  const text = linkTextEl()
  if (text === null) return
  if (copiedTimer !== null) clearTimeout(copiedTimer)

  const swap = (value: string): void => {
    text.style.opacity = '0'
    window.setTimeout(() => {
      setLinkText(text, value)
      text.style.opacity = '1'
    }, SCREEN_FADE_MS)
  }

  swap('Copied!')
  copiedTimer = setTimeout(() => {
    copiedTimer = null
    swap(currentShareUrl)
  }, COPIED_FEEDBACK_MS)
}

// ─── Start control ────────────────────────────────────────────────────────────

// A guest gets no Start button at all, not a disabled one: the round is
// host-controlled per 04-UI-SPEC.md, and an inert control invites clicking.
function renderStartControl(root: HTMLElement, props: LobbyScreenProps): void {
  const slot = root.querySelector<HTMLElement>('#lobby-start-slot')
  if (slot === null) return

  if (!props.isHost) {
    slot.innerHTML = `<div style="
      color:#cde;font-size:15px;font-style:italic;letter-spacing:0.04em;
      align-self:center;text-shadow:0 2px 4px rgba(0,0,0,0.7);
    ">Waiting for host to start...</div>`
    return
  }

  slot.innerHTML = `<button id="btn-lobby-start" type="button" style="${screenButtonCss()}; min-width: 200px;">Start</button>`
  const button = slot.querySelector<HTMLButtonElement>('#btn-lobby-start')
  if (button === null) return
  button.onclick = () => props.onStart()
  wireButtonFeedback(button)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function showLobbyScreen(props: LobbyScreenProps): void {
  const root = ensureRoot()
  currentShareUrl = props.shareUrl

  const text = linkTextEl()
  if (text !== null) {
    // T-04-08: the URL is derived from the address bar, so it is escaped on
    // the way into innerHTML rather than trusted. `code` has already passed
    // isLobbyCode's fixed alphabet by the time src/main.ts builds this, which
    // makes the escape a second lock on the same door — the one that holds if
    // that first check is ever loosened.
    setLinkText(text, props.shareUrl)
    text.title = props.shareUrl
  }

  renderStartControl(root, props)
  fadeScreenIn(root)
}

// Safe to call repeatedly and safe to call before showLobbyScreen has ever
// run — it is driven by server broadcasts, whose timing this client does not
// control, and a `lobby` frame can legitimately arrive before anything has
// decided to render a screen.
export function updateLobbyScreen(view: LobbyScreenView): void {
  if (rootEl === null) return
  const list = rootEl.querySelector<HTMLElement>('#lobby-players')
  if (list === null) return

  // A bot-held seat is not a connected player. `human` is derived from live
  // occupancy in party/seats.ts's lobbyView, so filtering on it is also what
  // makes a seat vanish from this list the moment its socket closes.
  const humans = view.seats.filter(s => s.human).sort((a, b) => a.seat - b.seat)

  if (humans.length === 0) {
    list.innerHTML = `<span style="color:#778;font-style:italic;">Connecting...</span>`
    return
  }

  // Numbered by POSITION in the filtered list, not by seat index: seat
  // numbers are an implementation detail of the room's 6-seat table, and a
  // guest seated at index 3 reading "4." would be confusing.
  list.innerHTML = humans.map((seat, position) => {
    const label = seat.seat === view.localSeat ? 'You' : escapeHtml(seat.name)
    const isLocal = seat.seat === view.localSeat
    return `<span style="display:inline-block;margin-right:18px;">
      <span style="color:#88aaff;">${position + 1}.</span>
      <span style="${isLocal ? `color:${SCREEN_YELLOW};font-weight:bold;` : 'color:#cde;'}">${label}</span>
    </span>`
  }).join('')
}

// Where src/main.ts puts the lobby-full rejection. Passing null hides the
// line entirely rather than leaving an empty box.
export function setLobbyMessage(text: string | null): void {
  if (rootEl === null) return
  const el = rootEl.querySelector<HTMLElement>('#lobby-message')
  if (el === null) return
  if (text === null) {
    el.style.display = 'none'
    el.textContent = ''
    return
  }
  el.textContent = text
  el.style.display = 'block'
}

export function hideLobbyScreen(): void {
  if (rootEl === null) return
  fadeScreenOut(rootEl)
}

export function isLobbyScreenVisible(): boolean {
  return rootEl !== null && rootEl.style.display !== 'none' && rootEl.style.opacity !== '0'
}
