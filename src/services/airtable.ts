import type { Product } from '../types/product';

// Allowlisted legacy fallback tables. Mirrors api/_lib/airtable.ts so that
// when the SPA passes a `table` hint to the API it never sends a value the
// server will reject. The server is still the authoritative validator.
const TABLE_IDS = [
  'tblY3NW6cpkPwyINx', // Juan (consolidated)
  'tblsIe86QUiwNHxN6',
  'tblNItna4sii6GlL9',
  'tblsEnC8rEzMpe3rC',
];
const TABLE_ID_SET = new Set(TABLE_IDS);

// Reject obviously bad IDs before round-tripping to the API. Server applies
// the same regex; this is a UX optimization, not a security boundary. The
// range (rather than a fixed 17 chars) tolerates a stray character in the
// consolidated tables' hand-maintained {id} field — see api/_lib/airtable.ts.
const RECORD_ID_RE = /^rec[A-Za-z0-9]{14,21}$/;

export interface ProductWithVariants {
  product: Product;
  thicknessVariants?: Product[];
}

// ---------------------------------------------------------------------------
// localStorage cache for the legacy recordId → tableId mapping. This shaves
// extra round trips when a returning visitor lands on a non-Juan product
// whose record lives in a specific fallback table. Cache is purely a hint;
// the server is happy to probe all fallback tables itself if the hint is
// stale or missing.
// ---------------------------------------------------------------------------

interface TableCache {
  [recordId: string]: { tableId: string; timestamp: number };
}

const CACHE_KEY = 'airtable_product_table_cache_v2';
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

function getCachedTableId(recordId: string): string | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: TableCache = JSON.parse(raw);
    const entry = parsed[recordId];
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      delete parsed[recordId];
      localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
      return null;
    }
    return entry.tableId;
  } catch {
    // localStorage disabled or quota exceeded — fail silently.
    return null;
  }
}

function setCachedTableId(recordId: string, tableId: string): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed: TableCache = raw ? JSON.parse(raw) : {};
    parsed[recordId] = { tableId, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
  } catch (error) {
    if (import.meta.env.DEV) console.warn('Failed to cache table ID:', error);
  }
}

// ---------------------------------------------------------------------------

export async function fetchProduct(
  recordId: string,
  productType: 'regular' | 'front' = 'regular',
  tableIdHint?: string,
): Promise<ProductWithVariants> {
  if (!RECORD_ID_RE.test(recordId)) {
    throw new Error(`Invalid product id: ${recordId}`);
  }

  // Only forward a table hint that we recognize. The server validates the
  // same allowlist; sending anything else just wastes a round trip.
  const cachedHint = !tableIdHint ? getCachedTableId(recordId) : null;
  const effectiveHint = tableIdHint && TABLE_ID_SET.has(tableIdHint)
    ? tableIdHint
    : cachedHint && TABLE_ID_SET.has(cachedHint)
      ? cachedHint
      : undefined;

  const params = new URLSearchParams({ id: recordId, type: productType });
  if (effectiveHint) params.set('table', effectiveHint);

  const response = await fetch(`/api/product?${params.toString()}`);
  if (!response.ok) {
    // Surface the server's error message when it's a 4xx; treat 5xx as
    // generic to avoid leaking internals.
    let message = `Product ${recordId} not found`;
    if (response.status >= 400 && response.status < 500) {
      try {
        const body = (await response.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        // ignore parse failure, fall back to default message
      }
    }
    throw new Error(message);
  }

  const data = (await response.json()) as ProductWithVariants;

  // Refresh the table-hint cache when the server resolved a legacy fallback
  // table for this record. The server doesn't tell us which table won, so we
  // can only refresh when the caller already supplied a working hint.
  if (effectiveHint) {
    setCachedTableId(recordId, effectiveHint);
  }

  return data;
}
