// Mechanical safety net for the shop-talk generation pipeline (genShopTalk.ts).
// Pure functions only — no I/O, no spawning, no LLM — so this is the one part of
// the pipeline that can be tested deterministically. Two jobs: (1) escape content
// before it's injected raw into the shell's innerHTML, and (2) scan for/reject
// simulation-statistics leakage (win rates, sample counts, percentages about
// outcomes) while explicitly allowing game vocabulary that happens to carry
// digits (1-cost, 3-star, a real 1st, under 50% hp, turn 2, six-copy).

export interface Persona { name: string; avatar: string; color: string }
export interface Comment { author: string; ups: number; downs: number; body: string; replies: Comment[] }
export interface Post {
  id: string; flair: string; author: string; minutesAgo: number
  title: string; body: string[]; ups: number; downs: number; comments: Comment[]
}

// ─── escapeContent ─────────────────────────────────────────────────────────────
// The shell injects p.title / p.body[i] / comment.body raw into innerHTML with no
// escaping (see shopTalkShell.html's renderFeed/renderComments/openThread), so
// escaping here is both a rendering fix and a markup-injection guard. Order
// matters: & must go first or we'd double-escape the entities we just inserted.
function escapeStr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeComment(c: Comment): Comment {
  return { ...c, body: escapeStr(c.body), replies: c.replies.map(escapeComment) }
}

export function escapeContent(p: Post): Post {
  return {
    ...p,
    title: escapeStr(p.title),
    body: p.body.map(escapeStr),
    comments: p.comments.map(escapeComment),
  }
}

// ─── scanForbiddenStats ─────────────────────────────────────────────────────────
// Digits are legal game vocabulary (1-cost, 3-star, a real 1st, turn 2, under 50%
// hp) — banning all digits would be wrong. What's actually banned is *simulation
// statistics* (win rates, sample counts, percentages about outcomes). Two stages:
// first blank out every allowed span (so it can't false-positive downstream),
// then scan what survives for forbidden patterns.

// Stage 1 — allowed game-vocabulary spans. Blanked with same-length spaces (not
// literally single spaces) so a percentage match later in the string keeps its
// original character offset — required for Stage 1b's proximity window, which
// reads the ORIGINAL text.
const STAGE1_PATTERNS: RegExp[] = [
  /\b\d+\s*-?\s*(cost|star)s?\b/gi,
  /\d+★/g,
  /\b([1-8])(st|nd|rd|th)\b/gi,
  /\btop-?\s*[1-8]\b/gi,
  /\b(turn|round|stage|level|lvl)\s*\d+\b/gi,
  /\b\d+\s*(copies|copy|units?|traits?|breakpoints?|slots?|items?|gold|hexes?)\b/gi,
]

// Stage 1b — a percentage is legal when it's describing a mechanic threshold
// (hp/mana/shield/damage/etc.), not an outcome statistic. "second at 30%" passes
// because "60% hp" sits in its ±60-char window; "38% of its fights" does not.
const PCT_PROXIMITY_WORDS = /hp|health|mana|shield|damage|dmg|amp|crit|resist|armor|attack speed|heal/i
const PCT_RE = /\d+\s*%/g

// Stage 2 — forbidden patterns on whatever survives Stage 1 + 1b.
const STAGE2_PATTERNS: RegExp[] = [
  /\b(win ?rate|winrate|pick ?rate|top-?2 ?rate|placement rate|sample size|sample count|data ?set)\b/i,
  /\bn\s*=\s*\d+/i,
  /\b\d+\s*(samples?|data ?points?|games?|fights?|matches?|runs?|sims?|simulations?|wins?|losses?|lobbies)\b/i,
  /\b(across|over|out of|in)\s+\d+\b/i,
  /\d+\s*(percent|percentage points?|pp)\b/i,
  /\d+\s*%/,   // any percentage that failed the Stage 1b proximity check
  /\b(avg|average|mean|median)\s+(of\s+)?\d+/i,
  /\b\d+(\.\d+)?\s*(avg|average|mean|median)\b/i,
]

