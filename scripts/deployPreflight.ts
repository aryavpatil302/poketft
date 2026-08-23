// Every deploy check that can be made WITHOUT a credential, in one command:
// `npm run deploy:preflight`. Run this before `npx partykit login` — anything
// that fails here would also fail after deploying, just far more expensively.
//
// What it does NOT do: it never logs in, never deploys, and never contacts
// PartyKit's or Netlify's API. Those steps are human-only and live in
// DEPLOY.md. Check 4 is the credential-free STAND-IN for `partykit deploy` —
// it bundles the room through the same workerd pipeline a deploy uses, so it
// catches a broken import or a malformed partykit.json, but it cannot see an
// account-side or name-collision problem.
//
// Safe to run repeatedly. It writes only the gitignored `dist-verify/` and
// removes it again on the way out, including on the failure path. It never
// renames, moves or deletes a tracked file, even transiently, so an aborted
// run cannot leave the repo broken — in particular it never edits
// partykit.json, netlify.toml or package.json.
//
// ONE tracked file does change as a side effect, and it is not this script's
// doing: check 2 runs vitest, and vitest rewrites its own result cache at
// `node_modules/.vite/vitest/results.json`, which this repo tracks (it sits
// under the committed node_modules tree and no .gitignore rule covers it).
// That is local cache state in the same class as the already-ignored
// `node_modules/.mf/`, not a meaningful change — `git checkout --
// node_modules/.vite/vitest/results.json` discards it. Untracking it properly
// is deliberately left out of scope here.

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ─── Baselines ────────────────────────────────────────────────────────────────

// Pre-existing type debt in src/core/ and src/sim/, unrelated to deployment
// and out of scope for Phase 5. A clean `tsc` exit is NOT achievable today, so
// the gate is a ceiling plus a path filter: the ceiling makes a regression
// visible, the path filter keeps THIS phase's own surfaces strictly clean.
const TSC_ERROR_BASELINE = 16
const SCOPED_CLEAN_PATHS = /^(src\/net|party|scripts)\//

// The scoped test gate. The FULL suite is deliberately not used: it carries 24
// pre-existing failures across 9 gameplay/econ files (abomasnow, ribombee,
// vikavolt, cavecrawler, mystic, bots, constants, income), none of them in
// src/net/ or party/. Gating on it would make preflight permanently red for
// reasons this phase neither caused nor can fix.
const TEST_SCOPE = ['src/net', 'party']

// Reserved TLD (RFC 2606) — it can never resolve to a real host, so baking it
// into a probe build is inert even if that build were somehow served.
const PROBE_HOST = 'deploy-probe.invalid'

const PLACEHOLDER_HOST = 'REPLACE_ME_AFTER_PARTYKIT_DEPLOY'
const VERIFY_DIR = 'dist-verify'

// Netlify rejects any single file above this at upload. Current reality for
// context: public/visuals is ~83 MB across 332 files with the largest ~11 MB,
// so this has room to spare — the check exists to catch a FUTURE asset that
// would otherwise be silently refused.
const MAX_FILE_BYTES = 100 * 1024 * 1024

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Same idiom as scripts/roomSmoke.ts: throw on failure, log `OK:` on success,
// so preflight's output reads like the rest of this repo's verification
// scripts.
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`)
  console.log(`OK: ${message}`)
}

function heading(text: string): void {
  console.log(`\n── ${text} ${'─'.repeat(Math.max(0, 74 - text.length))}`)
}

interface RunResult {
  status: number
  output: string
}

// `env` entries set to undefined are DELETED from the child's environment
// rather than passed as the string "undefined" — that distinction is the
// whole point of check 5's unset case.
function run(command: string, args: string[], env: Record<string, string | undefined> = {}): RunResult {
  const childEnv: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) childEnv[key] = value
  }
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete childEnv[key]
    else childEnv[key] = value
  }

  const result = spawnSync(command, args, { encoding: 'utf8', env: childEnv, shell: false })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  return { status: result.status ?? 1, output }
}

function buildInto(host: string | undefined): RunResult {
  return run(
    'npx',
    ['vite', 'build', '--outDir', VERIFY_DIR, '--emptyOutDir', '--logLevel', 'error'],
    { VITE_PARTY_HOST: host },
  )
}

function walkFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...walkFiles(full))
    else if (entry.isFile()) found.push(full)
  }
  return found
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Checks ───────────────────────────────────────────────────────────────────

function checkTypes(): void {
  heading('1/7  Types, against a baseline')
  const { output } = run('npx', ['tsc', '--noEmit'])
  const errorLines = output.split('\n').filter(line => line.includes('error TS'))
  const scoped = errorLines.filter(line => SCOPED_CLEAN_PATHS.test(line.trim()))

  assert(
    scoped.length === 0,
    `zero tsc errors in src/net/, party/ or scripts/ (found ${scoped.length})`,
  )
  assert(
    errorLines.length <= TSC_ERROR_BASELINE,
    `tsc errors within the ${TSC_ERROR_BASELINE}-error baseline (found ${errorLines.length})`,
  )

  // A silently over-generous baseline stops catching anything, so say so
  // loudly rather than quietly banking the improvement.
  if (errorLines.length < TSC_ERROR_BASELINE) {
    console.log(
      `NOTE: only ${errorLines.length} tsc errors remain, below the ${TSC_ERROR_BASELINE} baseline. ` +
      `Someone paid down type debt — lower TSC_ERROR_BASELINE in this file to ${errorLines.length} ` +
      'so the gate keeps its teeth.',
    )
  }
}

function checkScopedTests(): void {
  heading('2/7  Unit suite, scoped to this phase\'s surfaces')
  const { status } = run('npx', ['vitest', 'run', ...TEST_SCOPE], { VITE_PARTY_HOST: undefined })
  assert(status === 0, `npx vitest run ${TEST_SCOPE.join(' ')} exits 0`)
  console.log(
    'NOTE: the full suite is intentionally NOT a gate — it has 24 pre-existing failures in ' +
    'gameplay/econ files, none in src/net/ or party/.',
  )
}

function checkDependencyFreeze(): void {
  heading('3/7  Dependency freeze')
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }

  const deps = Object.keys(pkg.dependencies ?? {})
  assert(
    deps.length === 1 && deps[0] === 'partysocket',
    `dependencies is exactly ["partysocket"] (found [${deps.join(', ')}])`,
  )

  // The deploy CLIs are run through npx by a human at deploy time. A
  // once-per-deploy tool has no business in the install graph of everyone who
  // clones this repo (threat T-05-06).
  const devDeps = Object.keys(pkg.devDependencies ?? {})
  const deployClis = devDeps.filter(name => /netlify|vercel|wrangler/.test(name))
  assert(
    deployClis.length === 0,
    `no deploy CLI entered devDependencies (found [${deployClis.join(', ')}])`,
  )
}

function checkRoomBundle(): void {
  heading('4/7  Room config and Workers bundle')
  const { status, output } = run('npm', ['run', 'room:smoke'])
  if (status !== 0) {
    console.error(output)
  }
  assert(status === 0, 'npm run room:smoke passes — partykit.json loads and party/lobby.ts bundles under workerd')
  console.log(
    'NOTE: this does NOT contact PartyKit\'s API. It cannot detect an account-side problem, a ' +
    'name collision, or anything else that only fails against the live service.',
  )
}

function checkBuildGuardNegative(): void {
  heading('5/7  Build guard, negative')

  const unset = buildInto(undefined)
  assert(unset.status !== 0, 'a build with VITE_PARTY_HOST absent exits NONZERO')
  assert(
    unset.output.includes('VITE_PARTY_HOST'),
    'the unset failure names VITE_PARTY_HOST so the message is actionable',
  )

  const placeholder = buildInto(PLACEHOLDER_HOST)
  assert(
    placeholder.status !== 0,
    `a build with netlify.toml's ${PLACEHOLDER_HOST} placeholder exits NONZERO — it cannot ship`,
  )
}

