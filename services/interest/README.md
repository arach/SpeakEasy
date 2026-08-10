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
pnpm install
pnpm exec wrangler login
```

Create the database and paste the id it prints into `wrangler.toml` as
`database_id`:

```bash
pnpm exec wrangler d1 create speakeasy-interest
```

Create the table, set the admin token, and ship it:

```bash
pnpm run db:remote                        # applies schema.sql
pnpm exec wrangler secret put ADMIN_TOKEN # paste a long random string
pnpm run deploy
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
pnpm run list                                   # via wrangler, no token needed
curl -s https://<worker-url>/interest \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq  # via the API
```

## Local development

```bash
pnpm run db:local     # create the table in local D1
pnpm run dev          # http://localhost:8787
```

Local secrets go in `.dev.vars`, which is gitignored:

```
ADMIN_TOKEN=anything-you-like
ALLOWED_ORIGINS=https://speakeasy.arach.dev,http://localhost:8904
```

Wrangler reads `.dev.vars` at startup only — restart `pnpm run dev` after
changing it, or you will chase a CORS failure that is really a stale variable.

## Decisions worth knowing

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