function blank(text: string, re: RegExp): string {
  return text.replace(re, m => ' '.repeat(m.length))
}

export function scanForbiddenStats(text: string): string[] {
  let working = text
  for (const re of STAGE1_PATTERNS) working = blank(working, re)

  // Stage 1b: locate remaining % matches, check proximity against the ORIGINAL
  // text (offsets align 1:1 with `working` because Stage 1 blanking preserves length).
  const toBlank: [number, number][] = []
  let pm: RegExpExecArray | null
  const pctScan = new RegExp(PCT_RE.source, PCT_RE.flags)
  while ((pm = pctScan.exec(working))) {
    const start = pm.index
    const end = start + pm[0].length
    const window = text.slice(Math.max(0, start - 60), Math.min(text.length, end + 60))
    if (PCT_PROXIMITY_WORDS.test(window)) toBlank.push([start, end])
  }
  for (const [s, e] of toBlank) working = working.slice(0, s) + ' '.repeat(e - s) + working.slice(e)

  // Stage 2
  const hits: string[] = []
  for (const re of STAGE2_PATTERNS) {
    const flags = re.flags.includes('g') ? re.flags : re.flags + 'g'
    const gre = new RegExp(re.source, flags)
    let mm: RegExpExecArray | null
    while ((mm = gre.exec(working))) {
      hits.push(`forbidden stat pattern ${re.toString()} matched "${mm[0]}"`)
      if (mm[0].length === 0) gre.lastIndex++   // guard against zero-width infinite loop
    }
  }
  return hits
}

// ─── validatePosts ──────────────────────────────────────────────────────────────
function countComments(comments: Comment[]): number {
  let n = 0
  for (const c of comments) { n++; n += countComments(c.replies) }
  return n
}

function maxDepth(comments: Comment[], d = 1): number {
  let m = 0
  for (const c of comments) {
    m = Math.max(m, d)
    if (c.replies.length) m = Math.max(m, maxDepth(c.replies, d + 1))
  }
  return m
}

