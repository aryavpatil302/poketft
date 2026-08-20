---
phase: 04-client-networking-lobby-ui
plan: 02
subsystem: client-ui
tags: [dom-overlay, lobby, title-screen, clipboard, xss-escaping, partykit]

# Dependency graph
requires:
  - phase: 04-client-networking-lobby-ui plan 01
    provides: "src/net/roomClient.ts (RoomClient), src/net/lobbyUrl.ts (newLobbyCode/parseLobbyCode/shareableLobbyUrl/partyHost), protocol's 'lobby' phase and {t:'start'}, party/lobby.ts's host-gated start, src/main.ts's net/applyServerSnapshot/bootNetworked/setNetStatusBanner, scripts/netClient.ts"
  - phase: 03-partykit-room-server plan 03
    provides: "party/seats.ts lobbyView() producing LobbySeatView[] with live `human` occupancy"
provides:
  - "src/ui/escapeHtml.ts — escapeHtml(value); the single HTML-escape chokepoint for every innerHTML-rendered screen"
  - "src/ui/screenChrome.ts — screenRootCss(), screenHeaderHtml(idPrefix), wireLogoFallback(root, idPrefix), screenButtonCss(), wireButtonFeedback(btn), fadeScreenIn(el), fadeScreenOut(el), SCREEN_* palette constants"
  - "src/ui/titleScreen.ts — TitleScreenHandlers, showTitleScreen(handlers), hideTitleScreen(), isTitleScreenVisible(); DOM ids title-screen, btn-title-solo, btn-title-multiplayer, btn-title-tutorial, btn-title-cheatsheet"
  - "src/ui/lobbyScreen.ts — LobbyScreenProps, LobbyScreenView, showLobbyScreen(props), updateLobbyScreen(view), setLobbyMessage(text), hideLobbyScreen(), isLobbyScreenVisible(); DOM ids lobby-screen, lobby-link-bar, lobby-players, btn-lobby-start, lobby-message"
  - "src/net/guestNames.ts — GUEST_NAMES, pickGuestName(rng?)"
  - "src/main.ts (extended) — bootSolo(), onMultiplayer(), the Title-Screen boot router, bootNetworked(code, {isHost}) with its full Lobby Screen lifecycle"
  - "scripts/netClient.ts — scenarios 8 (seat list liveness) and 9 (host-gated dismissal), 9 scenarios total"
affects:
  - "Plans 04-03/04-04 (full action dispatch) — the game view is now entered through the Lobby Screen's dismissal rather than at module scope; nothing about the action path changed"
  - "Plan 04-05 (server-driven countdown) — econPhase is set to 'planning' by the `phase` broadcast handler, which is where the server deadline will be read from"
  - "Phase 5 (deployment) — shareableLobbyUrl(location.origin, code) means the deployed origin is picked up with no config; VITE_PARTY_HOST still governs the room host separately"
  - "Any future Tutorial / Cheat Sheet phase — btn-title-tutorial and btn-title-cheatsheet already render and are wired to explicit no-ops"

# Actuals (#2632)
actuals:
  tokens: 11900
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Full-page screens live on document.body at z-index 500, never inside #app, for the same reason 04-01's network banner does: renderEconUI()/updateEconVisibility() rebuild #app subtrees wholesale and would tear a screen out from under the player."
    - "The server's broadcast is the ONLY thing that dismisses a screen. The host's Start button sends a frame and nothing else; both tabs leave the lobby on the resulting `phase` message. A local dismissal would let host and guest drift out of step by exactly one round-trip."
    - "isHost is a hint the welcome frame CORRECTS. The URL alone cannot say who created a room, so a refreshed host re-enters as a guest and is promoted when the server hands seat 0 back. That is also why the flag is never treated as authority — party/lobby.ts rejects a non-seat-0 `start` with 'not-host' regardless."
    - "escapeHtml is a module, not an inline regex, so both screens share one implementation and one place to reason about ordering (& first). The client escapes independently of party/seats.ts's sanitizeDisplayName — a server-side control does not relieve the client."
    - "Two full-page screens with identical chrome share screenChrome.ts rather than duplicating it, because the logo has runtime FALLBACK behaviour (the asset is missing from the repo) and duplicated behaviour drifts."

