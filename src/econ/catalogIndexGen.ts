// Regenerates src/econ/catalogIndex.ts from docs/compositions.json. Node-only
// (uses fs) — never imported by bots.ts or anything that runs in the browser.
// Called once manually to seed the index, and again by growCatalog.ts every
// time it appends a newly-discovered entry to compositions.json, so the two
// files can never drift apart.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

interface CatalogNode { id?: string; coreUnitIds?: string[]; [key: string]: unknown }

function collectEntries(node: unknown, out: Array<{ id: string; coreUnitIds: string[] }>): void {
  if (Array.isArray(node)) { for (const n of node) collectEntries(n, out); return }
  if (node && typeof node === 'object') {
    const o = node as CatalogNode
    if (typeof o.id === 'string' && Array.isArray(o.coreUnitIds)) {
      out.push({ id: o.id, coreUnitIds: o.coreUnitIds as string[] })
    }
    for (const k in o) collectEntries(o[k], out)
  }
}

export function regenerateCatalogIndex(): void {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const catalogPath = join(__dirname, '../../docs/compositions.json')
  const outPath = join(__dirname, 'catalogIndex.ts')

  const data = JSON.parse(readFileSync(catalogPath, 'utf-8'))
  const entries: Array<{ id: string; coreUnitIds: string[] }> = []
  collectEntries(data, entries)
  entries.sort((a, b) => a.id.localeCompare(b.id))

  const body = entries
    .map(e => `  { id: ${JSON.stringify(e.id)}, coreUnitIds: ${JSON.stringify(e.coreUnitIds)} },`)
    .join('\n')

  const contents = `// Generated from docs/compositions.json by src/econ/catalogIndexGen.ts — do not
// hand-edit. Lightweight (id + core unit ids only, no prose) so bots.ts can
// match a live board against the composition catalog without pulling the full
// ~35k-line JSON doc into the browser bundle. Regenerate after any edit to
// docs/compositions.json (growCatalog.ts does this automatically).
export interface CatalogEntry { id: string; coreUnitIds: string[] }
export const CATALOG_INDEX: CatalogEntry[] = [
${body}
]
`
  writeFileSync(outPath, contents, 'utf-8')
  console.log(`Wrote ${outPath} (${entries.length} catalog entries)`)
}

// Allow running directly: npx tsx src/econ/catalogIndexGen.ts
if (fileURLToPath(import.meta.url) === process.argv[1]) regenerateCatalogIndex()
