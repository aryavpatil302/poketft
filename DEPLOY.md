# Deploying pokeTFT

> **Every command in the Manual Steps section is run BY A HUMAN, at a terminal.**
> Two of them (`npx partykit login` and the Netlify login) open an interactive browser
> flow that cannot be automated, scripted, or completed by an agent.
> **Nothing in this file has been executed by an agent.** No credential for either
> service exists on this machine, and none appears anywhere in this repository.

---

## What gets deployed where

- **The authoritative room** — `party/lobby.ts`, the server that owns game state and
  arbitrates both players' actions — goes to **PartyKit**.
- **The built static frontend** — `dist/`, produced by Vite from `index.html` and
  `src/` — goes to **Netlify**.

These are two separate deploys, and **the room must go first**. The room's public
hostname is compiled *into* the frontend bundle at build time as `VITE_PARTY_HOST`;
it is not looked up at run time. A frontend built before the room exists has nothing
to bake in, and there is no way to fix that after the fact except by rebuilding.

---

## Before you start

You need **a PartyKit account** and **a Netlify account**. Neither CLI has ever been
authenticated on this machine — there is no `~/.partykit/config.json` — so expect both
logins to be first-time flows.

Neither CLI is a dependency of this repo, deliberately. Both are invoked through `npx`
at deploy time so that a tool used once per deploy does not land in the install graph
of everyone who clones the project. Do not `npm install` either one.

### The build command is `npx vite build`

Not the repo's `build` npm script. That script is `tsc && vite build`, and `npx tsc
--noEmit` currently reports **16 pre-existing type errors** across 13 files in
`src/core/` and `src/sim/` (`persistentAoE.ts`, `weavile.ts`, `gible.ts`, `torkoal.ts`,
`statusEffect.ts`, `runner.ts` and several `.test.ts` files). It therefore exits before
Vite ever runs.

Those errors are **unrelated repo debt, not a deployment problem**. Running
`npm run build` here will look like a broken deploy and is not one. Every gate in this
phase, `netlify.toml`, and every step below all name `npx vite build` for exactly this
reason. Once the type debt is paid down, switching back is a one-line change in
`netlify.toml`.

---

## Manual steps — HUMAN-ONLY, in this order

### 1. Run the credential-free preflight

```sh
npm run deploy:preflight
```

Runs every check that is possible without a credential: the type baseline, the scoped
test suite, a dependency freeze, a real bundle of the room under workerd, both build-guard
directions, and a payload size report. **Fix any failure before continuing** — anything
red here will also be red after deploying, just far more expensively.

Note what this does *not* cover: it never contacts PartyKit's or Netlify's API, so it
cannot see an account-side problem or a project-name collision.

### 2. Log in to PartyKit

```sh
npx partykit login
```

Opens a browser for GitHub OAuth. **Human-only** — this cannot be run non-interactively.

### 3. Deploy the room

```sh
npx partykit deploy
```

**Copy the URL it prints.** The room's name comes from `partykit.json`'s `name` field
(`poketft`), so the result takes the form:

```
https://poketft.<your-username>.partykit.dev
```

**The exact value printed by the command is authoritative** over anything written in
this document. If it differs from the shape above, use what was printed.

### 4. Set `VITE_PARTY_HOST` to the host portion of that URL

Take the **host only** — no `https://`, no trailing slash, no path:

```
poketft.<your-username>.partykit.dev
```

Both are stripped because `partysocket` derives its own scheme (`ws:`/`wss:`) and
appends its own `/parties/main/<room>` path. A value carrying either one produces an
unopenable URL, and the build guard rejects it before you get that far.

Two ways to set it, pick one:

- **Edit `netlify.toml`** — replace `REPLACE_ME_AFTER_PARTYKIT_DEPLOY` in
  `[build.environment]` and commit. This is a public hostname, not a secret, so it is
  safe to commit.
- **Set it in the Netlify dashboard** — Site configuration → Environment variables.

Leaving the placeholder in place **fails the build on purpose**. It contains uppercase
letters and underscores, neither of which is legal in a hostname, so the guard rejects
it rather than letting you publish a site whose every connection attempt points nowhere.

> **This step must come after step 3 and before step 5.** The value is compiled into
> the bundle at build time, not read at run time. Setting it later — in a dashboard,
> after a deploy — changes nothing until you rebuild.

### 5. Build and deploy the frontend

#### Route A — local CLI build (RECOMMENDED; the only route whose build step is verified)

```sh
npx netlify-cli login
VITE_PARTY_HOST=poketft.<your-username>.partykit.dev npx vite build
npx netlify-cli deploy --prod --dir=dist
```

The build must be `npx vite build`, per "Before you start" above.

#### Route B — git-connected repo (UNTESTED, LIKELY TO FAIL — try Route A first)

Push, connect the repo `aryavpatil302/poketft` in the Netlify dashboard, set
`VITE_PARTY_HOST` in Netlify's build environment, and let `netlify.toml` drive the build.

**Why this is expected to break:** this repo commits `node_modules` — **6406 tracked
files**, including platform-specific **darwin-arm64** binaries for `esbuild` and
`chromedriver`. Netlify's build container is Linux and cannot execute those. Making
Route B work would mean untracking `node_modules` first, which is out of scope for this
phase. This is stated up front rather than left for you to discover from a failed remote
build log.