key-files:
  created:
    - src/ui/escapeHtml.ts
    - src/ui/escapeHtml.test.ts
    - src/ui/screenChrome.ts
    - src/ui/titleScreen.ts
    - src/ui/lobbyScreen.ts
    - src/net/guestNames.ts
    - src/net/guestNames.test.ts
  modified:
    - src/main.ts
    - scripts/netClient.ts
    - .planning/phases/04-client-networking-lobby-ui/deferred-items.md

key-decisions:
  - "public/visuals/gui icons/Logo.png DOES NOT EXIST in this repo. The spec names it as the logo for both screens; `find . -iname '*logo*'` returns nothing. Rather than render a broken-image glyph on the first screen a player ever sees, screenChrome.ts keeps the src pointing at the spec'd path and swaps in a CSS-styled `PokeTFT` wordmark on error. Dropping the real file in later is the entire fix, with no code change."
  - "GUEST_NAMES deliberately omits Blue, Red and Green — the spec's own example words. All three are already in HUMAN_CHARACTER_NAMES as Kanto rival names, so using them would break the disjointness the same spec requires. guestNames.test.ts asserts disjointness against the REAL PERSONAS and HUMAN_CHARACTER_NAMES arrays, so this cannot silently regress."
  - "A fourth module, src/ui/screenChrome.ts, was added beyond the plan's file list. The two screens are specified as visually identical above the fold and the logo fallback is real behaviour; writing it twice would have guaranteed drift. Overlay creation and document.body.appendChild stay in each screen module so each file still reads as its own complete lifecycle (and so the plan's greps still hold)."
  - "bootNetworked's `isHost` is corrected from welcome.seat rather than trusted from the caller. Without this a host who refreshes their own tab would come back through the `?lobby=` branch as a guest and lose the Start button forever — the plan's own idempotent-refresh must_have would have been half-met."
  - "netClient scenarios 8-9 run against a FRESH room id inside the second withRoom() call rather than a third partykit spawn. Scenarios 1-7 leave their room mid-game, and a started room can never produce the pre-Start behaviour these two assert; a new Durable Object id is a new room at zero extra process cost."
  - "npx tsc --noEmit and npm test still do not exit 0 on this repo and did not before this plan (16 pre-existing tsc errors, 23 failing tests, all in ability/econ files). Verified scoped-clean instead, exactly as 04-01 did."

requirements-completed: [NET-03, NET-04]

