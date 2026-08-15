// Shared HTML-report asset embedding — unit sprites / item icons read from
// public/visuals/… and inlined as data-URIs. Used by both
// src/sim/leagueReport.ts (bot league combat report) and src/econ/trainAll.ts
// (training pipeline report) so the embedding logic lives in exactly one
// place. Pure/stateless (a shared cache, no per-report mutable sets) — each
// report keeps its OWN "which sprites did I actually use" bookkeeping, since
// that's tied to that report's own render lifecycle.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { UNIT_MAP } from '../data/units'
import { ITEM_MAP } from '../data/items'

const assetCache = new Map<string, string | null>()
export function dataUri(publicPath: string | undefined): string | null {
  if (!publicPath) return null
  if (assetCache.has(publicPath)) return assetCache.get(publicPath)!
  const rel = publicPath.replace(/^\//, '')
  const full = resolve(process.cwd(), 'public', rel)
  let out: string | null = null
  try {
    const buf = readFileSync(full)
    const ext = (full.split('.').pop() ?? '').toLowerCase()
    const mime = ext === 'webp' ? 'image/webp' : ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif'
      : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : 'application/octet-stream'
    out = `data:${mime};base64,${buf.toString('base64')}`
  } catch { out = null }
  assetCache.set(publicPath, out)
  return out
}
export const unitSprite = (defId: string): string | null => dataUri(UNIT_MAP.get(defId)?.spritePath)
export const itemIcon   = (itemId: string): string | null => dataUri(ITEM_MAP.get(itemId)?.iconPath)
export const unitName   = (defId: string): string => UNIT_MAP.get(defId)?.name ?? defId
