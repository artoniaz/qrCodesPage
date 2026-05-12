import type { Product } from '../types/product';

const AIRTABLE_TOKEN = import.meta.env.VITE_AIRTABLE_TOKEN;
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;
const FRONT_BASE_ID = import.meta.env.VITE_AIRTABLE_FRONT_BASE_ID;

// Juan blaty: single consolidated table with new JSON-pricing schema.
// Looked up by {id} field (not by Airtable record ID) so old QR codes keep resolving
// to the migrated record even though it has a new Airtable record ID.
const JUAN_TABLE_ID = 'tblY3NW6cpkPwyINx';

// Other producers (Kronospan, Egger, …) still use legacy per-record tables.
// These are queried by Airtable record ID — kept as fallback only.
const TABLE_IDS = [
  JUAN_TABLE_ID,
  'tblsIe86QUiwNHxN6',
  'tblNItna4sii6GlL9',
  'tblsEnC8rEzMpe3rC',
];

// Front products only use this single table
const FRONT_TABLE_ID = 'tblHkykZmLJghpL6Z';

export interface ProductWithVariants {
  product: Product;
  thicknessVariants?: Product[]; // Related products with same code but different thickness
}

/**
 * @deprecated This function is no longer used for fetching thickness variants.
 * Thickness variants are now fetched using Airtable's expand parameter on calculator_link field.
 * Kept for potential future use cases.
 */
export async function fetchProductsByCode(code: string, productType: 'regular' | 'front' = 'regular'): Promise<Product[]> {
  if (!code) return [];

  const allProducts: Product[] = [];
  const filterFormula = `{code} = '${code}'`;
  const baseId = productType === 'front' ? FRONT_BASE_ID : BASE_ID;
  // Juan table has no usable `code` field, so it's excluded from the code-based lookup.
  const tableIds = productType === 'front' ? [FRONT_TABLE_ID] : TABLE_IDS.filter(t => t !== JUAN_TABLE_ID);

  // Search across the relevant tables (single table for front, multiple for regular)
  for (const tableId of tableIds) {
    const url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${encodeURIComponent(filterFormula)}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        },
      });

      if (!response.ok) {
        // Silently skip tables we don't have access to (403) or that don't exist
        continue;
      }

      const data = await response.json();

      // Reuse the canonical record parser so legacy + new Juan schemas are handled uniformly
      const products: Product[] = data.records.map((record: any) => parseAirtableRecord(record));

      allProducts.push(...products);
    } catch (error) {
      // Silently skip tables with errors
      continue;
    }
  }

  return allProducts;
}