coverage:
  - id: D1
    description: "escapeHtml renders every HTML-significant character inert, escapes & first so an already-escaped entity is not double-decoded, and passes a plain display name and a lobby URL through unchanged (T-04-07, T-04-08)"
    requirement: "NET-04"
    verification:
      - kind: unit
        ref: "src/ui/escapeHtml.test.ts — 6 tests incl. a script-tag payload and an attribute-breakout payload"
        status: pass
    human_judgment: false
  - id: D2
    description: "The guest-name pool is disjoint from both bot name pools (PERSONAS[].name and HUMAN_CHARACTER_NAMES) case-insensitively, has >= 8 short single-word entries, and pickGuestName never returns undefined for any rng output including a degenerate 1.0"
    requirement: "NET-04"
    verification:
      - kind: unit
        ref: "src/net/guestNames.test.ts — 10 tests, disjointness asserted against the real imported arrays"
        status: pass
    human_judgment: false
  - id: D3
    description: "A room nobody has started reports phase 'lobby'; the first client's welcome.lobby names exactly one human seat at seat 0; a second client's connect produces a `lobby` broadcast to the FIRST client naming seats 0 and 1 in ascending order; that client's disconnect produces a further broadcast back down to one — the exact data the 'Current players' list is a pure function of, live in both directions with no polling"
    requirement: "NET-04"
    verification:
      - kind: e2e
        ref: "scripts/netClient.ts — scenario 8 (seat list liveness)"
        status: pass
    human_judgment: false
  - id: D4
    description: "After the host's sendStart(), BOTH connections receive a `phase` message with phase 'planning' and the SAME round — the single shared signal both Lobby Screens dismiss on (neither dismisses on a local click)"
    requirement: "NET-03"
    verification:
      - kind: e2e
        ref: "scripts/netClient.ts — scenario 9 (host-gated dismissal)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A `start` from a seat other than 0 is rejected 'not-host' and leaves the room in 'lobby' — so the client-side isHost flag is a UI hint only and a guest forcing the button in devtools changes nothing (T-04-09)"
    requirement: "NET-03"
    verification:
      - kind: e2e
        ref: "scripts/netClient.ts — scenario 2 (host-gated start), inherited from 04-01 and re-run green here"
        status: pass
    human_judgment: false
  - id: D6
    description: "A connection to a full lobby is rejected 'not-seated' rather than hanging; src/main.ts turns that into a setLobbyMessage explanation with the Lobby Screen left up, never a fall-through to solo and never a blank screen (HARD-03)"
    requirement: "NET-04"
    verification:
      - kind: e2e
        ref: "scripts/netClient.ts — scenario 7 (full lobby) proves the wire half"
        status: pass
      - kind: manual
        ref: "Manual checklist item M8 — the rendered refusal text on the Lobby Screen"
        status: deferred
    human_judgment: true
  - id: D7
    description: "The Title Screen renders over the game before any state is visible, with the beach background, logo/subtitle and a 2x2 button grid; Tutorial and Cheat Sheet render and do nothing; Start Solo Game dismisses it into today's unchanged solo economy game"
    requirement: "NET-03"
    verification:
      - kind: manual
        ref: "Manual checklist items M1-M3"
        status: deferred
      - kind: static
        ref: "bootSolo() contains the previous boot block's statements verbatim (initFreshRun / enterGameOver / startPlanningPhase(false) / updateEconVisibility); verified by diff, not by re-derivation"
        status: pass
    human_judgment: true
  - id: D8
    description: "Start Multiplayer Game mints a code, writes ?lobby=<code> into the URL via history.replaceState, and shows the Lobby Screen with the full shareable link; clicking the bar copies it with a ~1.5s 'Copied!' flash"
    requirement: "NET-03"
    verification:
      - kind: manual
        ref: "Manual checklist items M4-M5"
        status: deferred
    human_judgment: true
  - id: D9
    description: "Clicking Start Multiplayer Game twice, or refreshing a tab that already carries ?lobby=<code>, reconnects to the SAME room and never mints a second orphan code — the URL's code is the sole source of truth for which room the tab belongs to (T-04-11)"
    requirement: "NET-03"
    verification:
      - kind: static
        ref: "onMultiplayer() returns early on `net !== null` OR `parseLobbyCode(location.search) !== null`; the boot router reads the URL before anything else"
        status: pass
      - kind: manual
        ref: "Manual checklist item M9"
        status: deferred
    human_judgment: true

duration: 55min
completed: 2026-08-19
status: complete
---

# Phase 4 Plan 2: Title Screen & Lobby Screen Summary

**The app no longer boots straight into a game: it opens on a Title Screen whose Start Multiplayer Game button mints a lobby code, writes it into the URL as the room's identity, and hands the host a copyable link — and a friend opening that link lands directly on a Lobby Screen that shows them appearing live in the host's player list, until the host's Start moves the room out of phase `'lobby'` and dismisses BOTH tabs on the same server broadcast.**

## Performance

- **Duration:** ~55 min (across one API-limit interruption between Tasks 2 and 3)
- **Tasks:** 3
- **Commits:** 4
- **Files:** 9 changed (7 created, 2 modified), 949 insertions, 21 deletions

## Task Commits

