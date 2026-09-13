// Pure prompt construction for the shop-talk generation pipeline — no spawning,
// no I/O. genShopTalk.ts (the orchestrator) feeds these builders grounded facts,
// the handle roster, and the two fixture exemplars (read once from
// shopTalkReference.json) and gets back a finished prompt string to hand to
// `claude -p`. Every prompt ends with an explicit machine-parseable-output
// instruction so extractJson() has the best chance of a clean parse.

import type { Fact } from './shopTalkDigest'
import type { Post, Persona } from './shopTalkValidate'
import { digestText } from './shopTalkDigest'
import referenceFixture from './shopTalkReference.json'

const REFERENCE = referenceFixture as { personas: Record<string, Persona>; posts: Post[] }

const RETURN_OBJECT = 'Return ONLY a single JSON object. No prose, no explanation, no markdown code fences.'
const RETURN_ARRAY = 'Return ONLY a single JSON array. No prose, no explanation, no markdown code fences.'

// ─── CONTENT_RULES ──────────────────────────────────────────────────────────────
// The session's accumulated ruleset, embedded verbatim in every generation
// prompt. Restated in full each time (not summarized/paraphrased) so the model
// never has to infer what a shorthand reference meant.
export const CONTENT_RULES = `Content rules — follow every one of these exactly:

1. Never quote simulation statistics in dialogue. No win rates, no percentages about
   outcomes, no sample counts, no game counts, no "across N games", no "n=". The
   numbers in the grounding facts below are for YOU, to decide what the sentiment
   should be. A poster expresses them anecdotally/experientially: "every time I
   lean on X lately I lose that fight", "played a stupid number of games this
   stretch and I can't remember it losing". Game vocabulary with digits is fine and
   encouraged (1-cost, 3-star, a real 1st, under 50% hp, turn 2, six-copy) — it's
   STATISTICS that are banned, not digits.
2. This is hundreds of anonymous strangers, not a friend group. No recurring
   in-jokes between the same handles. No persona may reference having talked to
   another persona before, or reference another thread. Nobody recognizes anybody.
3. Real personality and gamer-speak, distinct per handle — analytical (calc_this),
   tilted (ProbablyTilted), copium, meme energy, deadpan, smug narrow-build purist.
   Handles look like real usernames: calc_this, TangelaTruther, DoomPoster9000,
   itsalwaystangela. Never generic (user1, player_two). Lowercase-sloppy typing is
   in character for some handles.
4. Every post needs real nested reply threads: at least 2 top-level comments must
   have someone replying to them (depth 2). Depth 3 is allowed, never deeper.
5. Comment counts scale with how contentious/engaged the topic is: 7-18 normally,
   up to 20 on the biggest topics. Use the targetComments from the topic plan.
6. Flair maps to the real signal behind the post — simbatch for "just finished a
   stretch of games" posts, otherwise topic-specific (jungle, shiny, cave_crawler,
   a species name, econ, positioning). New flairs are fine; the page auto-colors
   and humanizes unregistered ones.
7. Plain text only in title / body / comment body — no HTML tags, no markdown, no
   entities.`

// ─── Persona pool ───────────────────────────────────────────────────────────────
function pickExamplePersonas(personas: Record<string, Persona>, keys: string[]): Record<string, Persona> {
  const out: Record<string, Persona> = {}
  for (const k of keys) if (personas[k]) out[k] = personas[k]
  return out
}

// Six handles chosen for archetype spread (analytical, tilted, meme, deadpan,
// measured, loud) — see rule 3 above. Pulled from the checked-in reference
// fixture, not passed in, to keep the exported signature matching the plan.
const EXAMPLE_PERSONA_KEYS = ['calc_this', 'ProbablyTilted', 'VolcanoSimp', 'quietanalyst', 'patientgamer', 'loudcarrymain']

