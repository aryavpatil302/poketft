// Reusable automated verification plumbing: spawns and tears down a real
// `partykit dev` server so every plan in this phase has an automated,
// end-to-end verification path from Node.

import { spawn, type ChildProcess } from 'node:child_process'
import PartySocket from 'partysocket'

export const ROOM_PORT = Number(process.env.ROOM_PORT ?? 1999)

const HEALTHCHECK_POLL_MS = 250
const HEALTHCHECK_TIMEOUT_MS = 60_000

function healthcheckUrl(port: number): string {
  return `http://127.0.0.1:${port}/parties/main/healthcheck`
}

// Spawns `npx partykit dev --port <ROOM_PORT>`, polls the room's own
// onRequest handler (any room id works — `healthcheck` is just a name) until
// it answers or 60s elapse, runs `fn`, and always kills the child with
// SIGTERM in a finally block so a failing assertion never leaks a server
// process.
export async function withRoom<T>(fn: (ctx: { port: number; host: string }) => Promise<T>): Promise<T> {
  const port = ROOM_PORT
  const host = `127.0.0.1:${port}`
  let child: ChildProcess | null = null
  let stderr = ''

  try {
    child = spawn('npx', ['partykit', 'dev', '--port', String(port)], { stdio: 'pipe' })
    child.stderr?.on('data', chunk => { stderr += String(chunk) })
    child.stdout?.on('data', () => { /* drain, not needed for readiness */ })

    const deadline = Date.now() + HEALTHCHECK_TIMEOUT_MS
    let ready = false
    while (Date.now() < deadline) {
      try {
        const res = await fetch(healthcheckUrl(port))
        if (res.ok) { ready = true; break }
      } catch {
        // room not listening yet — keep polling
      }
      await new Promise(resolve => setTimeout(resolve, HEALTHCHECK_POLL_MS))
    }
    if (!ready) {
      throw new Error(`partykit dev did not become ready within ${HEALTHCHECK_TIMEOUT_MS}ms.\nCaptured stderr:\n${stderr}`)
    }

    return await fn({ port, host })
  } finally {
    if (child && !child.killed) child.kill('SIGTERM')
  }
}

// Thin partysocket wrapper. This project declares a single default party
// ("main", per partykit.json's top-level `main` field — see the HTTP route
// convention in 03-01-PLAN.md's interface_context). `name` is an optional
// query-string tag for a connecting client, not the party name.
export function connect(host: string, room: string, name?: string): PartySocket {
  return new PartySocket({ host, room, party: 'main', query: name ? { name } : undefined })
}

// Resolves on the first message satisfying `predicate`, rejects on timeout
// with the messages seen so far included in the error text — this is what
// makes a failing smoke run debuggable.
export function nextMessage<T>(sock: PartySocket, predicate: (m: any) => boolean, timeoutMs = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const seen: unknown[] = []
    const timer = setTimeout(() => {
      sock.removeEventListener('message', onMessage)
      reject(new Error(`nextMessage timed out after ${timeoutMs}ms. Messages seen: ${JSON.stringify(seen)}`))
    }, timeoutMs)

    function onMessage(event: MessageEvent): void {
      let parsed: unknown
      try {
        parsed = JSON.parse(String(event.data))
      } catch {
        return
      }
      seen.push(parsed)
      if (predicate(parsed)) {
        clearTimeout(timer)
        sock.removeEventListener('message', onMessage)
        resolve(parsed as T)
      }
    }

    sock.addEventListener('message', onMessage)
  })
}