1. **Task 1: The Title Screen gates the boot** — `99a6361` (feat)
2. **Task 2 (RED): failing test for the cosmetic guest-name pool** — `1efc786` (test)
3. **Task 2 (GREEN): the guest-name pool and the Lobby Screen** — `793bd68` (feat)
4. **Task 3: Create, share, join — the full lobby flow end to end** — `f04bac3` (feat)

## Accomplishments

### Task 1 — the boot is gated, and the solo path is unchanged behind it

- **`src/ui/escapeHtml.ts`** — one function, one job, and a header comment stating why it exists: every value the two new screens interpolate into `innerHTML` that came from outside the module (a seat's display name, which a connecting client supplied as its `?name=` query; the shareable URL, derived from the address bar) goes through it. `&` is replaced first, and the test asserts that ordering property specifically (`escapeHtml('&lt;')` → `&amp;lt;`) because getting it backwards is the classic way an escaper silently stops working.
- **`src/ui/screenChrome.ts`** — the chrome both screens share: the `pixel_beach.png` backdrop (the same one `#layout` already uses, so the screens sit on the art the game itself opens onto), the logo, the `Isle Of Imagination` subtitle done in pure CSS (`-webkit-text-stroke` plus a layered `text-shadow` in `#1a3a7a` over `#f0c95c`), the blue/black/yellow button styling, and `fadeScreenIn`/`fadeScreenOut` mirroring `tooltipFadeIn`/`tooltipHide`'s restart-the-transition trick.
- **`src/ui/titleScreen.ts`** — a `div#title-screen` on `document.body` at z-index 500 (clearing the highest existing overlay, 201 on the held-item cursor, without colliding with the 9999 network banner, which must stay readable *on top of* a screen), holding a 2x2 CSS grid of the four spec'd buttons. Tutorial and Cheat Sheet are wired to explicit no-op handlers with a comment naming §Explicitly Out of Scope — they render so that the 2x2 layout is the *real* layout a later phase drops content into.
- **`src/main.ts`** — the old module-scope boot block was **moved verbatim** into `bootSolo()` (a move, not a rewrite: `initFreshRun` / `enterGameOver` / `startPlanningPhase(false)` / `updateEconVisibility` in the same order under the same conditions), and the boot router now reads `parseLobbyCode(location.search)` first. `requestAnimationFrame(frame)` still fires unconditionally in both branches, so the canvas is warm behind the overlay and dismissing a screen reveals a live board rather than a first frame.

### Task 2 — the pool and the screen

- **`src/net/guestNames.ts`** — 12 colour words, and the interesting part is what is *absent*. The spec's own example list starts "Blue, Red, Green"; all three are already Kanto rival names in `HUMAN_CHARACTER_NAMES`, so using them would have broken the disjointness the same spec asks for. `guestNames.test.ts` imports the real `PERSONAS` and `HUMAN_CHARACTER_NAMES` arrays rather than copies, so adding a persona or trainer name that collides breaks the test instead of silently making a human seat read as a bot.
- **`src/ui/lobbyScreen.ts`** — DOM only, no networking, and **no logging statements at all**: the shareable link is a bearer capability (anyone holding it can take a seat), so it never reaches developer output or any sink a future error reporter attaches (T-04-10). The link bar is entirely clickable (not just the icon), uses an inline-SVG copy glyph because `public/visuals/gui icons/` has none, and flashes `Copied!` for 1500 ms **on success and failure alike** — a clipboard write can be refused for reasons the player cannot act on (insecure origin, denied permission, no Clipboard API), and a bar that silently does nothing reads as a broken button. `updateLobbyScreen` filters to `human` seats, sorts by `seat`, numbers by *position* in the filtered list, and is a no-op before `showLobbyScreen` has ever run because it is driven by server broadcasts whose timing this client does not control.

### Task 3 — the seven flow steps actually run

- `onMultiplayer()` mints a code, `history.replaceState`s it into the address bar, and returns early on `net !== null` **or** on the URL already carrying a code — so double-clicking cannot spawn orphan rooms and a refresh reconnects (T-04-11).
- `bootNetworked(code, { isHost })` shows the Lobby Screen **before** connecting, so the host has a link to copy during the handshake and a guest never stares at a blank page.
- The `phase === 'planning'` handler is **the single dismissal path for both tabs**. The Start button only calls `net?.sendStart()`; nothing dismisses on a local click.
- `scripts/netClient.ts` grew scenarios 8 and 9, run against a fresh never-started room id on the same server process. Together they assert the exact wire data the Lobby Screen is a pure function of — which, in a repo with no browser automation, is as close to proving the screen as automation can get.

## Automated verification — what actually passes

Run from the worktree at commit `f04bac3`:

| Check | Result |
|-------|--------|
| `npx vitest run src/ui` | **PASS** — 6/6 (`escapeHtml`) |
| `npx vitest run src/net/guestNames` | **PASS** — 10/10, incl. disjointness against the real `PERSONAS` and `HUMAN_CHARACTER_NAMES` |
| `npx vitest run src/ui src/net` | **PASS** — 82/82 across 7 files |
| `npm run net:client` | **PASS, exit 0** — 9 scenarios, final line `netClient: all assertions passed across 9 scenario(s)` |
| `npx vite build` | **PASS** — 412 modules transformed, bundle emitted |
| `npx tsc --noEmit`, scoped | **CLEAN** — zero errors in `src/ui/`, `src/net/`, `src/main.ts`, `scripts/`, `party/` |
| `npx vitest run` (whole repo) | 23 failed / 1327 passed — **all pre-existing**, none in this plan's surface (see below) |
| `npx tsc --noEmit` (whole repo) | 16 errors — **all pre-existing**, none in this plan's surface |
| `npm run build` | **FAILS** — it is `tsc && vite build`, and `tsc` hits the 16 pre-existing errors. See "Deliberate departures" below. |

The 23 whole-repo test failures are in `cavecrawler`, `mystic`, `ribombee`, `abomasnow`, `bots`, `constants`, `income`, `xp` and `generator` — the same cluster `deferred-items.md` recorded during 04-01 (which counted 24; one has since been fixed on `master`). None of those suites import anything under `src/ui/`, `src/net/`, `party/` or `scripts/`.

**Acceptance-criteria greps, all satisfied:**

```
grep -c "btn-title-*"          src/ui/titleScreen.ts   -> 8   (>= 4 required)
grep -n "document.body.appendChild" src/ui/titleScreen.ts -> line 48
grep -c "getElementById('app')"     src/ui/titleScreen.ts -> 0
grep -n "function bootSolo"    src/main.ts             -> line 4960
grep -c "escapeHtml"           src/ui/lobbyScreen.ts   -> 3   (>= 2 required)
grep -c "console"              src/ui/lobbyScreen.ts   -> 0
grep -n "s.human"              src/ui/lobbyScreen.ts   -> line 238
grep -n "sort"                 src/ui/lobbyScreen.ts   -> line 238
grep -c "btn-lobby-start"      src/ui/lobbyScreen.ts   -> 2   (>= 1, inside the isHost branch)
grep -n "history.replaceState" src/main.ts             -> line 5036
grep -n "parseLobbyCode"       src/main.ts             -> lines 5033 (guard) and 5045 (router)
grep -c "hideLobbyScreen"      src/main.ts             -> 3   (>= 2 required)
grep -n "pickGuestName"        src/main.ts             -> line 2087
tracer's immediate sendStart after welcome             -> ABSENT
```

## Manual verification checklist (REQUIRED — this repo has no browser automation)

Everything below is DOM/visual behaviour. **No automated coverage exists for any of it** — Selenium is installed for `e2e/features/` ability tests only, and nothing drives these screens. A human must run these.

**Setup — two terminals, both from the repo root:**

```bash
npm run room:dev     # terminal 1 — partykit dev on :1999
npm run dev          # terminal 2 — vite on :5173
```

Then open `http://localhost:5173/` in **tab 1**.

| # | Step | Expected |
|---|------|----------|
| **M1** | Load `http://localhost:5173/` (no query param) | A full-page Title Screen covers everything. Beach background. `Isle Of Imagination` in yellow with a blue outline below the logo area. Four buttons in a 2x2 grid: Start Solo Game (top-left), Start Multiplayer Game (top-right), Tutorial (bottom-left), Cheat Sheet (bottom-right) — blue fill, black border, bold yellow text. **Known:** `Logo.png` is missing from the repo, so a CSS `PokeTFT` wordmark renders in its place. That is the intended fallback, not a bug — see `deferred-items.md`. |
| **M2** | Click **Tutorial**, then **Cheat Sheet** | Both visibly depress and do **nothing** — no navigation, no panel, no console error. |
| **M3** | Click **Start Solo Game** | The overlay fades out (~300 ms) and today's solo economy game is underneath and fully playable: shop rolls, gold/XP, bench, drag to board, Start, combat resolves. **This is the regression that matters** — compare against `master` if anything feels different. No socket is opened (check devtools Network → WS is empty). |
| **M4** | Reload to the Title Screen, click **Start Multiplayer Game** | The address bar gains `?lobby=<6 chars>`. The Lobby Screen appears with the same background/logo/subtitle. The link bar shows the **full** `http://localhost:5173/?lobby=<code>`. "Current players" reads `1. You` (You in yellow). A **Start** button is present. |
| **M5** | Click anywhere on the blue link bar | The URL text fades to `Copied!`, holds ~1.5 s, then fades back to the URL. Paste somewhere to confirm the clipboard actually holds the full link. (Also try clicking the copy icon specifically — same behaviour.) |
| **M6** | Paste the link into **tab 2** | Tab 2 **skips the Title Screen entirely** and lands on the Lobby Screen. It shows `Waiting for host to start...` where tab 1 has a Start button — **no Start button for the guest**. |
| **M7** | Look back at **tab 1** without touching it | The list has grown to `1. You  2. <ColourWord>` **live, with no refresh**. The colour word must be one of Amber/Teal/Coral/Indigo/Violet/Crimson/Cobalt/Jade/Magenta/Saffron/Cyan/Olive — **never** a bot persona (Rilla the Reroller, Kass the Climber, Echo, Brick, Vex) and never a trainer name (Ash, Misty, Blue, Red, ...). Then **close tab 2** and confirm tab 1's list shrinks back to `1. You` on its own. |
| **M8** | Re-open tab 2 on the link, then open the same link in **5 more tabs** (6 seats total occupied), then a 7th | The 7th tab keeps the Lobby Screen up and shows a red message line reading "This lobby is full — every seat is already taken. Ask your friend to start a new one, or reload to try again." **Not** a blank screen, and **not** a fall-through into a solo game. |
| **M9** | Back on tab 1 (host), press **F5** | The URL keeps the *same* `?lobby=<code>` — no new code is minted. The tab reconnects to the same room, and because the server hands seat 0 back, the **Start button reappears** (it does not come back as a guest). Also: click Start Multiplayer Game's page again from a `?lobby=` URL is impossible by construction, but confirm the code never changes. |
| **M10** | With tab 1 (host) and tab 2 (guest) both on the Lobby Screen, click **Start** in tab 1 | **BOTH** tabs leave the Lobby Screen into the game view at the same time. Neither leaves before the other by more than a frame — they dismiss on the server's `phase` broadcast, not on the click. |
| **M11** | Optional, carried over from 04-01's deferred list | Kill `npm run room:dev` while a lobby is open: the board freezes with the last server snapshot, a red banner appears, and Reroll is inert. |

If M1's background reads visibly worse than the mockup, `04-UI-SPEC.md` permits swapping to `beach background.jpg` — change the single `BACKGROUND_URL` constant at the top of `src/ui/screenChrome.ts` and both screens follow.

## Deviations from Plan

### Auto-fixed / resolved during execution

**1. [Rule 3 — Blocking] `public/visuals/gui icons/Logo.png` does not exist**
- **Found during:** Task 1, writing the header markup
- **Issue:** `04-UI-SPEC.md` and the plan both name this asset. `find . -iname "*logo*"` (excluding `node_modules`) returns nothing; `public/visuals/gui icons/` contains exactly three files, none of them a logo. A naive `img` would put a broken-image glyph on the first screen a player ever sees.
- **Why not just make one:** the spec says explicitly "do not spend time generating new art assets" and "do not attempt to generate new logo art".
- **Fix:** `src/ui/screenChrome.ts` keeps the `src` pointing at the spec'd path and attaches an `error` listener (plus a `complete && naturalWidth === 0` check for a cached 404) that swaps in a CSS-styled `PokeTFT` wordmark using the same yellow-on-blue-outline treatment as the subtitle. Dropping the real file in later is the entire fix, with no code change.
- **Files:** `src/ui/screenChrome.ts`
- **Committed in:** `99a6361`. Logged in `deferred-items.md` with an explicit action for the project owner.

**2. [Rule 2 — Missing critical functionality] `isHost` is corrected from the welcome frame**
- **Found during:** Task 3
- **Issue:** The plan passes `isHost: false` for the `?lobby=` boot branch. But a host who refreshes their own tab re-enters through exactly that branch — the URL cannot say who created the room. As literally specified, a refreshed host would lose the Start button permanently, and nobody could ever start that lobby. That directly contradicts the plan's own must_have that "refreshing a page that already carries `?lobby=<code>` reconnects to that same room".
- **Fix:** `bootNetworked` treats `opts.isHost` as the hint the plan says it is and re-renders the Start control when `welcome.seat === 0` disagrees with it. This makes the "the server is the authority" comment load-bearing rather than decorative.
- **Files:** `src/main.ts`
- **Committed in:** `f04bac3`

**3. [Rule 1 — Bug avoided] `GUEST_NAMES` cannot contain the spec's own example words**
- **Found during:** Task 2 (caught by the RED test, which is why it was written first)
- **Issue:** `04-UI-SPEC.md` suggests "Blue, Red, Green"; the plan repeats them. All three — plus Leaf and Silver — are already in `HUMAN_CHARACTER_NAMES` as Kanto rival names. Using them would have violated the disjointness requirement stated three lines later in the same document.
- **Fix:** The pool is 12 colour words none of the bots answer to. Disjointness is asserted against the real imported arrays.
- **Files:** `src/net/guestNames.ts`, `src/net/guestNames.test.ts`
- **Committed in:** `1efc786` / `793bd68`

### Deliberate departures

**4. A fourth module, `src/ui/screenChrome.ts`, beyond the plan's file list.** The two screens are specified as visually identical above the fold, and the logo now carries real runtime fallback behaviour (deviation 1). Writing that twice would have guaranteed drift the first time either screen was touched. Overlay creation and `document.body.appendChild` deliberately stayed in each screen module, so each file still reads as its own complete lifecycle — and so the plan's greps (`document.body.appendChild` in `titleScreen.ts`, zero `getElementById('app')`) still hold as written.

**5. `npm run build` cannot exit 0, and could not before this plan.** It is `tsc && vite build`, and `tsc` hits 16 pre-existing errors in ability/econ files this plan does not touch (three are genuine `'dead'`-comparison bugs). Per the executor scope boundary these were not fixed. Verified the two halves separately instead: `npx tsc --noEmit` is **zero-error across every directory this plan touches**, and `npx vite build` succeeds, proving the new modules bundle. This is the same departure 04-01 recorded, and `deferred-items.md` already carries the full table.

**6. `scripts/netClient.ts` reports 9 scenarios.** The plan's acceptance criterion asks that the final line's total match the scenarios actually defined; the script computes it rather than hardcoding it, so it does.

**7. `isLobbyScreenVisible()` exported beyond the plan's listed API.** Symmetry with `isTitleScreenVisible()`, which the plan does specify. Unused by `src/main.ts` today; it is the natural predicate a later plan reaches for and costs nothing.

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing-critical, 1 bug-avoided), 4 documented departures
**Impact on plan:** No scope creep. Deviations 1-3 each close a gap between the plan's literal text and its own `must_haves`.