### 6. Get the shareable link

Open the deployed site, click **Multiplayer**, and copy the link. It takes the form:

```
https://<your-site>.netlify.app/?lobby=<six-character-code>
```

The lobby code is always a **query string on the root path**, never a path segment —
which is why `netlify.toml` needs no SPA fallback redirect.

---

## Verifying DEPLOY-03 — human, cross-network, cannot be automated

**This requirement is verified by a person on a second device, on a different network.
No test in this repo covers it, and none can.** The preflight eliminates every failure
cause reachable without a credential; what remains is genuinely a two-humans-and-two-
networks check.

Work through this list with a friend:

- [ ] Friend opens the shareable link **on a different network** — a phone on **cellular
      data**, not the same wifi. Same-wifi success can pass while the public internet
      path is broken, so it does not count.
- [ ] Friend's browser lands **in the lobby**, not on the title screen.
- [ ] The seat list shows **two humans and four bots**.
- [ ] Host presses **Start**.
- [ ] Both players shop **during the same countdown**, and the two countdowns **agree**
      with each other. (The planning window is the 30-second production default —
      `PLANNING_MS` in `src/net/protocol.ts`. The 2-second override exists only for
      local automated runs and is never passed to a deployed room.)
- [ ] The round **resolves** for both players.
- [ ] Both see **combat playback** and a **consistent settlement line**.
- [ ] A **second round begins**.

---

## Troubleshooting

### The build fails with type errors in `gible.ts` / `persistentAoE.ts` / `weavile.ts` / `torkoal.ts`

You ran `npm run build` instead of `npx vite build`. Those 16 errors are pre-existing
and unrelated to deployment — see "Before you start". Use the documented command.

### The build fails saying `VITE_PARTY_HOST` is unset

The guard printed this, prefixed with `[require-room-host]`:

```
VITE_PARTY_HOST is required for a production build, and is unset.
  It is baked into the bundle as the PartyKit room host every client connects to.
  Without it the shipped client silently falls back to localhost and no remote
  player can connect.
  Expected: a bare host with an optional port — no scheme, no trailing slash.
  Example:  VITE_PARTY_HOST=poketft.someuser.partykit.dev npx vite build
  See DEPLOY.md.
```

**Fix:** complete step 4. The variable must be present in the environment of the
process running the build — prefix the command with it, or set it in Netlify's build
environment.

### The build fails saying `VITE_PARTY_HOST` is malformed

The guard printed this, with your value interpolated into the first line:

```
VITE_PARTY_HOST is malformed: "https://x.partykit.dev"
  It is baked into the bundle as the PartyKit room host every client connects to,
  and partysocket adds its own scheme and /parties/main/<room> path.
  Expected: a bare host with an optional port — no scheme, no trailing slash, no
  path segment, no whitespace, no uppercase, no underscores.
  Example:  VITE_PARTY_HOST=poketft.someuser.partykit.dev npx vite build
  See DEPLOY.md.
```

**Fix:** strip whatever the message names. Most often it is the `https://` prefix or a
trailing slash copied along with the URL. If the value is still
`REPLACE_ME_AFTER_PARTYKIT_DEPLOY`, you skipped step 4 — that literal is rejected by
design. Do **not** "fix" it by substituting a lowercase placeholder such as
`example.partykit.dev`: that would pass validation and ship a site that silently
connects nowhere.

### The deployed page tries to connect to the site's own domain on port 1999

`VITE_PARTY_HOST` was **absent at BUILD time**, so the client fell back to its local-dev
default of `<current-hostname>:1999`. Setting the variable in a dashboard after the fact
changes nothing, because the value is compiled into the bundle. **Rebuild and redeploy.**

### The friend sees the title screen instead of a lobby

The `?lobby=` query string was stripped in transit — link shorteners and some chat
clients do this. Send the full URL, and have them paste it into the address bar rather
than tapping a preview card.

### The room accepts the host but rejects the friend

Check the seat count. Seats are capped at the roster size, and a stale tab still holding
a seat will occupy one. Have the friend retry after the host reloads.

---

## Decisions worth revisiting

Both of these are **reversible**, recorded here so revisiting them is cheap.

### Netlify as the static host

Chosen over Vercel because this repo already contains a working, proven `netlify.toml`
for its Astro blog — real prior art beats a coin flip — and because the ~83 MB
`public/visuals` payload (largest single asset ~11 MB) sits comfortably inside Netlify's
limits, whereas Vercel's Hobby deployment size cap is the tightest of the candidates.
Reversing it means deleting `netlify.toml`, adding the equivalent, and re-pointing the
domain: an hour, not a rewrite.

### The PartyKit project name `poketft`

Fixed in `partykit.json` since Phase 3, and it determines the public subdomain
(`poketft.<your-username>.partykit.dev`). Renaming it later invalidates any link already
shared, so it is worth being deliberate before the first link goes out.

---

## A note on credentials

This document describes **where each credential comes from** and contains **none** — not
even an example-shaped fake, because a plausible-looking fake is indistinguishable from a
real leak during review. Every placeholder here is obviously non-credential, in the
`<your-username>` style. `VITE_PARTY_HOST` is a **public hostname** and is the only value
this project bakes into its bundle; `VITE_`-prefixed variables are inlined into
world-readable JavaScript, so never put a secret in one.
