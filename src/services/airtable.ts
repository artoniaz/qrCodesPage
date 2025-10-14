import type { Product } from '../types/product';

const AIRTABLE_TOKEN = import.meta.env.VITE_AIRTABLE_TOKEN;
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;
const TABLE_ID = import.meta.env.VITE_AIRTABLE_TABLE_ID;

async function fetchProductsByBaseCode(productBaseCode: string): Promise<any> {
  const filterFormula = encodeURIComponent(`{productBaseCode}='${productBaseCode}'`);
  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?filterByFormula=${filterFormula}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch products by base code: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

export interface ProductWithVariants {
  product: Product;
  variants?: Product[];
}

export async function fetchProduct(recordId: string): Promise<ProductWithVariants> {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${recordId}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch product: ${response.statusText}`);
  }

  const data = await response.json();

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
    productBaseCode: data.fields.productBaseCode || '',
  };

  // If category is 'blat' (lowercase), perform second query
  let variants: Product[] | undefined;
  if (product.category.toLowerCase() === 'blat' && product.productBaseCode) {
    const secondQueryResult = await fetchProductsByBaseCode(product.productBaseCode);
    console.log('Second query result for productBaseCode:', product.productBaseCode);
    console.log(secondQueryResult);

    // Map variants from Airtable response
    if (secondQueryResult.records && Array.isArray(secondQueryResult.records)) {
      variants = secondQueryResult.records.map((record: any) => ({
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
        width: record.fields.width || 0,
        height: record.fields.height || undefined,
        type: record.fields.type || undefined,
        url: record.fields.url || '',
        "url + code": record.fields["url + code"] || '',
        productBaseCode: record.fields.productBaseCode || '',
      }));
    }
  }

  return { product, variants };
}