## Known Stubs

| Stub | File | Location | Intentional? | Resolved by |
|------|------|----------|--------------|-------------|
| Tutorial button is a no-op | `src/ui/titleScreen.ts` | `showTitleScreen` | **Yes** — `04-UI-SPEC.md` §Explicitly Out of Scope names it | A future Tutorial phase |
| Cheat Sheet button is a no-op | `src/ui/titleScreen.ts` | `showTitleScreen` | **Yes** — same section | A future Cheat Sheet phase |
| Logo renders a CSS wordmark, not art | `src/ui/screenChrome.ts` | `LOGO_SRC` / `wireLogoFallback` | **Forced** — the asset is absent from the repo | Dropping `Logo.png` into `public/visuals/gui icons/`; no code change |

None prevent this plan's goal. The first two are stated by the spec as deliberate; the third is a missing input, not missing work, and is logged in `deferred-items.md` with an owner action.

## Threat Flags

No new security-relevant surface beyond the plan's `<threat_model>`. Each disposition was implemented:

- **T-04-07 / T-04-08** — every `LobbySeatView.name` and the share URL pass through `escapeHtml` before `innerHTML`; `setLinkText()` is the single writer of the link bar's text so neither of its two callers can skip the escape.
- **T-04-09** — `isHost` decides only which control renders; `netClient.ts` scenario 2 re-asserts the server's `'not-host'` refusal.
- **T-04-10** — `grep -c "console" src/ui/lobbyScreen.ts` is 0.
- **T-04-11** — `onMultiplayer` returns early on either guard.
- **T-04-SC** — no package was installed; the copy icon is inline SVG.

