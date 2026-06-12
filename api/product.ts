import type { VercelRequest, VercelResponse } from './_lib/types';
import {
  airtableGet,
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
} from './_lib/airtable';
import { parseAirtableRecord, type Product } from './_lib/parse';

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

async function fetchProduct(
  recordId: string,
  productType: 'regular' | 'front',
  tableIdHint: string | undefined,
): Promise<ProductWithVariants> {
  const { token, baseId, frontBaseId } = getAirtableConfig();

  if (productType === 'front') {
    // PRIMARY: the consolidated "frontpol widok publiczny" table is synced from
    // another table, so its records carry fresh Airtable record IDs that differ
    // from the QR-encoded ID. It preserves the original QR ID in the {id} text
    // field, so it must be matched by {id}, NOT by record ID.
    const record = await fetchByIdField(recordId, frontBaseId, FRONT_TABLE_ID, token);
    if (record) {
      return { product: parseAirtableRecord(record) };
    }

    // FALLBACK: every other front table (stylfront, carlack, dekorapol, wiech,
    // slawpol, brw, legacy frontpol) keeps its native Airtable record ID, which
    // is exactly what the QR encodes. get-by-id resolves a record base-wide and
    // ignores the table segment, so this single lookup reaches whichever front
    // table the record actually lives in.
    const result = await airtableGet(
      `https://api.airtable.com/v0/${frontBaseId}/${FRONT_TABLE_ID}/${recordId}`,
      token,
    );
    if (result.ok) {
      return { product: parseAirtableRecord(result.data as AirtableRecord) };
    }

    throw new HttpError(404, `Product ${recordId} not found`);
  }

  // PRIMARY PATH: Juan blaty. Look up by {id} field — this is the only way to
  // reach migrated records (their underlying record id changed).
  const juanRecord = await fetchByIdField(recordId, baseId, JUAN_TABLE_ID, token);
  if (juanRecord) {
    const product = parseAirtableRecord(juanRecord);
    const thicknessVariants = await fetchJuanThicknessVariants(product, baseId, token);
    return { product, thicknessVariants };
  }

  // FALLBACK PATH: legacy per-producer tables, addressed by record ID. Try
  // the hinted table first when present, then the rest in order. Juan table
  // is excluded — its records aren't addressable by record ID.
  const fallbackTables = REGULAR_TABLE_IDS.filter((t) => t !== JUAN_TABLE_ID);
  const tryOrder = tableIdHint && fallbackTables.includes(tableIdHint)
    ? [tableIdHint, ...fallbackTables.filter((t) => t !== tableIdHint)]
    : fallbackTables;

  for (const tableId of tryOrder) {
    const url = `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`;
    const result = await airtableGet(url, token);
    if (result.ok) {
      return { product: parseAirtableRecord(result.data as AirtableRecord) };
    }
  }

  throw new HttpError(404, `Product ${recordId} not found in any table`);
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
