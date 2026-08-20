// Chrome shared by the two full-page screens 04-UI-SPEC.md specifies (the
// Title Screen and the Lobby Screen): the beach backdrop, the logo, the
// "Isle Of Imagination" subtitle, and the fade convention both use.
//
// It exists because the two screens are specified as visually identical
// above the fold — the spec says the Lobby Screen keeps "logo + subtitle,
// same as Title Screen" — and the logo has a runtime FALLBACK behaviour
// (see LOGO_SRC below) that would drift the moment it was written twice.
//
// Deliberately does NOT own the overlay element itself. Each screen creates
// and appends its own root so that its lifecycle (create / show / hide) is
// readable in one file, and so neither screen can be dismissed by the other.

import { escapeHtml } from './escapeHtml'

// ─── Palette ──────────────────────────────────────────────────────────────────

// Matches the existing dark/blue/yellow inline-style palette in src/main.ts
// (#0a0e1a panels, #88aaff/#6aa4ff accents) rather than introducing a new one.
export const SCREEN_Z_INDEX = 500
export const SCREEN_YELLOW = '#f0c95c'
export const SCREEN_OUTLINE_BLUE = '#1a3a7a'
export const SCREEN_BUTTON_BLUE = '#2f63c7'
export const SCREEN_BUTTON_BLUE_HOVER = '#3c78e6'
export const SCREEN_FADE_MS = 300

// `pixel_beach.png` is the same backdrop #layout already uses, so the screens
// sit on the art the game itself opens onto rather than a second look.
// `beach background.jpg` is the alternative the spec names if this reads worse
// in the browser — swapping this one constant switches both screens.
const BACKGROUND_URL = '/visuals/backgrounds/pixel_beach.png'

// The spec's asset. It is NOT in the repo at the time of writing — every
// path under public/visuals/gui icons/ is accounted for and none is a logo —
// so wireLogoFallback() below swaps in a CSS wordmark when the request 404s.
// Keeping the src pointing at the spec'd path means dropping the file in
// later is the whole fix, with no code change.
const LOGO_SRC = '/visuals/gui icons/Logo.png'

const WORDMARK_TEXT = 'PokeTFT'

// Existing beach-themed static sprites (public/visuals/sprites/beachy/) used
// as purely decorative title/lobby-screen dressing — no gameplay meaning,
// just idle Pokémon on the sand behind the buttons.
const BEACH_SPRITE_FILES = [
  'a-exeggutor-sprite.webp',
  'a-raichu-sprite.webp',
  'blastoise-sprite.webp',
  'kingler-sprite.webp',
  'palossand-sprite.webp',
  'tapu-fini-sprite.webp',
]

// Fixed screen positions (percent of the full-page root) hugging the left
// beach / right jungle trim of the background art, so sprites read as part
// of the scenery instead of floating over the sand where the buttons sit.
// Which sprite lands in which slot is randomized per screen load; the slots
// themselves stay put so nothing overlaps the centered logo/button column.
const BEACH_SPRITE_SLOTS: Array<{ left: string; bottom: string }> = [
  { left: '3%', bottom: '6%' },
  { left: '10%', bottom: '26%' },
  { left: '4%', bottom: '46%' },
  { left: '94%', bottom: '8%' },
  { left: '88%', bottom: '28%' },
  { left: '93%', bottom: '48%' },
]

let beachSpriteStyleInjected = false

