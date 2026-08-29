// The single module that touches the fullscreen DOM API.
//
// Browsers only grant `requestFullscreen()` inside a genuine synchronous user
// gesture (a real click), never from a page-load hook, a timer, or the far
// side of an `await`. Every caller of `enterFullscreen()` therefore has to be
// a real click handler, and it must call this module as the FIRST thing that
// happens in that handler. Funnelling every fullscreen call through here
// means the failure-swallowing (a denial must never surface as an unhandled
// promise rejection on the boot path) happens in exactly one place.

// The narrow slice of `Element` this module touches. Kept as an interface
// (rather than importing DOM lib types directly) so node-environment tests
// can pass a plain object fake with no `document` in scope.
export interface FullscreenTarget {
  requestFullscreen?: () => Promise<void>
}

export function isFullscreenSupported(): boolean {
  return (
    document.fullscreenEnabled === true &&
    typeof document.documentElement.requestFullscreen === 'function'
  )
}

export function isFullscreenActive(): boolean {
  return document.fullscreenElement !== null
}

// Pure three-argument predicate rather than reading `document` itself, so it
// is testable without a DOM — the caller supplies the two readings.
export function shouldOfferFullscreenPrompt(
  isHost: boolean,
  supported: boolean,
  active: boolean
): boolean {
  return !isHost && supported && !active
}

// CRITICAL: nothing may suspend before the browser API call. In an `async`
// function the body runs synchronously up to the first `await`, and the call
// itself is evaluated before that `await` suspends — so
// `await target.requestFullscreen()` is safe, but hoisting any other
// `await`, `setTimeout`, or `.then()` hop above it would consume the click's
// gesture token and make fullscreen fail silently in every browser.
//
// The default parameter is only evaluated when the argument is omitted,
// which is what keeps this module importable in the node test environment
// (no `document` is touched unless a caller actually omits `target`).
export async function enterFullscreen(
  target: FullscreenTarget = document.documentElement
): Promise<boolean> {
  if (typeof target.requestFullscreen !== 'function') return false
  try {
    await target.requestFullscreen()
    return true
  } catch {
    return false
  }
}
