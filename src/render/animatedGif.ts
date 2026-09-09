// Canvas cannot sample an animated GIF's current frame. Chrome permanently
// freezes an <img>-backed animated GIF on its first frame the moment it's
// drawn via ctx.drawImage(), even though the very same GIF animates normally
// when the browser renders it directly as a DOM element (confirmed live —
// see .planning/debug/shiny-units-dont-show-sparkle.md for the full
// investigation: a DOM-attached control animated across screenshots while
// drawImage against that same element stayed frozen on frame 0 across 80
// samples over 4 seconds). Unlike this codebase's <video> overlays, DOM
// attachment does not rescue this — a different mechanism is required.
//
// This module decodes every frame of a GIF up front with the WebCodecs
// ImageDecoder API and hands the caller whichever frame is due right now,
// derived from the GIF's own per-frame durations and wall-clock time. The
// decoded VideoFrame objects are directly drawable via ctx.drawImage() (a
// VideoFrame is a valid CanvasImageSource) — no ImageBitmap conversion or
// canvas round-trip needed.
//
// Feature-detected: browsers without ImageDecoder (older Safari) or that
// can't decode this MIME type simply never become ready, so getCurrentFrame()
// returns null forever — identical to today's "overlay never shows"
// behavior, not a new failure mode.

export interface AnimatedGif {
  /** The frame that should be visible right now, or null if not decoded yet / unsupported. */
  getCurrentFrame(): VideoFrame | null
}

interface DecodedFrame {
  frame: VideoFrame
  durationMs: number
}

class AnimatedGifImpl implements AnimatedGif {
  private frames: DecodedFrame[] = []
  private totalDurationMs = 0
  private ready = false
  private readonly startTime = performance.now()

  constructor(url: string) {
    void this.load(url)
  }

  private async load(url: string): Promise<void> {
    if (typeof ImageDecoder === 'undefined') return
    try {
      if (!(await ImageDecoder.isTypeSupported('image/gif'))) return

      const resp = await fetch(url)
      const data = await resp.arrayBuffer()
      const decoder = new ImageDecoder({ data, type: 'image/gif' })
      await decoder.tracks.ready

      const track = decoder.tracks.selectedTrack
      if (!track) { decoder.close(); return }

      const frames: DecodedFrame[] = []
      for (let i = 0; i < track.frameCount; i++) {
        const { image } = await decoder.decode({ frameIndex: i })
        // duration is microseconds; default to 100ms if a frame omits it.
        frames.push({ frame: image, durationMs: (image.duration ?? 100_000) / 1000 })
      }
      decoder.close()

      const totalDurationMs = frames.reduce((sum, f) => sum + f.durationMs, 0)
      if (frames.length === 0 || totalDurationMs <= 0) return

      this.frames = frames
      this.totalDurationMs = totalDurationMs
      this.ready = true
    } catch {
      // Fetch or decode failure — stays unready; getCurrentFrame() returns null forever.
    }
  }

  getCurrentFrame(): VideoFrame | null {
    if (!this.ready) return null
    const elapsed = (performance.now() - this.startTime) % this.totalDurationMs
    let acc = 0
    for (const { frame, durationMs } of this.frames) {
      acc += durationMs
      if (elapsed < acc) return frame
    }
    return this.frames[this.frames.length - 1].frame
  }
}

export function loadAnimatedGif(url: string): AnimatedGif {
  return new AnimatedGifImpl(url)
}
