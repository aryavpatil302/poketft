import { describe, it, expect } from 'vitest'
import {
  enterFullscreen,
  shouldOfferFullscreenPrompt,
  type FullscreenTarget,
} from './fullscreen'

describe('enterFullscreen', () => {
  it('resolves true when the target requestFullscreen resolves', async () => {
    const fake: FullscreenTarget = {
      requestFullscreen: () => Promise.resolve(),
    }
    await expect(enterFullscreen(fake)).resolves.toBe(true)
  })

  // The whole point of the helper: a denied request must resolve false, not
  // surface as an unhandled rejection on the boot path.
  it('resolves false, and does not reject, when requestFullscreen rejects', async () => {
    const fake: FullscreenTarget = {
      requestFullscreen: () => Promise.reject(new Error('denied')),
    }
    await expect(enterFullscreen(fake)).resolves.toBe(false)
  })

  it('resolves false when the target has no requestFullscreen property', () => {
    const fake: FullscreenTarget = {}
    return expect(enterFullscreen(fake)).resolves.toBe(false)
  })

  it('invokes requestFullscreen exactly once per call', async () => {
    let calls = 0
    const fake: FullscreenTarget = {
      requestFullscreen: () => {
        calls++
        return Promise.resolve()
      },
    }
    await enterFullscreen(fake)
    expect(calls).toBe(1)
  })
})

describe('shouldOfferFullscreenPrompt', () => {
  it('returns true only for a guest on a supporting, not-yet-fullscreen browser', () => {
    expect(shouldOfferFullscreenPrompt(false, true, false)).toBe(true)
  })

  it('returns false for every host case', () => {
    expect(shouldOfferFullscreenPrompt(true, true, false)).toBe(false)
    expect(shouldOfferFullscreenPrompt(true, false, false)).toBe(false)
    expect(shouldOfferFullscreenPrompt(true, true, true)).toBe(false)
  })

  it('returns false for a guest on an unsupported browser', () => {
    expect(shouldOfferFullscreenPrompt(false, false, false)).toBe(false)
  })

  it('returns false for a guest already in fullscreen', () => {
    expect(shouldOfferFullscreenPrompt(false, true, true)).toBe(false)
  })
})