export function buildPersonaPrompt(count: number, takenHandles: string[]): string {
  const examples = pickExamplePersonas(REFERENCE.personas, EXAMPLE_PERSONA_KEYS)
  const lines: string[] = [
    `Generate ${count} new persona handles for an anonymous Pokemon-autobattler community forum (like a subreddit).`,
    '',
    'Each handle maps to: { "name": string (must equal the handle/key exactly), "avatar": string (ONE emoji, nothing else), "color": string (#rrggbb hex) }.',
    '',
    'Do not reuse any of these already-taken handles:',
    takenHandles.length ? takenHandles.join(', ') : '(none yet)',
    '',
    'Demand a real spread of archetypes — see rule 3 below for the voice bar every handle must clear.',
    '',
    CONTENT_RULES,
    '',
    'Shape examples (from the community\'s existing persona pool — match this shape, not these specific handles):',
    JSON.stringify(examples, null, 2),
    '',
    `Output contract: a JSON object with exactly ${count} keys, one per new handle, each mapping to { "name", "avatar", "color" } as above.`,
    RETURN_OBJECT,
  ]
  return lines.join('\n')
}

// ─── Topic plan ─────────────────────────────────────────────────────────────────
export interface Topic {
  id: string
  flair: string
  angle: string
  facts: string[]
  targetComments: number
  minutesAgo: number
}

export function buildTopicPlanPrompt(facts: Fact[], postCount: number): string {
  const lines: string[] = [
    `Plan exactly ${postCount} distinct forum post topics for a Pokemon-autobattler community, grounded in the data below.`,
    '',
    'Grounding data (this run\'s simulation results — for your eyes only, see rule 1 below on how to translate these into posts):',
    digestText(facts),
    '',
    CONTENT_RULES,
    '',
    'Topic plan constraints:',
    '- Every topic id must be unique (kebab-case slug).',
    '- No two topics argue the same take — spread across different facts/angles.',
    '- Roughly 1 in 6 topics should be flaired "simbatch" (just finished a stretch of games) with minutesAgo clustered 560-760; spread the rest of the topics\' minutesAgo across 1-3600.',
    '- Cover BOTH directions: things overperforming and things underperforming — don\'t just pile on one side.',
    '- Spend some topics specifically on the shiny-by-stage facts — that data is new this run and underrepresented if ignored.',
    '',
    `Each topic: { "id": string (kebab slug), "flair": string, "angle": string (one sentence describing the take and its sentiment direction), "facts": string[] (1-3 fact ids like "F-07" this topic is grounded in), "targetComments": number (7-20), "minutesAgo": number }.`,
    `Output contract: a JSON array of exactly ${postCount} topic objects, in the shape above.`,
    RETURN_ARRAY,
  ]
  return lines.join('\n')
}

// ─── Batch generation ───────────────────────────────────────────────────────────
export function buildBatchPrompt(
  topics: Topic[],
  facts: Fact[],
  roster: string[],
  priorTitles: string[],
  examples: Post[],
  failureReason?: string
): string {
  const citedIds = new Set(topics.flatMap(t => t.facts))
  const citedFacts = facts.filter(f => citedIds.has(f.id))

  const lines: string[] = []
  if (failureReason) {
    lines.push(`Your previous response was rejected. Fix exactly this and return the same JSON shape: ${failureReason}`, '')
  }

  lines.push(
    'Write the forum posts (with full nested comment threads) for the topics below, for an anonymous Pokemon-autobattler community forum.',
    '',
    CONTENT_RULES,
    '',
    'Exemplars — this is exactly the shape, length, and voice to match:',
    JSON.stringify(examples, null, 2),
    '',
    'Grounding facts for THIS batch only (cite only what applies to each topic; do not invent numbers not listed here):',
    citedFacts.map(f => `${f.id}. ${f.text}`).join('\n'),
    '',
    'Handle roster — use these as post/comment authors:',
    roster.join(', '),
    '',
    'You may also introduce up to 2 new topic-specific handles per post if the joke demands it — return them in "newPersonas".',
    '',
    'Already-written titles — do not restate these takes:',
    priorTitles.length ? priorTitles.join('\n') : '(none yet)',
    '',
    'Topics for this batch:',
    JSON.stringify(topics, null, 2),
    '',
    'Output contract:',
    '{ "posts": [ /* one object per requested topic, same ids, full Post shape: id, flair, author, minutesAgo, title, body (string[]), ups, downs, comments (nested) */ ],',
    '  "newPersonas": { "handle": { "name": "handle", "avatar": "🌿", "color": "#3f8f4f" } } }',
    RETURN_OBJECT
  )
  return lines.join('\n')
}