// A standard Unicode "keycap digit" emoji (e.g. "1️⃣" = U+0031 U+FE0F U+20E3) is a
// bona fide emoji, not a typed-out digit — the reference fixture's "onecopyenjoyer"
// persona legitimately uses one. Exempt keycap sequences from the alnum-content ban.
const KEYCAP_EMOJI_RE = /^[0-9#*]️?⃣$/

export function validatePosts(
  posts: Post[],
  personas: Record<string, Persona>
): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  const seenIds = new Set<string>()
  const authorSlotCounts = new Map<string, number>()
  const allAuthors = new Set<string>()
  let totalSlots = 0

  const bumpSlot = (author: string): void => {
    authorSlotCounts.set(author, (authorSlotCounts.get(author) ?? 0) + 1)
    allAuthors.add(author)
    totalSlots++
  }

  for (const p of posts) {
    if (seenIds.has(p.id)) errors.push(`post '${p.id}': duplicate id`)
    seenIds.add(p.id)
    if (!/^[a-z0-9][a-z0-9-]{2,48}$/.test(p.id)) errors.push(`post '${p.id}': id does not match /^[a-z0-9][a-z0-9-]{2,48}$/`)

    if (!/^[a-z][a-z0-9_]{1,24}$/.test(p.flair)) errors.push(`post '${p.id}': flair '${p.flair}' does not match /^[a-z][a-z0-9_]{1,24}$/`)

    if (!personas[p.author]) errors.push(`post '${p.id}': author '${p.author}' missing from personas`)
    bumpSlot(p.author)

    if (p.title.length < 10 || p.title.length > 200) errors.push(`post '${p.id}' title: length ${p.title.length} outside 10-200`)
    for (const hit of scanForbiddenStats(p.title)) errors.push(`post '${p.id}' title: ${hit}`)

    if (!Array.isArray(p.body) || p.body.length < 1 || p.body.length > 5) {
      errors.push(`post '${p.id}': body must be an array of 1-5 strings, got ${Array.isArray(p.body) ? p.body.length : typeof p.body}`)
    } else {
      p.body.forEach((b, i) => {
        if (typeof b !== 'string' || b.length < 20 || b.length > 1200) {
          errors.push(`post '${p.id}' body[${i}]: length ${typeof b === 'string' ? b.length : typeof b} outside 20-1200`)
        }
        for (const hit of scanForbiddenStats(b)) errors.push(`post '${p.id}' body[${i}]: ${hit}`)
      })
    }

    const comments = p.comments ?? []
    const total = countComments(comments)
    if (total < 5 || total > 26) errors.push(`post '${p.id}': comment count ${total} outside 5-26`)

    const topWithReplies = comments.filter(c => c.replies && c.replies.length >= 1).length
    if (topWithReplies < 2) errors.push(`post '${p.id}': only ${topWithReplies} top-level comments have replies (rule #4 requires >= 2)`)

    const depth = maxDepth(comments)
    if (depth > 3) errors.push(`post '${p.id}': max comment nesting depth ${depth} exceeds 3`)

    if (!Number.isInteger(p.ups) || p.ups < 1 || p.ups > 500) errors.push(`post '${p.id}': ups ${p.ups} outside 1-500`)
    if (!Number.isInteger(p.downs) || p.downs < 0 || p.downs > 200) errors.push(`post '${p.id}': downs ${p.downs} outside 0-200`)
    if (!Number.isInteger(p.minutesAgo) || p.minutesAgo < 1 || p.minutesAgo > 10080) errors.push(`post '${p.id}': minutesAgo ${p.minutesAgo} outside 1-10080`)

    const threadCounts = new Map<string, number>()
    const walk = (list: Comment[], path: string): void => {
      list.forEach((c, i) => {
        const cpath = `${path}[${i}]`
        if (!personas[c.author]) errors.push(`post '${p.id}' ${cpath}.author: '${c.author}' missing from personas`)
        bumpSlot(c.author)
        threadCounts.set(c.author, (threadCounts.get(c.author) ?? 0) + 1)
        for (const hit of scanForbiddenStats(c.body)) errors.push(`post '${p.id}' ${cpath}.body: ${hit}`)
        if (c.replies && c.replies.length) walk(c.replies, `${cpath}.replies`)
      })
    }
    walk(comments, 'comment')

    for (const [author, count] of threadCounts) {
      if (count > 4) warnings.push(`post '${p.id}': persona '${author}' appears ${count} times in this thread (>4, ${author === p.author ? 'OP' : 'non-OP'})`)
    }
  }

  for (const [author, count] of authorSlotCounts) {
    const pct = count / totalSlots
    if (pct > 0.12) warnings.push(`persona '${author}' holds ${(pct * 100).toFixed(1)}% of all author slots (>12%)`)
  }

  for (const author of allAuthors) {
    const persona = personas[author]
    if (!persona) continue   // already reported as a missing-author error above
    if (!/^#[0-9a-f]{6}$/i.test(persona.color)) errors.push(`persona '${author}': color '${persona.color}' does not match /^#[0-9a-f]{6}$/i`)
    const avatarCodePoints = [...persona.avatar].length
    const isKeycapEmoji = KEYCAP_EMOJI_RE.test(persona.avatar)
    if (!persona.avatar || avatarCodePoints > 4 || (!isKeycapEmoji && /[A-Za-z0-9]/.test(persona.avatar))) {
      errors.push(`persona '${author}': invalid avatar '${persona.avatar}'`)
    }
    if (!persona.name) errors.push(`persona '${author}': empty name`)
  }

  if (allAuthors.size < posts.length * 1.5) {
    warnings.push(`author pool size ${allAuthors.size} is below posts.length * 1.5 (${posts.length * 1.5})`)
  }

  return { errors, warnings }
}
