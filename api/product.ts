import type { VercelRequest, VercelResponse } from './_lib/types.js';
import {
  airtableGet,
  DEKORAPOL_TABLE_ID,
  escapeFormulaValue,
  FRONT_TABLE_ID,
  getAirtableConfig,
  getQueryString,
  HttpError,
  isValidRecordId,
  isValidRegularTableId,
  JUAN_TABLE_ID,
  REGULAR_TABLE_IDS,
  sendJson,
  setCacheHeaders,
  withGuards,
} from './_lib/airtable.js';
import { parseAirtableRecord, type Product } from './_lib/parse.js';

interface ProductWithVariants {
  product: Product;
  thicknessVariants?: Product[];
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records?: AirtableRecord[];
}

// Look up a record in a consolidated table by its {id} field. The {id} field
// preserves the legacy Airtable record ID for migrated/synced rows, so old QR
// codes keep resolving even when the underlying record has a different Airtable
// id (e.g. records pulled in via a synced table get fresh ids). Used for both
// Juan blaty and fronts.
async function fetchByIdField(
  recordId: string,
  baseId: string,
  tableId: string,
  token: string,
): Promise<AirtableRecord | null> {
  const formula = `{id}='${escapeFormulaValue(recordId)}'`;
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;
  const result = await airtableGet(url, token);
  if (!result.ok) return null;
  const data = result.data as AirtableListResponse;
  return data.records?.[0] ?? null;
}

// Find thickness variants of a Juan blat by matching {dekor} + {struktura}
// (and {kolekcja} when present, so unrelated collections sharing a decor /
// struktura combination aren't pulled in).
async function fetchJuanThicknessVariants(
  main: Product,
  baseId: string,
  token: string,
): Promise<Product[] | undefined> {
  if (!main.decor || !main.structure) return undefined;
  const kolekcjaClause = main.kolekcja
    ? `,{kolekcja}='${escapeFormulaValue(main.kolekcja)}'`
    : '';
  const formula = `AND({dekor}='${escapeFormulaValue(main.decor)}',{struktura}='${escapeFormulaValue(main.structure)}'${kolekcjaClause})`;
  const url = `https://api.airtable.com/v0/${baseId}/${JUAN_TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}`;
  const result = await airtableGet(url, token);
  if (!result.ok) return undefined;
  const data = result.data as AirtableListResponse;
  const variants = (data.records ?? [])
    .map((r) => parseAirtableRecord(r))
    .filter((p) => p.id !== main.id);
  return variants.length > 0 ? variants : undefined;
}

// Probe a table by native Airtable record ID. get-by-id resolves a record
// base-wide and ignores the table segment, so a single call reaches whichever
// table in that base the record actually lives in.
async function fetchByRecordId(
  recordId: string,
  baseId: string,
  tableId: string,
  token: string,
): Promise<AirtableRecord | null> {
  const result = await airtableGet(
    `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`,
    token,
  );
  return result.ok ? (result.data as AirtableRecord) : null;
}

interface Probe {
  // Marks the Juan consolidated table so a hit there can pull thickness
  // variants; every other source has no variant concept.
  juan?: boolean;
  run: () => Promise<AirtableRecord | null>;
}

async function fetchProduct(
  recordId: string,
  productType: 'regular' | 'front',
  tableIdHint: string | undefined,
): Promise<ProductWithVariants> {
  const { token, baseId, frontBaseId } = getAirtableConfig();

  // The consolidated tables are synced from elsewhere, so their records carry
  // fresh Airtable record IDs that differ from the QR-encoded one. Both
  // preserve the original ID in an {id} text field and must be matched on it.
  const juanByIdField: Probe = {
    juan: true,
    run: () => fetchByIdField(recordId, baseId, JUAN_TABLE_ID, token),
  };
  const frontByIdField: Probe = {
    run: () => fetchByIdField(recordId, frontBaseId, FRONT_TABLE_ID, token),
  };
  // Dekorapol is synced from the pricing base, so like the consolidated tables
  // its records carry fresh IDs and must be matched on {id}. It has to run
  // BEFORE the base-wide get below: the pre-sync table still sits in the same
  // base under the original record IDs, so a base-wide get would resolve an old
  // QR code to the stale pre-sync row instead of the synced one.
  const dekorapolByIdField: Probe = {
    run: () => fetchByIdField(recordId, frontBaseId, DEKORAPOL_TABLE_ID, token),
  };
  // Every other front table (stylfront, carlack, wiech, slawpol, brw, legacy
  // frontpol) keeps its native record ID — one base-wide get.
  const frontByRecordId: Probe = {
    run: () => fetchByRecordId(recordId, frontBaseId, FRONT_TABLE_ID, token),
  };
  // Legacy per-producer board tables, addressed by record ID. The Juan table is
  // excluded — its records aren't addressable that way. A caller-supplied hint
  // only reorders the probe list; it never restricts it.
  const legacyBoards: Probe = {
    run: async () => {
      const tables = REGULAR_TABLE_IDS.filter((t) => t !== JUAN_TABLE_ID);
      const tryOrder =
        tableIdHint && tables.includes(tableIdHint)
          ? [tableIdHint, ...tables.filter((t) => t !== tableIdHint)]
          : tables;
      for (const tableId of tryOrder) {
        const record = await fetchByRecordId(recordId, baseId, tableId, token);
        if (record) return record;
      }
      return null;
    },
  };

  // A record is looked up in EVERY source regardless of which route the visitor
  // arrived on. QR codes printed at different times encode different URL shapes
  // for the same record — most notably the sheet+front table, whose {url} field
  // points at /product/:id while its data is a front — so the path can only be
  // treated as an ordering hint, never as a filter.
  const probes: Probe[] =
    productType === 'front'
      ? [frontByIdField, dekorapolByIdField, frontByRecordId, juanByIdField, legacyBoards]
      : [juanByIdField, frontByIdField, dekorapolByIdField, legacyBoards, frontByRecordId];

  for (const probe of probes) {
    const record = await probe.run();
    if (!record) continue;
    const product = parseAirtableRecord(record);
    if (probe.juan) {
      const thicknessVariants = await fetchJuanThicknessVariants(product, baseId, token);
      return { product, thicknessVariants };
    }
    return { product };
  }

  throw new HttpError(404, `Product ${recordId} not found`);
}

export default withGuards(async (req: VercelRequest, res: VercelResponse) => {
  const id = getQueryString(req, 'id');
  if (!isValidRecordId(id)) {
    throw new HttpError(400, 'Invalid id');
  }

  const typeParam = getQueryString(req, 'type') ?? 'regular';
  if (typeParam !== 'regular' && typeParam !== 'front') {
    throw new HttpError(400, 'Invalid type');
  }

  const tableHint = getQueryString(req, 'table');
  if (tableHint !== undefined && !isValidRegularTableId(tableHint)) {
    throw new HttpError(400, 'Invalid table');
  }

  const data = await fetchProduct(id, typeParam, tableHint);

  // Read-mostly catalog data — long edge cache, very long SWR. If a price is
  // updated in Airtable, visitors may see the stale value for up to 5 minutes
  // at the edge before revalidation. Acceptable trade-off for the protection
  // this gives the upstream Airtable rate limit and our PAT.
  setCacheHeaders(res, 300, 86_400);
  sendJson(res, 200, data);
});
