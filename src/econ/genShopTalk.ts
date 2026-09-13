/**
 * Regenerates "Shop Talk" — a self-contained forum-style HTML page of community
 * chatter grounded in a FRESH bot-league sim — end to end, unattended:
 *   1. runs a fresh src/sim/botLeague.ts league as a subprocess (JSON output)
 *   2. digests the aggregates into grounded facts (shopTalkDigest.ts)
 *   3. has the `claude` CLI generate a persona pool + posts in bounded batches
 *      (shopTalkPrompts.ts)
 *   4. validates every batch mechanically before it's ever accepted
 *      (shopTalkValidate.ts)
 *   5. injects the result into the checked-in shell (shopTalkShell.html) and
 *      writes a finished HTML file to disk
 *
 * The job ends at a correct HTML file on disk — there is no publish step.
 *
 * Usage:
 *   npx tsx src/econ/genShopTalk.ts                                   (default: 50 games, 60 posts)
 *   npx tsx src/econ/genShopTalk.ts --games 10 --posts 6 --batch 3     (smoke-sized run)
 *   npx tsx src/econ/genShopTalk.ts --dry-run --posts 6 --data league.json   (prompt preview, zero claude calls)
 *   npx tsx src/econ/genShopTalk.ts --data league.json --keep-json     (reuse a prior sim JSON)
 *   (or: npm run gen-shop-talk -- --games 50)
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync, statSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import type { LeagueReport } from '../sim/leagueReport'
import { buildDigest, type Fact } from './shopTalkDigest'
import { buildPersonaPrompt, buildTopicPlanPrompt, buildBatchPrompt, type Topic } from './shopTalkPrompts'
import { escapeContent, validatePosts, type Post, type Comment, type Persona } from './shopTalkValidate'
import referenceFixture from './shopTalkReference.json'

const REFERENCE = referenceFixture as { personas: Record<string, Persona>; posts: Post[] }
const EXEMPLARS: Post[] = [
  REFERENCE.posts.find(p => p.id === 'sim-breadth')!,
  REFERENCE.posts.find(p => p.id === 'sim-tangela-correction')!,
]

// ─── Args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flag = (n: string): string | null => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : null }
const hasFlag = (n: string): boolean => args.includes(`--${n}`)

const GAMES     = Math.max(1, parseInt(flag('games')  ?? '50', 10) || 50)
const ROUNDS    = Math.max(5, parseInt(flag('rounds') ?? '30', 10) || 30)
const SEED      = parseInt(flag('seed') ?? '1', 10) || 1
const POSTS     = Math.max(1, parseInt(flag('posts')  ?? '60', 10) || 60)
const BATCH     = Math.max(1, parseInt(flag('batch')  ?? '5', 10) || 5)
const OUT       = flag('out') ?? 'training_runs/shop-talk-generated.html'
const DATA_PATH = flag('data')
const KEEP_JSON = hasFlag('keep-json')
const DRY_RUN   = hasFlag('dry-run')

// ─── Run bookkeeping (for the final stdout report) ──────────────────────────
interface CallRecord { label: string; elapsedSec: number; bytes: number }
const callLog: CallRecord[] = []
const warnings: string[] = []
let retryCount = 0
let simSeconds = 0
const wallClockStart = Date.now()

// ─── Step 2 — callClaude / extractJson ───────────────────────────────────────
// aiSummary.ts's generateAiSummary is sized for one ~250-word plain-English
// summary (180s / 10MB) and silently degrades to null on failure — appropriate
// for an optional narrative bolted onto a report. This pipeline has no
// degraded-but-useful path: a missing/unauthenticated `claude` CLI aborts the
// run outright. A batch here emits ~18KB of JSON (5 posts x ~2.8KB, measured
// from the reference artifact), so the 10-minute timeout is a generous
// hang-ceiling rather than an expected duration, and 64MB removes any
// truncation risk entirely. Re-implemented locally rather than extending
// aiSummary.ts's 5-line spawnSync — that module belongs to the training
// pipeline and churning it for a much larger limit would help nobody.
function callClaude(prompt: string, label: string): string {
  const start = Date.now()
  console.log(`  [${label}] calling claude (${(Buffer.byteLength(prompt) / 1024).toFixed(1)} KB prompt)...`)
  const result = spawnSync('claude', ['-p', prompt], { encoding: 'utf-8', timeout: 600_000, maxBuffer: 64 * 1024 * 1024 })
  const elapsedSec = (Date.now() - start) / 1000

  if (result.error) {
    console.error(`\nFATAL: could not run the \`claude\` CLI for call '${label}': ${result.error.message}. Is it installed, on PATH, and authenticated?`)
    process.exit(1)
  }
  if (result.status !== 0) {
    const detail = (result.stderr ?? '').trim().slice(0, 500)
    console.error(`\nFATAL: \`claude\` exited with code ${result.status} on call '${label}'${detail ? ` — ${detail}` : ''}`)
    process.exit(1)
  }
  const text = (result.stdout ?? '').trim()
  const bytes = Buffer.byteLength(text)
  callLog.push({ label, elapsedSec, bytes })
  console.log(`  [${label}] done in ${elapsedSec.toFixed(1)}s, ${bytes} bytes`)
  return text
}

function extractJson(stdout: string): unknown {
  const trimmed = stdout.trim()
  try { return JSON.parse(trimmed) } catch { /* try next strategy */ }

  const noFences = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try { return JSON.parse(noFences) } catch { /* try next strategy */ }

  const firstOpen = Math.min(
    ...['{', '['].map(c => { const i = noFences.indexOf(c); return i === -1 ? Number.POSITIVE_INFINITY : i })
  )
  const lastClose = Math.max(...['}', ']'].map(c => noFences.lastIndexOf(c)))
  if (Number.isFinite(firstOpen) && lastClose > firstOpen) {
    const sub = noFences.slice(firstOpen, lastClose + 1)
    try { return JSON.parse(sub) } catch { /* fall through to throw */ }
  }

  throw new Error(`could not extract JSON from claude output; first 400 chars: ${stdout.slice(0, 400)}`)
}

