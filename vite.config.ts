import { defineConfig } from 'vite'
import fs   from 'node:fs'
import path from 'node:path'

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
    include: ['src/**/*.test.ts'],
  },

  plugins: [
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
  ],
})
