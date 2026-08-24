# Deploying pokeTFT

> **Every command in the Manual Steps section is run BY A HUMAN, at a terminal.**
> Two of them (`npx partykit login` and the Netlify login) open an interactive browser
> flow that cannot be automated, scripted, or completed by an agent.
> **Nothing in this file has been executed by an agent.** No credential for either
> service exists on this machine, and none appears anywhere in this repository.

---

## What gets deployed where

- **The authoritative room** — `party/lobby.ts`, the server that owns game state and
  arbitrates both players' actions — goes to **PartyKit** (or, if that path is blocked
  for you, to **your own AWS EC2 server** — see "Alternative" further down. As of this
  writing PartyKit's free shared domain is at capacity and its own-Cloudflare-account
  deploy path has an unfixed CLI bug, so the AWS path is the one actually verified
  end-to-end; try PartyKit first regardless, since it's less work if it happens to work
  for you).
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
test suite, a dependency freeze, a real bundle of the room under workerd, the same
bundle again through the AWS self-hosted adapter (`party/nodeHost.ts`), both
build-guard directions, and a payload size report. **Fix any failure before
continuing** — anything red here will also be red after deploying, just far more
expensively.

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

## Alternative: self-hosting the room on your own AWS EC2 server

**Why this exists:** the PartyKit-hosted path above (steps 2-4) can fail for two reasons
that have nothing to do with this repo's code:

- PartyKit's shared free `*.partykit.dev` domain has hit Cloudflare's hard cap of 10,000
  custom domains on that zone — a capacity ceiling shared across every free PartyKit
  user, not specific to any one account.
- Deploying to your own Cloudflare account via `partykit deploy --domain` fails on a
  fresh account because PartyKit's CLI (frozen at its last published version, `0.0.115`
  — no newer release exists) doesn't create Durable Object namespaces with the
  `new_sqlite_classes` migration Cloudflare's free plan has required since a July 2026
  policy change. This is a genuine bug in an unmaintained tool, not something fixable
  from config.

Rather than wait on either of those, this path hosts `party/lobby.ts` yourself: a small
Node.js process (`party/nodeHost.ts` + `party/nodeStorage.ts`) that runs the exact same
room logic, supervised by `systemd`, fronted by `Caddy` for real TLS. `party/lobby.ts`
itself is never modified, so the PartyKit path above stays available too, any time it
gets fixed.

This is an **alternative to steps 2-4 above**, not a replacement for the whole document
— it arrives at the same place: a bare `host` value for `VITE_PARTY_HOST`. From there,
steps 5-6 above (build, deploy to Netlify, get the link) are unchanged.

### 1. Prerequisites

- An AWS account.
- A domain you control, purchased somewhere (Namecheap, Porkbun, Cloudflare Registrar —
  a few dollars a year), with the ability to add a DNS **A record**. A bare IP address
  cannot get a real TLS certificate — this is not optional, since `partysocket` (the
  client library) unconditionally uses `wss://` for any public host, and browsers block
  an `https://` page from opening a plain insecure `ws://` connection anyway.
- Everything past this point assumes you already have a running Ubuntu instance with SSH
  access — the AWS console account setup itself is human-only, same as `partykit login`
  above, and out of this document's scope.

### 2. Launch an EC2 instance

A small instance (`t3.micro` is free-tier eligible) is plenty for a friends-only game.
Allocate and **associate an Elastic IP** with it — a bare EC2 public IP changes every
time the instance stops and restarts, which would silently break your DNS record. In the
instance's security group, allow inbound traffic on ports **22** (SSH), **80** and
**443** (HTTP/HTTPS — Caddy needs 80 to complete its Let's Encrypt certificate challenge,
even though the room only ever talks over 443). SSH in once it's running.

### 3. Point DNS at it

Add an **A record** for a subdomain — e.g. `room.yourdomain.com` — pointed at the
Elastic IP from step 2. DNS propagation can take anywhere from a minute to a few hours;
Caddy (step 7) simply retries its certificate request until the record resolves, so
there's no need to wait idle — go ahead and do steps 4-6 in the meantime.

### 4. Install Node.js

```sh
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # confirm it matches this project's target (Node 20+)
```

### 5. Create the service user, then get the code onto the instance AS that user

`deploy/poketft-room.service` (below) runs as a dedicated `poketft` user with
`WorkingDirectory=/home/poketft/poketft`. Create that user and clone **directly into**
that exact path, as that user, so there's no separate ownership-fixing step and nothing
to get out of sync between where the code lands and where the service looks for it:

```sh
sudo useradd -m -s /usr/sbin/nologin poketft   # -m creates /home/poketft
sudo -u poketft git clone <your-fork-or-repo-url> /home/poketft/poketft
cd /home/poketft/poketft
sudo -u poketft npm install
```

(`sudo -u poketft <command>` runs that one command as `poketft` without needing an
interactive login — `nologin` only blocks the latter, not this.)