function checkBuildGuardPositive(): void {
  heading('6/7  Build guard, positive — and the host actually binds')

  const built = buildInto(PROBE_HOST)
  if (built.status !== 0) {
    console.error(built.output)
  }
  assert(built.status === 0, `a build with VITE_PARTY_HOST=${PROBE_HOST} exits 0`)

  const assetsDir = join(VERIFY_DIR, 'assets')
  assert(existsSync(assetsDir), `${assetsDir} was emitted`)

  // The check that would have caught the aliasing defect Plan 05-01 fixed: it
  // reads the SHIPPED artifact rather than trusting that Vite substituted the
  // env read. This is what proves DEPLOY-02's "points its client transport at
  // the deployed room endpoint" for real.
  const carriesHost = walkFiles(assetsDir).some(file => readFileSync(file, 'utf8').includes(PROBE_HOST))
  assert(carriesHost, `the emitted bundle contains the literal "${PROBE_HOST}" — the host is baked in, not read at runtime`)
}

function checkPayload(): void {
  heading('7/7  Payload report')
  const files = walkFiles(VERIFY_DIR)
  let total = 0
  let largest = { path: '', bytes: 0 }

  for (const file of files) {
    const bytes = statSync(file).size
    total += bytes
    if (bytes > largest.bytes) largest = { path: file, bytes }
  }

  console.log(`INFO: ${files.length} files, ${formatMb(total)} total`)
  console.log(`INFO: largest file is ${largest.path} at ${formatMb(largest.bytes)}`)
  assert(
    largest.bytes <= MAX_FILE_BYTES,
    `no single file exceeds Netlify's ${formatMb(MAX_FILE_BYTES)} per-file ceiling`,
  )
}

// ─── Entry point ──────────────────────────────────────────────────────────────

function printManualSteps(): void {
  console.log('\n══ Everything above is done. What remains is HUMAN-ONLY ═══════════════════════')
  console.log('These cannot be run by an agent or by this script — two of them require an')
  console.log('interactive browser login. Full detail, in order, is in DEPLOY.md:')
  console.log('  1. `npx partykit login`          — interactive GitHub OAuth')
  console.log('  2. `npx partykit deploy`         — publishes the room; copy the host it prints')
  console.log('  3. Set VITE_PARTY_HOST to that host, then build and deploy the frontend')
  console.log('  4. The cross-network round with a friend (DEPLOY-03) — a person on a second')
  console.log('     device on a different network; no test in this repo covers it')
  console.log('\nSee DEPLOY.md.')
}

function main(): void {
  try {
    // Start from a clean directory so check 6's bundle grep can never match a
    // stale artifact left by an earlier run.
    rmSync(VERIFY_DIR, { recursive: true, force: true })

    checkTypes()
    checkScopedTests()
    checkDependencyFreeze()
    checkRoomBundle()
    checkBuildGuardNegative()
    checkBuildGuardPositive()
    checkPayload()

    console.log('\ndeployPreflight: all credential-free checks passed')
    printManualSteps()
  } finally {
    // On the failure path too: a failed preflight must not leave the largest
    // directory in the repo sitting there.
    rmSync(VERIFY_DIR, { recursive: true, force: true })
  }
}

try {
  main()
  process.exit(0)
} catch (err) {
  console.error(`\n${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
}