// Helper function to parse Airtable record into Product type
// Reusable for both main product and linked records (calculator_link)
function parseAirtableRecord(record: any): Product {
  // Helper function to parse price strings
  const parsePrice = (priceValue: string | number | undefined): number | undefined => {
    if (priceValue === undefined || priceValue === null) return undefined;
    if (typeof priceValue === 'number') return priceValue;
    if (typeof priceValue === 'string') {
      const cleaned = priceValue.replace('PLN', '').replace(',', '.').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  };

  // Helper function to parse length string
  const parseLength = (lengthValue: string | undefined): { length_1?: number, length_2?: number } => {
    if (!lengthValue || typeof lengthValue !== 'string') return {};
    const lengths = lengthValue.split(';').map(l => {
      const trimmed = l.trim();
      const parsed = parseInt(trimmed);
      return isNaN(parsed) ? undefined : parsed;
    }).filter(l => l !== undefined);
    return {
      length_1: lengths[0],
      length_2: lengths[1],
    };
  };

  // Helper function to parse width string
  const parseWidth = (widthValue: string | undefined): {
    width_1?: number, width_2?: number, width_3?: number,
    width_4?: number, width_5?: number, width_6?: number,
    width_7?: number, width_8?: number
  } => {
    if (!widthValue || typeof widthValue !== 'string') return {};
    const widths = widthValue.split(';').map(w => {
      const trimmed = w.trim();
      const parsed = parseInt(trimmed);
      return isNaN(parsed) ? undefined : parsed;
    }).filter(w => w !== undefined);
    return {
      width_1: widths[0], width_2: widths[1], width_3: widths[2],
      width_4: widths[3], width_5: widths[4], width_6: widths[5],
      width_7: widths[6], width_8: widths[7],
    };
  };

  // Parse the new Juan ceny_netto JSON map (string or object)
  const parseCenyNetto = (value: unknown): Record<string, number> | undefined => {
    if (!value) return undefined;
    if (typeof value === 'object') return value as Record<string, number>;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' && parsed !== null ? parsed : undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  };

  // Derive legacy "side" semantics + sideKeys mapping from new "zaoblenia" column.
  // Examples:
  //   "1;2"    -> side="1_2", sideKeys={1:"1", 2:"2"}
  //   "0_1;2"  -> side="1_2", sideKeys={1:"0_1", 2:"2"}   (some Juan products encode jednostronnie as "0_1")
  //   "2"      -> side=2,     sideKeys={2:"2"}
  // The sideKeys map is what the WorktopCalculator uses to build the price-map key
  // (since the suffix string varies per product).
  const parseZaobleniaAndKeys = (value: unknown, recordId: string): { side?: number | string; sideKeys: { 1?: string; 2?: string } } => {
    const sideKeys: { 1?: string; 2?: string } = {};
    if (value === undefined || value === null) return { side: undefined, sideKeys };
    const str = String(value).trim();
    if (!str) return { side: undefined, sideKeys };
    const parts = str.split(';').map(p => p.trim()).filter(Boolean);
    for (const p of parts) {
      // "1" or "0_1" both denote jednostronnie zaoblony
      if (p === '1' || p === '0_1') sideKeys[1] = p;
      // "2" denotes obustronnie zaoblony
      else if (p === '2') sideKeys[2] = p;
      else console.warn(`[airtable] unknown zaoblenia token "${p}" on record ${recordId}`);
    }
    let side: number | string | undefined;
    if (sideKeys[1] && sideKeys[2]) side = '1_2';
    else if (sideKeys[1]) side = 1;
    else if (sideKeys[2]) side = 2;
    return { side, sideKeys };
  };

  const f = record.fields;
  const isNewJuanSchema = f.ceny_netto !== undefined || f.szerokosci !== undefined;

  if (isNewJuanSchema) {
    const parsedLengths = parseLength(f.dlugosci);
    const parsedWidths = parseWidth(f.szerokosci);
    const { side, sideKeys } = parseZaobleniaAndKeys(f.zaoblenia, record.id);
    const prices = parseCenyNetto(f.ceny_netto);
    // Invariant: prices in the new Juan map are per-meter, so the same (width, side)
    // should yield the same value for every length variant. Warn if they diverge.
    if (prices) {
      const widthsArr = [parsedWidths.width_1, parsedWidths.width_2, parsedWidths.width_3, parsedWidths.width_4, parsedWidths.width_5, parsedWidths.width_6, parsedWidths.width_7, parsedWidths.width_8].filter((w): w is number => w !== undefined);
      const lengthsArr = [parsedLengths.length_1, parsedLengths.length_2].filter((l): l is number => l !== undefined);
      for (const w of widthsArr) {
        for (const sk of [sideKeys[1], sideKeys[2]].filter((v): v is string => !!v)) {
          const found = lengthsArr.map(l => prices[`${w}x${l}x${sk}`]).filter((v): v is number => typeof v === 'number');
          if (found.length > 1 && Math.max(...found) - Math.min(...found) > 0.01) {
            console.warn(`[airtable] price-map mismatch on record ${record.id} width=${w} side=${sk}: ${found.join(',')}`);
          }
        }
      }
    }
    // qr_id field name may carry a BOM prefix when the CSV import preserved one
    const qrId = f.qr_id ?? f['﻿qr_id'] ?? undefined;
    return {
      id: record.id,
      decor: f.dekor !== undefined && f.dekor !== null ? String(f.dekor) : '',
      structure: f.struktura || '',
      name: f.nazwa || '',
      sellUnit: f.sellUnit || '',
      price: f.price || 0,
      category: 'blat',
      description: f.description || '',
      code: f.code || '',
      thickness: typeof f.grubosc === 'number' ? f.grubosc : (parseInt(f.grubosc) || 0),
      typePrice: f.typePrice || '',
      width: f.szerokosci || undefined,
      width_1: parsedWidths.width_1,
      width_2: parsedWidths.width_2,
      width_3: parsedWidths.width_3,
      width_4: parsedWidths.width_4,
      width_5: parsedWidths.width_5,
      width_6: parsedWidths.width_6,
      width_7: parsedWidths.width_7,
      width_8: parsedWidths.width_8,
      height: undefined,
      type: undefined,
      url: f.url || '',
      "url + code": f["url + code"] || '',
      producer: 'Juan',
      label: f.label || undefined,
      length: f.dlugosci !== undefined && f.dlugosci !== null ? String(f.dlugosci) : undefined,
      length_1: parsedLengths.length_1,
      length_2: parsedLengths.length_2,
      side,
      sideKeys,
      prices,
      kolekcja: f.kolekcja || undefined,
      qr_id: qrId || undefined,
      is_new: f.is_new === true || f.is_new === 'checked',
      ukryj_cene: f.ukryj_cene === true,
    };
  }

  const parsedLengths = parseLength(record.fields.length);
  const parsedWidths = parseWidth(record.fields.width);

  return {
    id: record.id,
    decor: record.fields.decor || '',
    structure: record.fields.structure || '',
    name: record.fields.name || '',
    sellUnit: record.fields.sellUnit || '',
    price: record.fields.price || 0,
    category: record.fields.category || '',
    description: record.fields.description || '',
    code: record.fields.code || '',
    thickness: record.fields.thickness || 0,
    typePrice: record.fields.typePrice || '',
    width: record.fields.width || undefined,
    width_1: parsedWidths.width_1,
    width_2: parsedWidths.width_2,
    width_3: parsedWidths.width_3,
    width_4: parsedWidths.width_4,
    width_5: parsedWidths.width_5,
    width_6: parsedWidths.width_6,
    width_7: parsedWidths.width_7,
    width_8: parsedWidths.width_8,
    height: record.fields.height || undefined,
    type: record.fields.type || undefined,
    url: record.fields.url || '',
    "url + code": record.fields["url + code"] || '',
    producer: record.fields.producer || undefined,
    label: record.fields.label || undefined,
    length: record.fields.length || undefined,
    length_1: parsedLengths.length_1,
    length_2: parsedLengths.length_2,
    side: record.fields.side || undefined,
    price_600_m_1: parsePrice(record.fields.price_600_m_1),
    price_635_m_1: parsePrice(record.fields.price_635_m_1),
    price_650_m_1: parsePrice(record.fields.price_650_m_1),
    price_700_m_1: parsePrice(record.fields.price_700_m_1),
    price_800_m_1: parsePrice(record.fields.price_800_m_1),
    price_900_m_1: parsePrice(record.fields.price_900_m_1),
    price_1200_m_1: parsePrice(record.fields.price_1200_m_1),
    price_1300_m_1: parsePrice(record.fields.price_1300_m_1),
    price_600_m_2: parsePrice(record.fields.price_600_m_2),
    price_700_m_2: parsePrice(record.fields.price_700_m_2),
    price_800_m_2: parsePrice(record.fields.price_800_m_2),
    price_900_m_2: parsePrice(record.fields.price_900_m_2),
    price_1200_m_2: parsePrice(record.fields.price_1200_m_2),
    front_typ: record.fields.front_typ || undefined,
    frez_typ: record.fields.frez_typ || undefined,
    kolor: record.fields.kolor || undefined,
    info: record.fields.info || undefined,
    czas_oczekiwania: record.fields.czas_oczekiwania || undefined,
    cena_brutto: parsePrice(record.fields.cena_brutto),
    cena_brutto_laser: parsePrice(record.fields.cena_brutto_laser),
    ukryj_cene: record.fields.ukryj_cene === true,
  };
}

// Cache interface for recordId → tableId mapping
interface TableCache {
  [recordId: string]: {
    tableId: string;
    timestamp: number;
  };
}

const CACHE_KEY = 'airtable_product_table_cache_v2';
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

function getCachedTableId(recordId: string): string | null {
  try {
    const cache = localStorage.getItem(CACHE_KEY);
    if (!cache) return null;

    const parsed: TableCache = JSON.parse(cache);
    const entry = parsed[recordId];

    if (!entry) return null;

    // Check if cache is expired
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      delete parsed[recordId];
      localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
      return null;
    }

    return entry.tableId;
  } catch (error) {
    // localStorage disabled or quota exceeded - fail silently
    return null;
  }
}

function setCachedTableId(recordId: string, tableId: string): void {
  try {
    const cache = localStorage.getItem(CACHE_KEY);
    const parsed: TableCache = cache ? JSON.parse(cache) : {};

    parsed[recordId] = {
      tableId,
      timestamp: Date.now()
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
  } catch (error) {
    // localStorage disabled or quota exceeded - fail silently
    console.warn('Failed to cache table ID:', error);
  }
}

// Escape single quotes inside a value used in a filterByFormula string literal.
function escapeFormulaValue(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const authHeaders = { Authorization: `Bearer ${AIRTABLE_TOKEN}` };

// Look up a Juan blat in the consolidated table by {id} field (which carries the
// legacy Airtable record ID for migrated rows, or the current one for new rows).
// Returns the raw Airtable record JSON, or null if no match in the Juan table.
async function fetchJuanByIdField(recordId: string): Promise<any | null> {
  // {id} carries the lookup key for both migrated and new records — same field is used
  // for all 3 thickness rows (verified). qr_id is intentionally not in the filter:
  // its Airtable field name was imported with a BOM prefix and is not addressable
  // by name in filterByFormula.
  const formula = `{id}='${escapeFormulaValue(recordId)}'`;
  const url = `https://api.airtable.com/v0/${BASE_ID}/${JUAN_TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;
  const response = await fetch(url, { headers: authHeaders });
  if (!response.ok) return null;
  const json = await response.json();
  return json.records?.[0] ?? null;
}

// Find all thickness variants of a Juan blat by matching {dekor} + {struktura}.
// Excludes the main record and rows with the same thickness.
async function fetchJuanThicknessVariants(main: Product): Promise<Product[] | undefined> {
  if (!main.decor || !main.structure) return undefined;
  // When a collection is present, scope the match to it so unrelated collections
  // sharing a decor/struktura combination aren't pulled in as variants.
  const kolekcjaClause = main.kolekcja ? `,{kolekcja}='${escapeFormulaValue(main.kolekcja)}'` : '';
  const formula = `AND({dekor}='${escapeFormulaValue(main.decor)}',{struktura}='${escapeFormulaValue(main.structure)}'${kolekcjaClause})`;
  const url = `https://api.airtable.com/v0/${BASE_ID}/${JUAN_TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}`;
  const response = await fetch(url, { headers: authHeaders });
  if (!response.ok) return undefined;
  const json = await response.json();
  const variants: Product[] = (json.records ?? [])
    .map((r: any) => parseAirtableRecord(r))
    .filter((p: Product) => p.id !== main.id);
  return variants.length > 0 ? variants : undefined;
}

export async function fetchProduct(
  recordId: string,
  productType: 'regular' | 'front' = 'regular',
  tableIdHint?: string // Optional tableId from URL or cache (legacy tables only)
): Promise<ProductWithVariants> {
  // Front products use their own base; no Juan lookup path applies.
  if (productType === 'front') {
    const url = `https://api.airtable.com/v0/${FRONT_BASE_ID}/${FRONT_TABLE_ID}/${recordId}`;
    const response = await fetch(url, { headers: authHeaders });
    if (!response.ok) throw new Error(`Product ${recordId} not found`);
    const data = await response.json();
    return { product: parseAirtableRecord(data) };
  }

  // PRIMARY PATH: Juan blaty. Look up by {id} field in the consolidated table.
  // This is the only way to reach migrated records — they have new Airtable
  // record IDs but preserve the old ID inside the {id} field for QR compat.
  const juanRecord = await fetchJuanByIdField(recordId);
  if (juanRecord) {
    const product = parseAirtableRecord(juanRecord);
    const thicknessVariants = await fetchJuanThicknessVariants(product);
    setCachedTableId(recordId, JUAN_TABLE_ID);
    return { product, thicknessVariants };
  }

  // FALLBACK PATH: other producers (Kronospan, Egger, …) — still keyed by
  // Airtable record ID in their per-producer tables. The Juan table is excluded
  // from this loop because its records are not addressable by record ID.
  const fallbackTables = TABLE_IDS.filter(t => t !== JUAN_TABLE_ID);
  let data: any = null;
  let foundTableId: string | null = null;

  // Try URL-provided tableId first (if it's a known fallback table)
  if (tableIdHint && fallbackTables.includes(tableIdHint)) {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${tableIdHint}/${recordId}`;
    const response = await fetch(url, { headers: authHeaders });
    if (response.ok) {
      data = await response.json();
      foundTableId = tableIdHint;
      setCachedTableId(recordId, tableIdHint);
    }
  }

  // Try localStorage cache
  if (!data) {
    const cachedTableId = getCachedTableId(recordId);
    if (cachedTableId && fallbackTables.includes(cachedTableId)) {
      const url = `https://api.airtable.com/v0/${BASE_ID}/${cachedTableId}/${recordId}`;
      const response = await fetch(url, { headers: authHeaders });
      if (response.ok) {
        data = await response.json();
        foundTableId = cachedTableId;
      }
    }
  }

  // Loop through remaining fallback tables
  if (!data) {
    for (const tableId of fallbackTables) {
      const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}/${recordId}`;
      const response = await fetch(url, { headers: authHeaders });
      if (response.ok) {
        data = await response.json();
        foundTableId = tableId;
        setCachedTableId(recordId, tableId);
        break;
      }
    }
  }

  if (!data || !foundTableId) {
    throw new Error(`Product ${recordId} not found in any table`);
  }

  return { product: parseAirtableRecord(data) };
}