// ─── Step 1 — fresh sim (or --data reuse) → digest ──────────────────────────
function resolveTsx(): { cmd: string; args: string[] } {
  const localBin = resolve(process.cwd(), 'node_modules', '.bin', 'tsx')
  if (existsSync(localBin)) return { cmd: localBin, args: [] }
  return { cmd: 'npx', args: ['tsx'] }
}

// Scoped so `report` (up to ~20MB, dominated by traceFights/traceRounds which
// buildDigest never reads) goes out of scope and is GC-eligible the moment
// this returns — only the much smaller Fact[] survives.
function digestFromPath(jsonPath: string): Fact[] {
  const report = JSON.parse(readFileSync(jsonPath, 'utf-8')) as LeagueReport
  return buildDigest(report)
}

function getFacts(): Fact[] {
  if (DATA_PATH) {
    console.log(`Reusing existing league JSON: ${DATA_PATH} (skipping sim)`)
    return digestFromPath(DATA_PATH)
  }

  const tmp = join(tmpdir(), `league-${Date.now()}.json`)
  const { cmd, args: baseArgs } = resolveTsx()
  const simArgs = [...baseArgs, 'src/sim/botLeague.ts', '--games', String(GAMES), '--rounds', String(ROUNDS), '--seed', String(SEED), '--format', 'json', '--out', tmp]
  console.log(`\nRunning fresh bot-league sim (output streams below):\n  ${cmd} ${simArgs.join(' ')}\n`)

  const simStart = Date.now()
  const result = spawnSync(cmd, simArgs, { stdio: 'inherit', timeout: 2_700_000 })
  simSeconds = (Date.now() - simStart) / 1000

  if (result.status !== 0 || !existsSync(tmp)) {
    console.error(`\nFATAL: bot-league sim failed (exit code ${result.status ?? 'unknown'}${result.signal ? `, signal ${result.signal}` : ''})`)
    process.exit(typeof result.status === 'number' && result.status !== 0 ? result.status : 1)
  }

  const sizeBytes = statSync(tmp).size
  console.log(`\nSim JSON: ${(sizeBytes / 1024 / 1024).toFixed(1)} MB, ${simSeconds.toFixed(1)}s wall-clock`)
  if (sizeBytes > 1_000_000_000) {
    console.error('FATAL: league JSON exceeds 1 GB — this should not happen (size is trace-bound, not games-bound); re-run with fewer --games')
    process.exit(1)
  }

  const facts = digestFromPath(tmp)
  if (KEEP_JSON) console.log(`--keep-json: kept at ${tmp}`)
  else unlinkSync(tmp)
  return facts
}

