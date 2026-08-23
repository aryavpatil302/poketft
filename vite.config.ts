import { defineConfig } from 'vite'
import fs   from 'node:fs'
import path from 'node:path'
import { isValidRoomHost } from './src/net/lobbyUrl'

const ROOT = process.cwd()

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'test'
}

function toCamel(slug: string): string {
  return slug.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'party/**/*.test.ts'],
  },

  plugins: [
    // Trust boundary (T-05-02 / T-05-03): every VITE_-prefixed variable is
    // inlined verbatim into a world-readable bundle, and the room host this one
    // carries becomes the origin of the wss: connection every client opens.
    // Validating it here turns two silent production failures — an unset value
    // shipping a bundle that points at localhost, and a malformed value
    // restructuring the socket URL — into a red terminal at deploy time.
    //
    // `apply: 'build'` is load-bearing: vitest loads this same config file under
    // the serve command, and the guard must never gate the test suite.
    //
    // `buildStart` rather than a later hook so the failure lands before bundling
    // and the negative cases return in well under a second.
    //
    // isValidRoomHost is imported from src/net/lobbyUrl.ts rather than restated
    // here — ONE validator, TWO callers, so the guard and the client can never
    // disagree about what a valid room host looks like.
    {
      name: 'require-room-host',
      apply: 'build',

      buildStart() {
        const configured = process.env.VITE_PARTY_HOST

        if (!configured) {
          throw new Error(
            'VITE_PARTY_HOST is required for a production build, and is unset.\n' +
            '  It is baked into the bundle as the PartyKit room host every client connects to.\n' +
            '  Without it the shipped client silently falls back to localhost and no remote\n' +
            '  player can connect.\n' +
            '  Expected: a bare host with an optional port — no scheme, no trailing slash.\n' +
            '  Example:  VITE_PARTY_HOST=poketft.someuser.partykit.dev npx vite build\n' +
            '  See DEPLOY.md.',
          )
        }

        if (!isValidRoomHost(configured)) {
          throw new Error(
            `VITE_PARTY_HOST is malformed: "${configured}"\n` +
            '  It is baked into the bundle as the PartyKit room host every client connects to,\n' +
            '  and partysocket adds its own scheme and /parties/main/<room> path.\n' +
            '  Expected: a bare host with an optional port — no scheme, no trailing slash, no\n' +
            '  path segment, no whitespace, no uppercase, no underscores.\n' +
            '  Example:  VITE_PARTY_HOST=poketft.someuser.partykit.dev npx vite build\n' +
            '  See DEPLOY.md.',
          )
        }
      },
    },

    {
      name: 'save-test-to-repo',

      configureServer(server) {
        server.middlewares.use('/api/save-test', (req, res) => {
          if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }

          let body = ''
          req.on('data', (chunk: Buffer) => { body += chunk.toString() })
          req.on('end', () => {
            try {
              const scenario: { label: string; units: unknown[] } = JSON.parse(body)
              const slug    = slugify(scenario.label)
              let varName   = toCamel(slug)

              // Find a unique filename
              const testsDir = path.join(ROOT, 'tests')
              let filename   = `${slug}.json`
              let n          = 2
              while (fs.existsSync(path.join(testsDir, filename))) {
                filename = `${slug}-${n++}.json`
                varName  = toCamel(slug) + (n - 1)
              }

              // 1. Write the JSON file
              fs.writeFileSync(
                path.join(testsDir, filename),
                JSON.stringify(scenario, null, 2) + '\n',
              )

              // 2. Patch src/repoTests.ts between the AUTO marker comments
              const repoPath = path.join(ROOT, 'src', 'repoTests.ts')
              let src        = fs.readFileSync(repoPath, 'utf8')

              const importLine = `import ${varName} from '../tests/${filename}'`

              // Guard: skip if already imported (re-save of same label)
              if (!src.includes(`'../tests/${filename}'`)) {
                src = src.replace(
                  '// AUTO-IMPORTS-END',
                  `${importLine}\n// AUTO-IMPORTS-END`,
                )
                src = src.replace(
                  '  // AUTO-LIST-END',
                  `  ${varName},\n  // AUTO-LIST-END`,
                )
                fs.writeFileSync(repoPath, src)
              }

              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: true, filename }))
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: false, error: String(err) }))
            }
          })
        })
      },
    },

    {
      name: 'trait-diagram-api',

      configureServer(server) {
        // GET: current units + traits, loaded live through Vite's own
        // transform pipeline so it's always in sync with the TS source
        // (no separate parser to keep in sync).
        server.middlewares.use('/api/trait-diagram-data', async (req, res) => {
          if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }
          try {
            const unitsMod  = await server.ssrLoadModule('/src/data/units.ts')
            const traitsMod = await server.ssrLoadModule('/src/data/traits.ts')
            const units = (unitsMod.ALL_UNITS as Array<{
              id: string; name: string; cost: number; types: string[]; spritePath: string; isDummy?: boolean
            }>)
              .filter(u => !u.isDummy && u.cost > 0)
              .map(u => ({ id: u.id, name: u.name, cost: u.cost, types: u.types, spritePath: u.spritePath }))
            const traits = (traitsMod.ALL_TRAITS as Array<{ id: string; name: string }>)
              .map(t => ({ id: t.id, name: t.name }))
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ units, traits }))
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: String(err) }))
          }
        })

        // POST { traits: { [unitId]: string[] } }: rewrite each named unit's
        // `types: [...]` line in src/data/units.ts in place. Units not in the
        // payload (dummies, summons, anything the diagram didn't send) are
        // left untouched. Line-based rather than a full AST rewrite so
        // comments/formatting elsewhere in the file survive untouched.
        server.middlewares.use('/api/save-traits', (req, res) => {
          if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }

          let body = ''
          req.on('data', (chunk: Buffer) => { body += chunk.toString() })
          req.on('end', () => {
            try {
              const payload: { traits: Record<string, string[]> } = JSON.parse(body)
              const unitsPath = path.join(ROOT, 'src', 'data', 'units.ts')
              const lines = fs.readFileSync(unitsPath, 'utf8').split('\n')

              let currentUnitId: string | null = null
              let changed = 0
              for (let i = 0; i < lines.length; i++) {
                const idMatch = lines[i].match(/^\s*id:\s*'([^']+)',?\s*$/)
                if (idMatch) { currentUnitId = idMatch[1]; continue }

                const typesMatch = lines[i].match(/^(\s*types:\s*\[)[^\]]*(\],?\s*)$/)
                if (typesMatch && currentUnitId && payload.traits[currentUnitId]) {
                  const newTypes = payload.traits[currentUnitId].map(t => `'${t}'`).join(', ')
                  lines[i] = `${typesMatch[1]}${newTypes}${typesMatch[2]}`
                  changed++
                  currentUnitId = null   // one types: line per unit block
                }
              }

              if (changed === 0) throw new Error('No matching units found to update — is the file format unchanged?')

              fs.writeFileSync(unitsPath, lines.join('\n'))
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: true, changed }))
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: false, error: String(err) }))
            }
          })
        })
      },
    },
  ],
})
