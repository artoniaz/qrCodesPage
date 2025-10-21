import type { Product } from '../types/product';

const AIRTABLE_TOKEN = import.meta.env.VITE_AIRTABLE_TOKEN;
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;

// All available table IDs from different product categories
const TABLE_IDS = [
  'tbl2PygUg7hR2dvAS',
  'tblhgzE6iRfjy5m5y',
  'tbllC7rTLThhiTcce',
  'tblUjDKKgMPblWG5U',
  'tblC0XVfcCjdW3L0v',
  'tblsEnC8rEzMpe3rC',
];

export interface ProductWithVariants {
  product: Product;
}

export async function fetchProduct(recordId: string): Promise<ProductWithVariants> {
  // Try to fetch from each table until we find the record
  let data: any = null;
  let foundTableId: string | null = null;

  for (const tableId of TABLE_IDS) {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}/${recordId}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
      },
    });

    if (response.ok) {
      data = await response.json();
      foundTableId = tableId;
      console.log(`Found product in table: ${tableId}`);
      break;
    }
  }

  if (!data || !foundTableId) {
    throw new Error(`Product not found in any table`);
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

  // Parse length values
  const parsedLengths = parseLength(data.fields.length);

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
    width: data.fields.width || 0,
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
  };

  return { product };
}