> **Don't skip `npm install`.** This repo commits `node_modules` for reproducibility, but
> only the macOS `@esbuild/darwin-arm64` binary is tracked — not the Linux one `tsx`
> needs to run on this instance. Skipping this step produces a confusing "tsx exits
> immediately with no output" failure that looks unrelated to the real cause.

### 6. Set up the systemd service

Still from `/home/poketft/poketft`:

```sh
sudo -u poketft mkdir -p .party-data
sudo cp deploy/poketft-room.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now poketft-room
sudo systemctl status poketft-room       # should read "active (running)"
journalctl -u poketft-room -f            # follow logs; Ctrl-C to stop watching
```

> **Don't skip creating `.party-data` first.** The unit's `ReadWritePaths=` sandboxing
> entry (see the unit file's own comments) needs that directory to already exist —
> without it, the service can fail to even start, which reads like a mysterious
> permissions problem with no obvious connection to the real cause.

Sanity-check it locally, on the instance itself, before TLS is even in the picture:

```sh
curl http://127.0.0.1:1999/parties/main/healthcheck
```

This should return a small JSON status object — the exact same contract
`scripts/roomHarness.ts` already polls in this project's own automated tests.

### 7. Set up Caddy for TLS

```sh
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Copy `deploy/Caddyfile`, substituting your real domain for `room.yourdomain.com`:

```sh
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/room.yourdomain.com/room.YOUR-REAL-DOMAIN.com/' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Now confirm the **public** path works — run this from a **different machine** (your
laptop, not the EC2 instance itself), since a loopback `curl` proves nothing about
whether the internet can actually reach it:

```sh
curl https://room.yourdomain.com/parties/main/healthcheck
```

If this returns the same JSON status object as step 6's loopback check, the room is
live on the public internet.

### 8. Arrive at `VITE_PARTY_HOST`

The value is simply the bare domain — `room.yourdomain.com`, no port, since Caddy owns
443 and the client's `wss://` default targets it with no explicit port needed. From
here, **steps 5-6 of the Manual Steps section above are unchanged**: set this as
`VITE_PARTY_HOST`, build with `npx vite build`, deploy to Netlify exactly as documented.

### 9. Lock the room to your real frontend origin

Once you have the Netlify URL from step 6 of the Manual Steps section, come back and
set it as an allowed origin so an arbitrary web page elsewhere on the internet can't
open connections to your rooms from its visitors' browsers:

```sh
sudo systemctl edit poketft-room
```

Add these two lines in the editor that opens (a systemd drop-in — this doesn't touch
`deploy/poketft-room.service` itself), then save and exit:

```ini
[Service]
Environment=ALLOWED_ORIGINS=https://your-site.netlify.app
```

```sh
sudo systemctl restart poketft-room
```

This step is optional but recommended — everything above works without it, since
non-browser clients (this project's own test harness, curl, a native app) never send an
`Origin` header and are unaffected either way.

### Troubleshooting (AWS path)

**`journalctl -u poketft-room` shows the process exiting immediately** — almost always
the missing-esbuild-binary gotcha from step 5. Re-run `npm install` on the instance.

**Browser hangs trying to connect, or fails outright** — check each layer from the
inside out: is `systemctl status poketft-room` `active`? Does the loopback `curl` in
step 6 succeed? Does `systemctl status caddy` show a certificate issuance failure
(usually means DNS from step 3 hasn't propagated yet)? Does the security group from
step 2 actually allow inbound 443?

**Works from the instance (`curl 127.0.0.1:1999/...`) but not from outside** — the
problem is the reverse proxy or the security group, not the Node process. Test the
public `curl` in step 7 again once DNS/security-group issues are ruled out.

### Decisions worth revisiting (AWS path)

Both reversible, recorded here so revisiting either is cheap:

- **Caddy over nginx** — chosen for zero-config automatic Let's Encrypt issuance and
  renewal, and because it forwards WebSocket upgrade headers with no special directive
  (nginx needs an explicit `proxy_set_header Upgrade $http_upgrade; proxy_set_header
  Connection "upgrade";` pair). Swapping to nginx later is a config-file change; the
  Node process underneath is unaffected either way.
- **systemd over PM2/Docker** — chosen because it's already on every stock Ubuntu
  install, needs nothing extra installed, and gives auto-restart-on-crash plus
  auto-start-on-boot from a single unit file. PM2 is a reasonable alternative if you
  later want a process-management dashboard; Docker if you later want to run this
  alongside other services in containers.

**Abrupt disconnects (a phone losing signal, a NAT timeout with no clean TCP close) are
handled, not just assumed to be:** `party/nodeHost.ts` runs a 30-second WebSocket
heartbeat (ping every open connection; a connection that never answers the previous
ping gets `terminate()`d) specifically because a dead peer otherwise never fires `close`
on its own — without it, that seat would stay occupied forever and a real player
returning to the game would be wrongly told the room is full. `terminate()` does fire
`close`, which runs the normal `onClose()` path (frees the seat, persists, broadcasts
the update) exactly as a clean disconnect would. This is still only exercised on this
project's local loopback tests, not over a real flaky mobile connection — worth
watching during the cross-network checklist below, not a reason to hold off on a small
friends-only deployment.

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