// ─── Dry run — build every reachable prompt, print sizes, zero claude calls ──
// The persona and topic-plan prompts are always buildable without a prior
// claude call. Batch prompts depend on a topic plan, which normally comes
// FROM a claude call — so for a dry run only, we build a synthetic topic plan
// (deterministic, round-robins the real digest facts) purely to demonstrate
// the batch prompt shape end to end, including the fixture exemplars.
function buildSyntheticTopics(facts: Fact[], postCount: number): Topic[] {
  const topics: Topic[] = []
  for (let i = 0; i < postCount; i++) {
    const f = facts[i % Math.max(1, facts.length)]
    topics.push({
      id: `dry-run-topic-${i + 1}`,
      flair: i % 6 === 0 ? 'simbatch' : 'econ',
      angle: `[dry-run placeholder] a synthetic take grounded in ${f?.id ?? 'no facts available'}`,
      facts: f ? [f.id] : [],
      targetComments: 10,
      minutesAgo: i % 6 === 0 ? 620 : ((i * 137) % 3600) + 1,
    })
  }
  return topics
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function runDryRun(facts: Fact[]): void {
  console.log('\n[dry-run] Building every prompt the real run would make. Zero `claude` calls.\n')

  const personaPrompt = buildPersonaPrompt(Math.max(40, Math.round(POSTS * 2.5)), [])
  console.log(`--- persona prompt (${(Buffer.byteLength(personaPrompt) / 1024).toFixed(1)} KB) ---\n${personaPrompt}\n`)

  const topicPrompt = buildTopicPlanPrompt(facts, POSTS)
  console.log(`--- topic plan prompt (${(Buffer.byteLength(topicPrompt) / 1024).toFixed(1)} KB) ---\n${topicPrompt}\n`)

  const syntheticTopics = buildSyntheticTopics(facts, POSTS)
  const syntheticRoster = Object.keys(REFERENCE.personas).slice(0, 20)
  for (const [i, batchTopics] of chunk(syntheticTopics, BATCH).entries()) {
    const batchPrompt = buildBatchPrompt(batchTopics, facts, syntheticRoster, [], EXEMPLARS)
    console.log(`--- batch prompt ${i + 1} (synthetic topics, ${(Buffer.byteLength(batchPrompt) / 1024).toFixed(1)} KB) ---\n${batchPrompt}\n`)
  }

  console.log('[dry-run] Done. Zero `claude` calls made.')
}

// ─── Step 3 — persona pool ───────────────────────────────────────────────────
function buildPersonaPool(postCount: number): Record<string, Persona> {
  const target = Math.max(40, Math.round(postCount * 2.5))
  const pool: Record<string, Persona> = {}

  const hasHandle = (handle: string): boolean => {
    const key = handle.toLowerCase()
    return Object.keys(pool).some(h => h.toLowerCase() === key)
  }
  const merge = (raw: unknown): void => {
    if (typeof raw !== 'object' || raw === null) return
    for (const [handle, persona] of Object.entries(raw as Record<string, unknown>)) {
      if (hasHandle(handle)) continue   // first writer wins
      if (typeof persona !== 'object' || persona === null) continue
      const p = persona as Partial<Persona>
      if (typeof p.name === 'string' && typeof p.avatar === 'string' && typeof p.color === 'string') {
        pool[handle] = { name: p.name, avatar: p.avatar, color: p.color }
      }
    }
  }

  const chunks = Math.ceil(target / 50)
  for (let i = 0; i < chunks; i++) {
    const want = Math.min(50, target - Object.keys(pool).length)
    if (want <= 0) break
    merge(extractJson(callClaude(buildPersonaPrompt(want, Object.keys(pool)), `persona-pool-${i + 1}`)))
  }

  if (Object.keys(pool).length < target) {
    const need = target - Object.keys(pool).length
    merge(extractJson(callClaude(buildPersonaPrompt(need, Object.keys(pool)), 'persona-pool-topup')))
  }

  if (Object.keys(pool).length < postCount * 1.5) {
    warnings.push(`persona pool size ${Object.keys(pool).length} is below posts * 1.5 (${postCount * 1.5})`)
  }
  return pool
}

// ─── Step 4 — topic plan ─────────────────────────────────────────────────────
function validateTopicPlan(raw: unknown, postCount: number, factIds: Set<string>): { ok: boolean; errors: string[]; topics: Topic[] } {
  if (!Array.isArray(raw)) return { ok: false, errors: ['response is not a JSON array'], topics: [] }
  const errors: string[] = []
  if (raw.length !== postCount) errors.push(`expected ${postCount} topics, got ${raw.length}`)
  const ids = new Set<string>()
  for (const topic of raw as Topic[]) {
    if (typeof topic?.id !== 'string') { errors.push('a topic is missing its id'); continue }
    if (ids.has(topic.id)) errors.push(`duplicate topic id '${topic.id}'`)
    ids.add(topic.id)
    for (const fid of topic.facts ?? []) if (!factIds.has(fid)) errors.push(`topic '${topic.id}' cites unknown fact id '${fid}'`)
  }
  return { ok: errors.length === 0, errors, topics: raw as Topic[] }
}

function buildTopicPlan(facts: Fact[], postCount: number): Topic[] {
  const factIds = new Set(facts.map(f => f.id))
  const prompt = buildTopicPlanPrompt(facts, postCount)

  let raw: unknown
  try { raw = extractJson(callClaude(prompt, 'topic-plan')) } catch (e) { raw = null; warnings.push(`topic plan parse failed: ${(e as Error).message}`) }
  let result = validateTopicPlan(raw, postCount, factIds)

  if (!result.ok) {
    console.log(`  topic plan invalid (${result.errors.join('; ')}) — retrying once`)
    retryCount++
    try { raw = extractJson(callClaude(prompt, 'topic-plan-retry')) } catch (e) { raw = null; warnings.push(`topic plan retry parse failed: ${(e as Error).message}`) }
    result = validateTopicPlan(raw, postCount, factIds)
    if (!result.ok) {
      console.error(`\nFATAL: topic plan invalid after retry: ${result.errors.join('; ')}`)
      process.exit(1)
    }
  }

  for (const t of result.topics) t.targetComments = Math.max(7, Math.min(20, Math.round(t.targetComments)))
  return result.topics
}

// ─── Step 5 — batches ─────────────────────────────────────────────────────────
function runBatches(topics: Topic[], facts: Fact[], pool: Record<string, Persona>, outPath: string): Post[] {
  const allPosts: Post[] = []
  const priorTitles: string[] = []
  const batches = chunk(topics, BATCH)

  const hasHandle = (handle: string): boolean => {
    const key = handle.toLowerCase()
    return Object.keys(pool).some(h => h.toLowerCase() === key)
  }

  batches.forEach((batchTopics, bi) => {
    const label = `batch-${bi + 1}`
    let lastRaw = ''

    const attempt = (failureReason?: string): { posts: Post[]; newPersonas?: Record<string, Persona> } => {
      const prompt = buildBatchPrompt(batchTopics, facts, Object.keys(pool), priorTitles, EXEMPLARS, failureReason)
      lastRaw = callClaude(prompt, failureReason ? `${label}-retry` : label)
      const parsed = extractJson(lastRaw)
      if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as { posts?: unknown }).posts)) {
        throw new Error('batch response is missing a "posts" array')
      }
      return parsed as { posts: Post[]; newPersonas?: Record<string, Persona> }
    }

    const process1 = (r: { posts: Post[]; newPersonas?: Record<string, Persona> }): string[] => {
      const cap = 2 * batchTopics.length
      let added = 0
      if (r.newPersonas) {
        for (const [handle, persona] of Object.entries(r.newPersonas)) {
          if (added >= cap) break
          if (hasHandle(handle)) continue
          pool[handle] = persona
          added++
        }
      }
      const escaped = r.posts.map(p => escapeContent(p))
      const { errors } = validatePosts(escaped, pool)
      if (errors.length === 0) {
        allPosts.push(...escaped)
        priorTitles.push(...escaped.map(p => p.title))
      }
      return errors
    }

    let errors: string[]
    try {
      errors = process1(attempt())
    } catch (e) {
      errors = [(e as Error).message]
    }

    if (errors.length > 0) {
      console.log(`  [${label}] validation failed (${errors.length} issue${errors.length === 1 ? '' : 's'}) — retrying once`)
      retryCount++
      try {
        errors = process1(attempt(errors.join('; ')))
      } catch (e) {
        errors = [(e as Error).message]
      }

      if (errors.length > 0) {
        const failPath = `${outPath}.failed-${label}.txt`
        writeFileSync(failPath, lastRaw, 'utf-8')
        console.error(`\nFATAL: ${label} failed validation after one retry:`)
        for (const e of errors) console.error(`  - ${e}`)
        console.error(`Raw output written to ${failPath}\n`)
        process.exit(1)
      }
    }
  })

  return allPosts
}

