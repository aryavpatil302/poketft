import { describe, it, expect } from 'vitest'
import { escapeContent, scanForbiddenStats, validatePosts, type Post, type Comment, type Persona } from './shopTalkValidate'
import ref from './shopTalkReference.json'

const REF = ref as { personas: Record<string, Persona>; posts: Post[] }

function walkComments(comments: Comment[], fn: (body: string) => void): void {
  for (const c of comments) { fn(c.body); walkComments(c.replies, fn) }
}

describe('shopTalkValidate', () => {
  // ─── Calibration: the known-good reference fixture must pass clean ──────────
  it('validatePosts returns zero errors on the golden reference fixture', () => {
    const { errors } = validatePosts(REF.posts, REF.personas)
    expect(errors).toEqual([])
  })

  it('scanForbiddenStats returns [] for every content string in the reference fixture', () => {
    for (const p of REF.posts) {
      expect(scanForbiddenStats(p.title), `post ${p.id} title`).toEqual([])
      for (const [i, b] of p.body.entries()) {
        expect(scanForbiddenStats(b), `post ${p.id} body[${i}]`).toEqual([])
      }
      walkComments(p.comments, body => {
        expect(scanForbiddenStats(body), `post ${p.id} comment body`).toEqual([])
      })
    }
  })

  // ─── Stage 2: forbidden patterns must catch every synthetic violation ───────
  it.each([
    "tangela wins 38% of its fights",
    "63% win rate across the board",
    "over 200 samples",
    "across 500 games",
    "n=240",
    "that's a 12 percentage point swing",
    "went 14 wins 6 losses",
    "its winrate is trash",
    "average 1840 damage per fight",
    "sample size is too small",
    "in 30 fights it never held",
    "picked 45 percent of the time",
  ])('scanForbiddenStats flags: %s', (text) => {
    expect(scanForbiddenStats(text).length).toBeGreaterThanOrEqual(1)
  })

  // ─── escapeContent ────────────────────────────────────────────────────────────
  it('escapeContent escapes & < > in order and leaves clean text untouched', () => {
    const post: Post = {
      id: 'esc-test', flair: 'test', author: 'a', minutesAgo: 5,
      title: 'shop & bench <b>', body: ['clean paragraph with no special chars at all here yes'],
      ups: 10, downs: 1,
      comments: [{ author: 'a', ups: 1, downs: 0, body: 'also & <i>nested</i>', replies: [] }],
    }
    const out = escapeContent(post)
    expect(out.title).toBe('shop &amp; bench &lt;b&gt;')
    expect(out.body[0]).toBe('clean paragraph with no special chars at all here yes')
    expect(out.comments[0].body).toBe('also &amp; &lt;i&gt;nested&lt;/i&gt;')
  })

  // ─── validatePosts: one synthetic violation per check ───────────────────────
  it('validatePosts catches an unknown comment author', () => {
    const posts = clonePosts()
    posts[0].comments[0].author = 'nobody-registered'
    const { errors } = validatePosts(posts, REF.personas)
    expect(errors.some(e => e.includes('nobody-registered'))).toBe(true)
  })

  it('validatePosts catches a post with only 1 nested thread', () => {
    const posts = clonePosts()
    // strip replies from all but one top-level comment
    let kept = false
    for (const c of posts[0].comments) {
      if (c.replies.length > 0) {
        if (!kept) { kept = true; continue }
        c.replies = []
      }
    }
    const { errors } = validatePosts(posts, REF.personas)
    expect(errors.some(e => e.includes('top-level comments have replies'))).toBe(true)
  })

  it('validatePosts catches a 4-deep nest', () => {
    const posts = clonePosts()
    const makeReply = (): Comment => ({
      author: posts[0].author, ups: 1, downs: 0,
      body: 'this is a synthetic nested reply for depth testing purposes only', replies: [],
    })
    let cursor = posts[0].comments[0]
    for (let i = 0; i < 3; i++) {
      if (cursor.replies.length === 0) cursor.replies.push(makeReply())
      cursor = cursor.replies[0]
    }
    const { errors } = validatePosts(posts, REF.personas)
    expect(errors.some(e => e.includes('nesting depth'))).toBe(true)
  })

  it('validatePosts catches minutesAgo: 0', () => {
    const posts = clonePosts()
    posts[0].minutesAgo = 0
    const { errors } = validatePosts(posts, REF.personas)
    expect(errors.some(e => e.includes('minutesAgo'))).toBe(true)
  })

  it('validatePosts catches an invalid persona color', () => {
    const personas = clonePersonas()
    const author = REF.posts[0].author
    personas[author] = { ...personas[author], color: 'red' }
    const { errors } = validatePosts(REF.posts, personas)
    expect(errors.some(e => e.includes('color') && e.includes(author))).toBe(true)
  })

  it('validatePosts catches an invalid persona avatar', () => {
    const personas = clonePersonas()
    const author = REF.posts[0].author
    personas[author] = { ...personas[author], avatar: 'ab' }
    const { errors } = validatePosts(REF.posts, personas)
    expect(errors.some(e => e.includes('invalid avatar'))).toBe(true)
  })
})

function clonePosts(): Post[] {
  return JSON.parse(JSON.stringify(REF.posts))
}
function clonePersonas(): Record<string, Persona> {
  return JSON.parse(JSON.stringify(REF.personas))
}
