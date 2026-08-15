// Shells out to the `claude` CLI (Claude Code) in non-interactive print mode
// (`claude -p "<prompt>"`) to turn a report's raw learned-affinity data into a
// plain-English summary of what training discovered. Reuses whatever login is
// already configured for the `claude` CLI on this machine — the same one used
// interactively — so no separate API key is needed. Opt-in only (see the
// --ai-summary flag on trainAll.ts / botLeague.ts); never throws, so a
// missing/unauthenticated CLI degrades to "summary skipped", not a crashed
// report.

import { spawnSync } from 'node:child_process'

export function generateAiSummary(prompt: string): string | null {
  const result = spawnSync('claude', ['-p', prompt], { encoding: 'utf-8', timeout: 180_000, maxBuffer: 10 * 1024 * 1024 })

  if (result.error) {
    console.log(`\n[AI summary skipped: could not run the \`claude\` CLI (${result.error.message}). Is it installed and on PATH?]`)
    return null
  }
  if (result.status !== 0) {
    const detail = (result.stderr ?? '').trim().slice(0, 300)
    console.log(`\n[AI summary skipped: \`claude\` exited with code ${result.status}${detail ? ` — ${detail}` : ''}]`)
    return null
  }
  const text = (result.stdout ?? '').trim()
  return text || null
}

// One row of learned-affinity data, already resolved to a human-readable
// label — shared shape between trainAll.ts's report and botLeague.ts's.
export interface SummaryRow { label: string; winRate: number; samples: number }
export interface SummarySection { title: string; preferred: SummaryRow[]; avoided: SummaryRow[] }

export function buildSummaryPrompt(intro: string, sections: SummarySection[]): string {
  const lines: string[] = [
    intro,
    'Write a concise, plain-English summary (under 250 words) of the most interesting and trustworthy discoveries below. ' +
    'Call out standout pairings/compositions by name. Weigh higher sample counts as more trustworthy than low ones — say so ' +
    'when a striking result has few samples. Synthesize into a short narrative a game designer would find useful; do not just ' +
    'restate the data as a list.',
    '',
  ]
  for (const s of sections) {
    if (s.preferred.length === 0 && s.avoided.length === 0) continue
    lines.push(`## ${s.title}`)
    if (s.preferred.length) {
      lines.push('Preferred:')
      for (const r of s.preferred.slice(0, 10)) lines.push(`- ${r.label}: ${(r.winRate * 100).toFixed(0)}% win rate (${r.samples} samples)`)
    }
    if (s.avoided.length) {
      lines.push('Avoided:')
      for (const r of s.avoided.slice(0, 10)) lines.push(`- ${r.label}: ${(r.winRate * 100).toFixed(0)}% win rate (${r.samples} samples)`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