// ─── Step 6 — final assembly ──────────────────────────────────────────────────
function countCommentsDeep(comments: Comment[]): number {
  let n = 0
  for (const c of comments) { n++; n += countCommentsDeep(c.replies) }
  return n
}

function assembleAndWrite(posts: Post[], pool: Record<string, Persona>, outPath: string): Record<string, Persona> {
  const { errors, warnings: finalWarnings } = validatePosts(posts, pool)
  warnings.push(...finalWarnings)
  if (errors.length > 0) {
    console.error('\nFATAL: final cross-batch validation failed:')
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }

  const usedAuthors = new Set<string>()
  const walk = (comments: Comment[]): void => { for (const c of comments) { usedAuthors.add(c.author); walk(c.replies) } }
  for (const p of posts) { usedAuthors.add(p.author); walk(p.comments) }
  const usedPersonas: Record<string, Persona> = {}
  for (const author of usedAuthors) if (pool[author]) usedPersonas[author] = pool[author]

  const shell = readFileSync(new URL('./shopTalkShell.html', import.meta.url), 'utf-8')
  const personaMarker = '__PERSONAS_JSON__'
  const postsMarker = '__POSTS_JSON__'
  const personaHits = (shell.match(new RegExp(personaMarker, 'g')) ?? []).length
  const postsHits = (shell.match(new RegExp(postsMarker, 'g')) ?? []).length
  if (personaHits !== 1 || postsHits !== 1) {
    console.error(`\nFATAL: shopTalkShell.html markers malformed (personas marker x${personaHits}, posts marker x${postsHits}, expected 1 each)`)
    process.exit(1)
  }

  let html = shell.split(personaMarker).join(JSON.stringify(usedPersonas, null, 2))
  html = html.split(postsMarker).join(JSON.stringify(posts, null, 2))

  mkdirSync(dirname(resolve(outPath)), { recursive: true })
  writeFileSync(outPath, html, 'utf-8')
  return usedPersonas
}

