// The single HTML-escaping chokepoint for every screen this app renders
// through innerHTML.
//
// Both of Phase 4's new screens (titleScreen.ts, lobbyScreen.ts) build their
// markup as template strings assigned to innerHTML, and two of the values
// they interpolate originate OUTSIDE this module: a seat's display name,
// which a connecting client supplied as its `?name=` query parameter, and
// the shareable lobby URL, which is derived from the address bar. Routing
// both through here is what keeps them inert text rather than markup.
//
// `party/seats.ts`'s sanitizeDisplayName already strips angle brackets on the
// server, but that is a SERVER-SIDE control and does not relieve the client
// of escaping: the client does not get to assume the server sanitised for it
// (a version-skewed room, a proxy, or a hand-rolled client speaking the same
// protocol are all things this browser cannot verify). See T-04-07/T-04-08.

// `&` MUST be replaced first. Doing it later would re-escape the ampersands
// that the other four replacements just introduced, turning `<` into
// `&amp;lt;` instead of `&lt;`.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
