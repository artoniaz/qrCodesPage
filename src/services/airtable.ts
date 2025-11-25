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

// Fetch products by code (for finding thickness variants)
async function fetchProductsByCode(code: string, productType: 'regular' | 'front' = 'regular'): Promise<Product[]> {
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

export async function fetchProduct(recordId: string, productType: 'regular' | 'front' = 'regular'): Promise<ProductWithVariants> {
  // Try to fetch from each table until we find the record
  let data: any = null;
  let foundTableId: string | null = null;
  const baseId = productType === 'front' ? FRONT_BASE_ID : BASE_ID;
  const tableIds = productType === 'front' ? [FRONT_TABLE_ID] : TABLE_IDS;

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
      break;
    }
  }

  if (!data || !foundTableId) {
    throw new Error(`Product ${recordId} not found in any table`);
  }

  // Helper function to parse price strings from CSV (format: "PLN 123,45") or numbers
  const parsePrice = (priceValue: string | number | undefined): number | undefined => {
    if (priceValue === undefined || priceValue === null) return undefined;

    // If already a number, return it
    if (typeof priceValue === 'number') return priceValue;

    // If string, parse it
    if (typeof priceValue === 'string') {
      const cleaned = priceValue.replace('PLN', '').replace(',', '.').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? undefined : parsed;
    }

    return undefined;
  };

  // Helper function to parse length string (format: "3050; 4200")
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

  // Helper function to parse width string (format: "600; 800; 1200")
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

  // Parse length and width values
  const parsedLengths = parseLength(data.fields.length);
  const parsedWidths = parseWidth(data.fields.width);

  // Map Airtable response to Product type
  const product: Product = {
    id: data.id,
    decor: data.fields.decor || '',
    structure: data.fields.structure || '',
    name: data.fields.name || '',
    sellUnit: data.fields.sellUnit || '',
    price: data.fields.price || 0,
    category: data.fields.category || '',
    description: data.fields.description || '',
    code: data.fields.code || '',
    thickness: data.fields.thickness || 0,
    typePrice: data.fields.typePrice || '',
    width: data.fields.width || undefined,
    width_1: parsedWidths.width_1,
    width_2: parsedWidths.width_2,
    width_3: parsedWidths.width_3,
    width_4: parsedWidths.width_4,
    width_5: parsedWidths.width_5,
    width_6: parsedWidths.width_6,
    width_7: parsedWidths.width_7,
    width_8: parsedWidths.width_8,
    height: data.fields.height || undefined,
    type: data.fields.type || undefined,
    url: data.fields.url || '',
    "url + code": data.fields["url + code"] || '',
    producer: data.fields.producer || undefined,
    label: data.fields.label || undefined,
    // Worktop-specific fields
    length: data.fields.length || undefined,
    length_1: parsedLengths.length_1,
    length_2: parsedLengths.length_2,
    side: data.fields.side || undefined,
    // 1-sided prices
    price_600_m_1: parsePrice(data.fields.price_600_m_1),
    price_635_m_1: parsePrice(data.fields.price_635_m_1),
    price_650_m_1: parsePrice(data.fields.price_650_m_1),
    price_700_m_1: parsePrice(data.fields.price_700_m_1),
    price_800_m_1: parsePrice(data.fields.price_800_m_1),
    price_900_m_1: parsePrice(data.fields.price_900_m_1),
    price_1200_m_1: parsePrice(data.fields.price_1200_m_1),
    price_1300_m_1: parsePrice(data.fields.price_1300_m_1),
    // 2-sided prices
    price_600_m_2: parsePrice(data.fields.price_600_m_2),
    price_700_m_2: parsePrice(data.fields.price_700_m_2),
    price_800_m_2: parsePrice(data.fields.price_800_m_2),
    price_900_m_2: parsePrice(data.fields.price_900_m_2),
    price_1200_m_2: parsePrice(data.fields.price_1200_m_2),
    // Front-specific fields
    front_typ: data.fields.front_typ || undefined,
    frez_typ: data.fields.frez_typ || undefined,
    kolor: data.fields.kolor || undefined,
    info: data.fields.info || undefined,
    czas_oczekiwania: data.fields.czas_oczekiwania || undefined,
    cena_brutto: parsePrice(data.fields.cena_brutto),
  };

  // Fetch thickness variants by code from ALL tables for blat category only
  let thicknessVariants: Product[] | undefined = undefined;
  if (product.category.toLowerCase() === 'blat' && product.code) {
    try {
      const variants = await fetchProductsByCode(product.code, productType);
      // Filter out the current product and keep only variants with different thickness
      thicknessVariants = variants.filter(v =>
        v.id !== product.id && v.thickness !== product.thickness
      );
    } catch (error) {
      // Silently fail if thickness variants can't be fetched
    }
  }

  return { product, thicknessVariants };
}
