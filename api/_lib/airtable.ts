import type { VercelRequest, VercelResponse } from './types.js';

// Allowlisted table IDs — must mirror src/services/airtable.ts so the client and
// server stay in agreement about which tables are addressable. If a new table
// is added, update BOTH lists.
export const JUAN_TABLE_ID = 'tblY3NW6cpkPwyINx';

export const REGULAR_TABLE_IDS = [
  JUAN_TABLE_ID,
  'tblsIe86QUiwNHxN6',
  'tblNItna4sii6GlL9',
  'tblsEnC8rEzMpe3rC',
];

// Consolidated front table. Fronts are addressed by the {id} field (which
// preserves the legacy QR record ID), NOT by Airtable record ID — so this must
// be the real table ID, since filterByFormula runs against the list endpoint
// where the table segment is authoritative (unlike get-by-id, which resolves a
// record base-wide and ignores the table).
export const FRONT_TABLE_ID = 'tblccHiGcVi7bSyNh';

const REGULAR_TABLE_SET = new Set(REGULAR_TABLE_IDS);

export const RECORD_ID_RE = /^rec[A-Za-z0-9]{14}$/;

// Reasonable cap on the {id}/{dekor}/{struktura}/{kolekcja} field values we'll
// interpolate into a filterByFormula. The Airtable record IDs we migrate from
// are 17 chars; legacy free-text values from the dataset stay well under 128.
const FIELD_VALUE_MAX_LEN = 128;

export interface AirtableError {
  status: number;
  message: string;
}

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new HttpError(500, `Server misconfiguration: ${name} not set`);
  return v;
}

export function getAirtableConfig() {
  return {
    token: requireEnv('AIRTABLE_TOKEN'),
    baseId: requireEnv('AIRTABLE_BASE_ID'),
    frontBaseId: requireEnv('AIRTABLE_FRONT_BASE_ID'),
  };
}

export function isValidRecordId(value: unknown): value is string {
  return typeof value === 'string' && RECORD_ID_RE.test(value);
}

export function isValidRegularTableId(value: unknown): value is string {
  return typeof value === 'string' && REGULAR_TABLE_SET.has(value);
}

// Validate + length-cap a user-supplied formula field value. Returns the raw
// (still un-escaped) string; callers must run escapeFormulaValue before
// interpolating into a filterByFormula expression.
export function requireFieldValue(name: string, value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HttpError(400, `Invalid ${name}`);
  }
  if (value.length > FIELD_VALUE_MAX_LEN) {
    throw new HttpError(400, `${name} too long`);
  }
  return value;
}

// Mirror of the client's pre-refactor escapeFormulaValue. Escapes backslashes
// first so the subsequent quote-escape doesn't double-escape its inserts.
export function escapeFormulaValue(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Fetch from Airtable with the server-side PAT. Returns null on 404 so callers
// can distinguish "not found" from real errors without leaking 404 status to
// our clients when they're probing fallback tables.
export async function airtableGet(
  url: string,
  token: string,
): Promise<{ ok: true; data: unknown } | { ok: false; status: number }> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    return { ok: false, status: response.status };
  }
  return { ok: true, data: await response.json() };
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
// Per-instance in-memory rate limit. Vercel may spin up multiple lambda
// instances under load, so each instance enforces this independently — total
// effective limit is N_instances * RATE_LIMIT_MAX. Acceptable for this app's
// traffic profile; revisit with Vercel KV/Upstash if abuse becomes a problem.

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

function clientIp(req: VercelRequest): string {
  // Prefer x-vercel-forwarded-for: Vercel's edge sets it from the actual TCP
  // peer and clients cannot inject it. x-forwarded-for, by contrast, is
  // appended-to by every hop and its left-most entry is fully attacker-controlled.
  const vercelIp = req.headers['x-vercel-forwarded-for'];
  if (typeof vercelIp === 'string' && vercelIp.length > 0) {
    return vercelIp.trim().slice(0, 64);
  }
  if (Array.isArray(vercelIp) && vercelIp.length > 0 && typeof vercelIp[0] === 'string') {
    return vercelIp[0].trim().slice(0, 64);
  }

  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff.join(',') : xff;
  if (typeof raw === 'string' && raw.length > 0) {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    // Right-most entry is the IP added by the last trusted proxy; left-most
    // entries are client-supplied and spoofable.
    if (parts.length > 0) return parts[parts.length - 1].slice(0, 64);
  }

  // Header missing — only really happens in local dev. Fall back to an
  // un-bucketed identifier so we still apply *some* limit.
  return 'unknown';
}

// Probabilistic sweep rate (~1% of requests) and absolute size cap. The cap
// protects against pathological traffic where every request comes from a
// unique IP within a single window — sweep alone can't help in that case.
const RATE_BUCKET_SWEEP_PROBABILITY = 0.01;
const RATE_BUCKET_HARD_CAP = 10_000;

function sweepExpiredBuckets(now: number): void {
  for (const [k, b] of rateBuckets) {
    if (b.resetAt <= now) rateBuckets.delete(k);
  }
}

export function enforceRateLimit(req: VercelRequest): void {
  const key = clientIp(req);
  const now = Date.now();

  // Hard cap: under unique-IP-per-request flooding, expired-only sweep can't
  // shrink the map. Drop everything rather than risk OOMing the lambda.
  if (rateBuckets.size > RATE_BUCKET_HARD_CAP) {
    rateBuckets.clear();
  } else if (Math.random() < RATE_BUCKET_SWEEP_PROBABILITY) {
    sweepExpiredBuckets(now);
  }

  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX) {
    throw new HttpError(429, 'Too Many Requests');
  }
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

export function setCacheHeaders(res: VercelResponse, sMaxAge: number, swr: number): void {
  res.setHeader('Cache-Control', `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`);
}

export function sendJson(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(body));
}

export function sendError(res: VercelResponse, err: unknown): void {
  if (err instanceof HttpError) {
    sendJson(res, err.status, { error: err.message });
    return;
  }
  // Don't leak internals — log server-side, return a generic 500.
  console.error('[api] unhandled error', err);
  sendJson(res, 500, { error: 'Internal Server Error' });
}

// Wrap a handler with rate limiting + uniform error handling. Method check is
// done inside so each endpoint can declare which verbs it accepts.
export function withGuards(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void>,
  allowedMethods: readonly string[] = ['GET'],
) {
  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    try {
      if (!allowedMethods.includes(req.method ?? '')) {
        res.setHeader('Allow', allowedMethods.join(', '));
        throw new HttpError(405, 'Method Not Allowed');
      }
      enforceRateLimit(req);
      await handler(req, res);
    } catch (err) {
      sendError(res, err);
    }
  };
}

// ---------------------------------------------------------------------------
// Query-string helpers
// ---------------------------------------------------------------------------

export function getQueryString(req: VercelRequest, name: string): string | undefined {
  const v = req.query?.[name];
  if (v === undefined) return undefined;
  if (typeof v === 'string') return v;
  // Repeated `?name=a&name=b` arrives as an array. Reject rather than silently
  // pick one value — a buggy or hostile client should get a clear error.
  if (Array.isArray(v)) {
    throw new HttpError(400, `Repeated query parameter: ${name}`);
  }
  return undefined;
}