## Issues Encountered

**One API-limit interruption between Tasks 2 and 3.** Work through `793bd68` was already committed; `scripts/netClient.ts` and `src/main.ts` carried uncommitted in-progress edits that were verified by diff and finished rather than redone.

**The port-1999 parallel-execution hazard did not reproduce.** `npm run net:client` passed on the default port across all 9 scenarios in a single run. The `deferred-items.md` entry stands as a latent hazard rather than an active one.

## User Setup Required

**Add `public/visuals/gui icons/Logo.png`.** Both new screens currently render a CSS wordmark fallback because the asset the spec names is not in the repo. No code change is needed once the file is dropped in.

Nothing else. No package installed, no environment variable required (`VITE_PARTY_HOST` remains optional until Phase 5; `partyHost()` falls back to `<page hostname>:1999`).

## Next Phase Readiness

- NET-03 and NET-04 are met on the wire and in code; what remains unverified is the browser rendering itself, captured above as M1-M11.
- Plans 04-03 / 04-04 can assume the game view is now entered through the Lobby Screen's `phase`-broadcast dismissal. Nothing about the action-dispatch path changed.
- Plan 04-05 will find `econPhase = 'planning'` already being set inside the `phase` handler — the natural place to read the server deadline from.
- No blockers.

---
*Phase: 04-client-networking-lobby-ui*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: src/ui/escapeHtml.ts
- FOUND: src/ui/escapeHtml.test.ts
- FOUND: src/ui/screenChrome.ts
- FOUND: src/ui/titleScreen.ts
- FOUND: src/ui/lobbyScreen.ts
- FOUND: src/net/guestNames.ts
- FOUND: src/net/guestNames.test.ts
- FOUND: src/main.ts (modified)
- FOUND: scripts/netClient.ts (modified)
- FOUND: .planning/phases/04-client-networking-lobby-ui/04-02-SUMMARY.md
- FOUND: .planning/phases/04-client-networking-lobby-ui/deferred-items.md (modified)
- FOUND commit: 99a6361 (Task 1)
- FOUND commit: 1efc786 (Task 2 RED)
- FOUND commit: 793bd68 (Task 2 GREEN)
- FOUND commit: f04bac3 (Task 3)
