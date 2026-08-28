// ─── Combat vs. planning view resolvers ───────────────────────────────────────
//
// Two different questions were previously answered by the same fields:
// "who do I face next" (the pairing preview, driven by run.round / nextOpponent,
// which src/game/round.ts's resolveRound already advances past the fight that
// is currently playing) vs. "who am I watching right now" (the fight actually
// on screen). The state describing the current fight is captured at
// settlement time — by src/main.ts, into currentOpponentIndex and
// currentCombatRound — because round resolution has already moved the live
// state forward by the time combat playback starts. These two pure functions
// are the single place every render site asks the right question of the
// right fields, so the seat and round shown during combat can never drift
// back to matching the planning-phase preview by accident.

// Returns the seat this view should name, or -1 when there is nobody to show
// (a bye, a creep/item round, or an out-of-range/self-referential seat).
// Every negative value and every value equal to localSeat normalize to the
// same -1 sentinel, so callers only ever need to test for non-negative.
export function displayedOpponentSeat(
  inCombat: boolean,
  localSeat: number,
  nextOpponent: number | undefined,
  combatOpponentSeat: number,
): number {
  const raw = inCombat ? combatOpponentSeat : (nextOpponent ?? -1)
  return raw < 0 || raw === localSeat ? -1 : raw
}

// Returns the round this view should describe. Planning always shows the
// live round. Combat shows the round that was captured at settlement,
// falling back to the live round if nothing has been captured yet (before
// any settlement has ever happened) rather than rendering a nonsense stage.
export function displayedRound(
  inCombat: boolean,
  liveRound: number,
  combatRound: number,
): number {
  if (!inCombat) return liveRound
  return combatRound < 1 ? liveRound : combatRound
}