// ─── Final stdout report ──────────────────────────────────────────────────────
function printFinalReport(outPath: string, posts: Post[], usedPersonas: Record<string, Persona>): void {
  const totalComments = posts.reduce((sum, p) => sum + countCommentsDeep(p.comments), 0)
  const fileSizeKb = statSync(outPath).size / 1024
  const wallClockSec = (Date.now() - wallClockStart) / 1000
  const latencies = callLog.map(c => c.elapsedSec).sort((a, b) => a - b)
  const min = latencies[0] ?? 0
  const max = latencies[latencies.length - 1] ?? 0
  const median = latencies.length ? latencies[Math.floor(latencies.length / 2)] : 0

  console.log(`\n${'='.repeat(78)}`)
  console.log('gen-shop-talk — final report')
  console.log('='.repeat(78))
  console.log(`Output:           ${outPath}`)
  console.log(`File size:        ${fileSizeKb.toFixed(1)} KB`)
  console.log(`Posts written:    ${posts.length}`)
  console.log(`Personas used:    ${Object.keys(usedPersonas).length}`)
  console.log(`Total comments:   ${totalComments}`)
  console.log(`Sim wall-clock:   ${simSeconds.toFixed(1)}s`)
  console.log(`claude calls:     ${callLog.length}`)
  console.log(`Total wall-clock: ${wallClockSec.toFixed(1)}s`)
  console.log(`Per-call latency: min ${min.toFixed(1)}s / median ${median.toFixed(1)}s / max ${max.toFixed(1)}s`)
  console.log(`Retries:          ${retryCount}`)
  if (warnings.length > 0) {
    console.log(`Warnings (${warnings.length}):`)
    for (const w of warnings) console.log(`  - ${w}`)
  } else {
    console.log('Warnings:         none')
  }
  console.log('='.repeat(78))
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const facts = getFacts()

if (DRY_RUN) {
  runDryRun(facts)
  process.exit(0)
}

console.log(`\nBuilding persona pool for ${POSTS} posts...`)
const pool = buildPersonaPool(POSTS)
console.log(`Persona pool: ${Object.keys(pool).length} handles`)

console.log(`\nPlanning ${POSTS} topics...`)
const topics = buildTopicPlan(facts, POSTS)
console.log(`Topic plan: ${topics.length} topics`)

console.log(`\nGenerating posts in batches of ${BATCH}...`)
const posts = runBatches(topics, facts, pool, OUT)
console.log(`Generated ${posts.length} posts`)

console.log('\nAssembling final HTML...')
const usedPersonas = assembleAndWrite(posts, pool, OUT)

printFinalReport(OUT, posts, usedPersonas)
console.log(`\nWrote ${OUT}`)
