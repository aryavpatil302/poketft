// Cosmetic-only name bank — human Pokémon characters (trainers, gym leaders,
// rivals, protagonists), used purely as bots' DISPLAY names. Never read by any
// scoring/training/behavior code: personaId (see bots.ts's PERSONAS) is the
// real, stable identity everything else keys off, so swapping display names
// per game changes nothing about how a bot plays.
export const HUMAN_CHARACTER_NAMES: readonly string[] = [
  'Ash', 'Misty', 'Brock', 'May', 'Max', 'Dawn', 'Serena', 'Clemont', 'Bonnie', 'Iris',
  'Cilan', 'Cynthia', 'Lance', 'Steven', 'Wallace', 'Red', 'Blue', 'Green', 'Leaf', 'Silver',
  'Kris', 'Ethan', 'Lyra', 'Barry', 'Paul', 'Norman', 'Roxanne', 'Brawly', 'Wattson', 'Flannery',
  'Winona', 'Tate', 'Liza', 'Juan', 'Maxie', 'Archie', 'Cyrus', 'Ghetsis', 'N', 'Cheren',
  'Bianca', 'Hilbert', 'Hilda', 'Nate', 'Rosa', 'Calem', 'Elio', 'Selene', 'Victor', 'Gloria',
]

// Picks `count` distinct names at random (Fisher-Yates partial shuffle) — no
// two bots in the same game share a display name.
export function pickRandomNames(count: number, rng: () => number = Math.random): string[] {
  const pool = [...HUMAN_CHARACTER_NAMES]
  const n = Math.min(count, pool.length)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}