// @keyframes cannot live in an inline `style` attribute, so this is injected
// into <head> once, the same way a stylesheet-free app injects any shared
// keyframe it needs.
function ensureBeachSpriteKeyframes(): void {
  if (beachSpriteStyleInjected) return
  const style = document.createElement('style')
  style.id = 'beach-sprite-keyframes'
  style.textContent = `
    @keyframes screenSpriteBob {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10%); }
    }
  `
  document.head.appendChild(style)
  beachSpriteStyleInjected = true
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// Randomized on every call: which sprites appear, which slot each lands in,
// and each one's bob timing — so a fresh screen load never looks identical
// to the last. Purely decorative: `pointer-events: none` and a low z-index
// keep them from ever intercepting a click meant for the buttons above.
function beachSpritesHtml(): string {
  const files = shuffled(BEACH_SPRITE_FILES)
  const slots = shuffled(BEACH_SPRITE_SLOTS)
  const count = Math.min(files.length, slots.length)
  const imgs: string[] = []
  for (let i = 0; i < count; i++) {
    const slot = slots[i]
    const duration = (2.2 + Math.random() * 1.4).toFixed(2)
    const delay = (-Math.random() * 3).toFixed(2)
    const size = Math.round(56 + Math.random() * 28)
    imgs.push(`
      <img src="/visuals/sprites/beachy/${files[i]}" alt="" style="
        position:absolute; left:${slot.left}; bottom:${slot.bottom};
        width:${size}px; height:auto; image-rendering:pixelated;
        pointer-events:none; z-index:-1;
        animation: screenSpriteBob ${duration}s ease-in-out ${delay}s infinite;
      ">
    `)
  }
  return imgs.join('')
}

// ─── Overlay root ─────────────────────────────────────────────────────────────

// The full-page positioning both screens share. z-index 500 clears every
// existing overlay in src/main.ts (the highest is 201 on the held-item
// cursor) without colliding with the 9999 network-status banner, which must
// stay readable ON TOP of a screen.
export function screenRootCss(): string {
  return [
    'position: fixed',
    'inset: 0',
    `z-index: ${SCREEN_Z_INDEX}`,
    `background: #0a0e1a url('${BACKGROUND_URL}') center center / cover no-repeat`,
    'display: flex',
    'flex-direction: column',
    'align-items: center',
    'justify-content: center',
    'gap: 4vh',
    'font-family: sans-serif',
    'color: #cce',
    'user-select: none',
    'overflow: hidden',
    'opacity: 0',
    `transition: opacity ${SCREEN_FADE_MS / 1000}s ease`,
  ].join('; ')
}

// ─── Logo + subtitle header ───────────────────────────────────────────────────

// The yellow-with-blue-outline pixel look the mockup shows, done with CSS
// only (-webkit-text-stroke plus a layered text-shadow) — the spec explicitly
// forbids generating new art for the subtitle.
function pixelTextCss(fontSizeCss: string): string {
  return [
    `color: ${SCREEN_YELLOW}`,
    'font-weight: 900',
    `font-size: ${fontSizeCss}`,
    'letter-spacing: 0.14em',
    'text-transform: none',
    `-webkit-text-stroke: 2px ${SCREEN_OUTLINE_BLUE}`,
    'paint-order: stroke fill',
    [
      `text-shadow: 0 3px 0 ${SCREEN_OUTLINE_BLUE}`,
      `0 -1px 0 ${SCREEN_OUTLINE_BLUE}`,
      `2px 0 0 ${SCREEN_OUTLINE_BLUE}`,
      `-2px 0 0 ${SCREEN_OUTLINE_BLUE}`,
      '0 6px 14px rgba(0,0,0,0.55)',
    ].join(', '),
    'text-align: center',
    'margin: 0',
  ].join('; ')
}

// `idPrefix` keeps the two screens' element ids distinct, because both are in
// the document at once during the hand-off from Title to Lobby.
//
// Also injects the decorative beach sprites here (rather than a separate call
// each screen has to remember) — every caller of screenHeaderHtml wants them,
// since both screens share the same beach backdrop.
export function screenHeaderHtml(idPrefix: string): string {
  ensureBeachSpriteKeyframes()
  return `
    ${beachSpritesHtml()}
    <div style="display:flex;flex-direction:column;align-items:center;gap:0.6vh;">
      <img id="${idPrefix}-logo" src="${LOGO_SRC}" alt="" style="
        max-height: 30vh; max-width: 70vw; object-fit: contain;
        image-rendering: pixelated; display: block;
      ">
      <div id="${idPrefix}-wordmark" style="display:none;${pixelTextCss('clamp(34px, 7vw, 84px)')}">
        ${escapeHtml(WORDMARK_TEXT)}
      </div>
    </div>
  `
}

// The logo asset is not in the repo yet (see LOGO_SRC). Rather than leave a
// broken-image glyph on the first screen a player ever sees, swap to the CSS
// wordmark — the same treatment src/main.ts already gives every other
// optional image (`onerror="this.style.display='none'"`), but landing on a
// legible title instead of a gap.
export function wireLogoFallback(root: HTMLElement, idPrefix: string): void {
  const logo = root.querySelector<HTMLImageElement>(`#${idPrefix}-logo`)
  const wordmark = root.querySelector<HTMLElement>(`#${idPrefix}-wordmark`)
  if (logo === null || wordmark === null) return
  const useWordmark = (): void => {
    logo.style.display = 'none'
    wordmark.style.display = 'block'
  }
  logo.addEventListener('error', useWordmark)
  // `complete` with no intrinsic width means the browser already tried and
  // failed before this listener was attached (a cached 404).
  if (logo.complete && logo.naturalWidth === 0) useWordmark()
}

// ─── Buttons ──────────────────────────────────────────────────────────────────

// Blue rounded rect, black border, bold yellow text — the mockup's button.
export function screenButtonCss(): string {
  return [
    `background: ${SCREEN_BUTTON_BLUE}`,
    'border: 3px solid #000',
    'border-radius: 14px',
    `color: ${SCREEN_YELLOW}`,
    'font-family: sans-serif',
    'font-weight: 900',
    'font-size: clamp(13px, 1.5vw, 20px)',
    'letter-spacing: 0.06em',
    'padding: 18px 22px',
    'cursor: pointer',
    'box-shadow: 0 4px 0 #16306b, 0 8px 18px rgba(0,0,0,0.45)',
    'transition: background 0.15s ease, transform 0.08s ease',
  ].join('; ')
}

// Hover/press feedback wired in JS because these are inline-styled elements
// with no stylesheet to hang :hover off — the same reason every other
// interactive panel in src/main.ts wires its own listeners.
export function wireButtonFeedback(button: HTMLElement): void {
  button.addEventListener('mouseenter', () => { button.style.background = SCREEN_BUTTON_BLUE_HOVER })
  button.addEventListener('mouseleave', () => { button.style.background = SCREEN_BUTTON_BLUE })
  button.addEventListener('mousedown', () => { button.style.transform = 'translateY(2px)' })
  button.addEventListener('mouseup', () => { button.style.transform = 'none' })
}

// ─── Fade ─────────────────────────────────────────────────────────────────────

// The same restart-the-transition trick tooltipFadeIn() uses in src/main.ts:
// drop to 0 with transitions off, force a reflow, then animate back up.
export function fadeScreenIn(el: HTMLElement): void {
  el.style.display = 'flex'
  el.style.pointerEvents = 'auto'
  el.style.transition = 'none'
  el.style.opacity = '0'
  void el.offsetWidth
  el.style.transition = `opacity ${SCREEN_FADE_MS / 1000}s ease`
  el.style.opacity = '1'
}

// Mirrors tooltipHide(), then takes the extra step a full-page overlay needs:
// display none once the fade has run, so a dismissed screen cannot keep
// swallowing clicks meant for the board behind it. pointer-events drops
// immediately rather than after the fade, so the board is live the moment the
// dismissal is decided.
export function fadeScreenOut(el: HTMLElement): void {
  el.style.pointerEvents = 'none'
  el.style.transition = `opacity ${SCREEN_FADE_MS / 1000}s ease`
  el.style.opacity = '0'
  window.setTimeout(() => {
    if (el.style.opacity === '0') el.style.display = 'none'
  }, SCREEN_FADE_MS)
}
