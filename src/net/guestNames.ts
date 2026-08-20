// Cosmetic-only display names for a human seat in a lobby, in the same
// spirit as src/econ/botNames.ts's HUMAN_CHARACTER_NAMES: purely UI
// labelling, never read by any scoring, matchmaking or persistence code.
// There are no accounts, nothing survives a page reload, and there is no
// uniqueness guarantee beyond "looks reasonable for two people in a lobby"
// (04-UI-SPEC.md §Naming for a joining guest explicitly says not to
// over-engineer this).
//
// The one property that IS load-bearing: this pool must stay disjoint from
// the bot pools — both PERSONAS[].name in src/econ/bots.ts and
// HUMAN_CHARACTER_NAMES in src/econ/botNames.ts — so a human seat in the
// "Current players" list is never mistaken for one of the five AI opponents.
// guestNames.test.ts asserts that against the real lists.
//
// Note what is NOT here: Blue, Red, Green. 04-UI-SPEC.md's example list names
// them, but HUMAN_CHARACTER_NAMES already uses all three as trainer names
// (Blue, Red, Green and Leaf are Kanto rivals), so using them would break the
// disjointness the same spec asks for. The pool is colour words that no bot
// answers to.
export const GUEST_NAMES: readonly string[] = [
  'Amber', 'Teal', 'Coral', 'Indigo', 'Violet', 'Crimson',
  'Cobalt', 'Jade', 'Magenta', 'Saffron', 'Cyan', 'Olive',
]

// rng is a parameter (defaulting to Math.random) so the pick is testable
// without stubbing a global — the same shape newLobbyCode() and
// pickRandomNames() already use.
export function pickGuestName(rng: () => number = Math.random): string {
  // The modulo is a guard, not arithmetic: an rng returning exactly 1.0 would
  // otherwise index one past the end and hand a literal `undefined` to the
  // lobby list. Same reasoning as newLobbyCode() in lobbyUrl.ts.
  const index = Math.floor(rng() * GUEST_NAMES.length) % GUEST_NAMES.length
  return GUEST_NAMES[index]
}
