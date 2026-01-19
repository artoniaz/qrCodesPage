import type { Product } from '../types/product';

const AIRTABLE_TOKEN = import.meta.env.VITE_AIRTABLE_TOKEN;
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;
const FRONT_BASE_ID = import.meta.env.VITE_AIRTABLE_FRONT_BASE_ID;

// All available table IDs from different product categories
const TABLE_IDS = [
'tblRVfJUWXvulicRm',
'tbl2PygUg7hR2dvAS',
  'tblBYMKX2LLcGH0AT',
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
  const tableIds = productType === 'front' ? [FRONT_TABLE_ID] : TABLE_IDS;

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

      // Helper functions for this table's data
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

      const parseWidth = (widthValue: string | undefined): {
        width_1?: number,
        width_2?: number,
        width_3?: number,
        width_4?: number,
        width_5?: number,
        width_6?: number,
        width_7?: number,
        width_8?: number
      } => {
        if (!widthValue || typeof widthValue !== 'string') return {};
        const widths = widthValue.split(';').map(w => {
          const trimmed = w.trim();
          const parsed = parseInt(trimmed);
          return isNaN(parsed) ? undefined : parsed;
        }).filter(w => w !== undefined);
        return {
          width_1: widths[0],
          width_2: widths[1],
          width_3: widths[2],
          width_4: widths[3],
          width_5: widths[4],
          width_6: widths[5],
          width_7: widths[6],
          width_8: widths[7],
        };
      };

      // Map records to Product type and add to collection
      const products = data.records.map((record: any) => {
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
          // Front-specific fields
          front_typ: record.fields.front_typ || undefined,
          frez_typ: record.fields.frez_typ || undefined,
          kolor: record.fields.kolor || undefined,
          info: record.fields.info || undefined,
          czas_oczekiwania: record.fields.czas_oczekiwania || undefined,
          cena_brutto: parsePrice(record.fields.cena_brutto),
          cena_brutto_laser: parsePrice(record.fields.cena_brutto_laser),
        };
      });

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
  };
}

// Cache interface for recordId → tableId mapping
interface TableCache {
  [recordId: string]: {
    tableId: string;
    timestamp: number;
  };
}

const CACHE_KEY = 'airtable_product_table_cache';
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

export async function fetchProduct(
  recordId: string,
  productType: 'regular' | 'front' = 'regular',
  tableIdHint?: string // NEW: Optional tableId from URL or cache
): Promise<ProductWithVariants> {
  let data: any = null;
  let foundTableId: string | null = null;
  const baseId = productType === 'front' ? FRONT_BASE_ID : BASE_ID;
  const tableIds = productType === 'front' ? [FRONT_TABLE_ID] : TABLE_IDS;

  // OPTIMIZATION 1: Try URL-provided tableId first
  if (tableIdHint && tableIds.includes(tableIdHint)) {
    const url = `https://api.airtable.com/v0/${baseId}/${tableIdHint}/${recordId}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      },
    });

    if (response.ok) {
      data = await response.json();
      foundTableId = tableIdHint;

      // Cache successful lookup for future visits
      if (productType === 'regular') {
        setCachedTableId(recordId, tableIdHint);
      }
    }
  }

  // OPTIMIZATION 2: Try localStorage cache for regular products
  if (!data && productType === 'regular') {
    const cachedTableId = getCachedTableId(recordId);
    if (cachedTableId && tableIds.includes(cachedTableId)) {
      const url = `https://api.airtable.com/v0/${baseId}/${cachedTableId}/${recordId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        },
      });

      if (response.ok) {
        data = await response.json();
        foundTableId = cachedTableId;
      }
      // If cache stale (product moved tables), continue to loop
    }
  }

  // FALLBACK: Loop through tables if both optimizations failed
  if (!data) {
    for (const tableId of tableIds) {
      const url = `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        },
      });

      if (response.ok) {
        data = await response.json();
        foundTableId = tableId;

        // Cache successful lookup for future visits
        if (productType === 'regular') {
          setCachedTableId(recordId, tableId);
        }
        break;
      }
    }
  }

  if (!data || !foundTableId) {
    throw new Error(`Product ${recordId} not found in any table`);
  }

  // Parse main product using helper function
  const product: Product = parseAirtableRecord(data);

  // Handle thickness variants for worktop products (category: "blat")
  let thicknessVariants: Product[] | undefined = undefined;

  if (product.category.toLowerCase() === 'blat') {
    try {
      // Check if calculator_link field exists and has linked record IDs
      if (data.fields.calculator_link &&
          Array.isArray(data.fields.calculator_link) &&
          data.fields.calculator_link.length > 0) {

        const linkedRecordIds = data.fields.calculator_link.filter((id: any) => typeof id === 'string');

        if (linkedRecordIds.length > 0) {
          // Fetch linked records by their IDs
          const linkedProducts: Product[] = [];

          for (const linkedId of linkedRecordIds) {
            // Skip if it's the same record
            if (linkedId === product.id) continue;

            // Try to fetch from each table
            for (const tableId of tableIds) {
              const linkedUrl = `https://api.airtable.com/v0/${baseId}/${tableId}/${linkedId}`;

              try {
                const linkedResponse = await fetch(linkedUrl, {
                  headers: {
                    'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                  },
                });

                if (linkedResponse.ok) {
                  const linkedData = await linkedResponse.json();
                  const linkedProduct = parseAirtableRecord(linkedData);

                  // Only add if thickness is different
                  if (linkedProduct.thickness !== product.thickness) {
                    linkedProducts.push(linkedProduct);
                  }
                  break; // Found the record, move to next linkedId
                }
              } catch (error) {
                // Continue to next table
                continue;
              }
            }
          }

          // Set thicknessVariants if we found any valid variants
          if (linkedProducts.length > 0) {
            thicknessVariants = linkedProducts;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching calculator_link for product:', recordId, error);
      thicknessVariants = undefined;
    }
  }

  return { product, thicknessVariants };
}
