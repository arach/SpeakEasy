# Interest endpoint

Records who wants the Pad. This is the only server SpeakEasy runs.

The landing site is a static export on GitHub Pages, so it has nowhere to post a
form. This Worker is that somewhere: one table, one write path, one read path.
No third-party form service, no mailing list, nothing that sends email.

```
POST /interest   { email, source? }        public, CORS-restricted
GET  /interest   Authorization: Bearer …   admin only
GET  /health
```

## Deploy

One-time. Requires a Cloudflare account.

```bash
cd services/interest
bun install
bunx wrangler login
```

Create the database and paste the id it prints into `wrangler.toml` as
`database_id`:

```bash
bunx wrangler d1 create speakeasy-interest
```

Create the table, set the admin token, and ship it:

```bash
bun run db:remote                        # applies schema.sql
bunx wrangler secret put ADMIN_TOKEN # paste a long random string
bun run deploy
```

`wrangler deploy` prints the public URL. **Then point the page at it** — in
`landing/mocks/pad.html`, set:

```js
var INTEREST_ENDPOINT = 'https://speakeasy-interest.<your-subdomain>.workers.dev/interest';
```

That constant is empty on purpose, and the form refuses to submit while it is.
A form that accepts an address and drops it is worse than no form: it looks like
it worked and nobody ever hears back.

If you put the Worker on a custom route (`api.speakeasy.arach.dev`), add that
route in `wrangler.toml` and use it here instead — the origin allowlist is about
who may *call* the API, and is unrelated to where the API itself lives.

## Reading the list

```bash
bun run list                                   # via wrangler, no token needed
curl -s https://<worker-url>/interest \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq  # via the API
```

## Local development

```bash
bun run db:local     # create the table in local D1
bun run dev          # http://localhost:8787
```

Local secrets go in `.dev.vars`, which is gitignored:

```
ADMIN_TOKEN=anything-you-like
ALLOWED_ORIGINS=https://speakeasy.arach.dev,http://localhost:8904
```

Wrangler reads `.dev.vars` at startup only — restart `bun run dev` after
changing it, or you will chase a CORS failure that is really a stale variable.

## After deploying, check the throttle is on

```bash
curl -s https://<worker-url>/health
# {"ok":true,"rateLimit":"enabled"}
```

`"disabled"` means the `RATE_LIMITER` binding did not attach and the endpoint is
open. Fix `wrangler.toml` and redeploy before pointing the page at it.

## Decisions worth knowing

**Five requests per minute per address, counted at the edge.** Cloudflare's
rate-limit binding does the counting before the Worker runs, so a flood costs a
counter increment rather than a database write. Using the platform's limiter
instead of a table of our own is also what lets this service keep its promise of
storing no IP addresses — the address is a counting key at the edge and never
reaches us. Over the limit gets a `429` and a `Retry-After: 60`.

The limit fails **open** if the binding is missing, so that local dev without it
still works. That is a real risk in production, which is why `/health` reports
the limiter's state and the step above exists.

**The origin allowlist is not `*`.** This endpoint writes, so a wildcard would
let any page on the internet post to it from a visitor's browser. Origins live
in `ALLOWED_ORIGINS`; anything else gets a 403 and no CORS header.

**Signing up twice is not an error.** `ON CONFLICT DO NOTHING` keeps the first
record, and the response is identical either way — so the endpoint never reveals
whether an address is already on the list.

**Addresses are normalized before storage** (trimmed, lowercased), which is what
makes the uniqueness constraint mean anything. `Someone@Example.com ` and
`someone@example.com` are one person.

**An unset `ADMIN_TOKEN` denies everything.** A missing secret must never read
as "no authentication required".

**The table is deliberately small**: address, source, coarse country from
Cloudflare's edge, timestamp. No IP addresses, no user agents, no identifiers.
If you add a field, add a line to the privacy page in the same change.
