/**
 * SpeakEasy interest endpoint.
 *
 * The landing site is a static export on GitHub Pages, so it has nowhere to
 * post a form. This Worker is the whole backend: it records that somebody wants
 * the Pad, and hands the list back when asked with the admin token.
 *
 *   POST /interest   { email, source? }        public, CORS-restricted
 *   GET  /interest   Authorization: Bearer …   admin only
 *   GET  /health                               public
 */

export interface Env {
  DB: D1Database;
  /** Set with `wrangler secret put ADMIN_TOKEN`. Never a plain var. */
  ADMIN_TOKEN?: string;
  /** Comma-separated origin allowlist. */
  ALLOWED_ORIGINS?: string;
}

/** Bigger than any honest signup, small enough that nobody can post a novel. */
const MAX_BODY_BYTES = 2_048;
const MAX_EMAIL_LENGTH = 254; // RFC 5321
const MAX_SOURCE_LENGTH = 64;

/** Deliberately loose. The address is confirmed by an invite arriving, not by a
 *  regex — the only job here is to reject obvious junk and anything with
 *  whitespace or control characters in it. */
const EMAIL = /^[^\s@,;<>"']+@[^\s@,;<>"'.]+(\.[^\s@,;<>"'.]+)+$/;

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/** Echo the origin only when it is on the list. Never `*` — this endpoint
 *  writes, and a wildcard would let any page on the internet post to it. */
function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  const list = allowedOrigins(env);
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  if (origin && list.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(body: unknown, init: ResponseInit = {}, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extra,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

/** Constant-time compare, so a wrong token cannot be discovered a byte at a
 *  time by measuring how long the rejection takes. */
function tokensMatch(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

function authorized(request: Request, env: Env): boolean {
  // An unset secret must never mean "everyone is an admin".
  if (!env.ADMIN_TOKEN) return false;
  const header = request.headers.get('Authorization') ?? '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  return tokensMatch(header.slice(prefix.length), env.ADMIN_TOKEN);
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const declared = Number(request.headers.get('Content-Length') ?? 0);
  if (declared > MAX_BODY_BYTES) return null;
  const text = await request.text();
  // A missing or lying Content-Length must not get a free pass.
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function recordInterest(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const body = await readBody(request);
  if (!body) return json({ ok: false, error: 'bad_request' }, { status: 400 }, cors);

  const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!rawEmail || rawEmail.length > MAX_EMAIL_LENGTH || !EMAIL.test(rawEmail)) {
    return json({ ok: false, error: 'invalid_email' }, { status: 422 }, cors);
  }

  const source =
    typeof body.source === 'string' && body.source.trim()
      ? body.source.trim().slice(0, MAX_SOURCE_LENGTH)
      : 'unknown';
  const country = request.headers.get('CF-IPCountry') ?? null;

  // Signing up twice is not an error — it is somebody being keen, or clicking
  // again because they forgot. Keep the first record and answer the same way,
  // so the response never reveals whether an address is already on the list.
  await env.DB.prepare(
    `INSERT INTO interest (email, source, country)
     VALUES (?1, ?2, ?3)
     ON CONFLICT(email) DO NOTHING`,
  )
    .bind(rawEmail, source, country)
    .run();

  return json({ ok: true }, { status: 201 }, cors);
}

async function listInterest(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  if (!authorized(request, env)) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 }, cors);
  }
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 500), 1), 1000);

  const { results } = await env.DB.prepare(
    `SELECT email, source, country, created_at
       FROM interest
      ORDER BY created_at DESC, id DESC
      LIMIT ?1`,
  )
    .bind(limit)
    .all();

  const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM interest`).first<{ n: number }>();

  return json({ ok: true, total: total?.n ?? 0, count: results.length, results }, { status: 200 }, cors);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/health') {
      return json({ ok: true }, { status: 200 }, cors);
    }

    if (url.pathname === '/interest') {
      // A browser post from an origin that is not on the list gets no
      // Allow-Origin header back, so refuse it outright rather than writing a
      // row the caller will never see the answer to.
      const origin = request.headers.get('Origin');
      if (origin && !cors['Access-Control-Allow-Origin']) {
        return json({ ok: false, error: 'forbidden_origin' }, { status: 403 }, cors);
      }
      if (request.method === 'POST') return recordInterest(request, env, cors);
      if (request.method === 'GET') return listInterest(request, env, cors);
      return json({ ok: false, error: 'method_not_allowed' }, { status: 405 }, cors);
    }

    return json({ ok: false, error: 'not_found' }, { status: 404 }, cors);
  },
};
