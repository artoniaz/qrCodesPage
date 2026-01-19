Implementation Plan: Optimize Thickness Variants with calculator_link Field

Overview

Replace the inefficient code-based search for thickness variants with Airtable's calculator_link linked records field using the expand parameter. This reduces API calls from 7-12 per page load to 1-6 per page load  
 (83-91% reduction).

User Requirement Clarification

Important: If calculator_link field is empty or doesn't exist in a table:

- This is a valid state, not an error
- It means the calculator works with only that single product (no other thickness options)
- The UI already handles this correctly - WorktopCalculator will show only one thickness option

Current vs New Approach

Current Implementation (Inefficient)

1.  Fetch product by ID → Loop through 6 tables (1-6 API calls)
2.  If category is "blat" and has code → Call fetchProductsByCode()
3.  fetchProductsByCode() → Search all 6 tables with filterByFormula (6 API calls)
4.  Filter results for different thickness variants
    Total: 7-12 API calls

New Implementation (Optimized)

1.  Fetch product by ID with ?expand[]=calculator_link → Loop through 6 tables (1-6 API calls)
2.  Parse calculator_link from expanded response (0 additional API calls)
3.  Map linked records to Product objects
    Total: 1-6 API calls

Critical Files to Modify

1.  src/services/airtable.ts (Primary Changes)

Lines 174-340: fetchProduct() function

- Add ?expand[]=calculator_link parameter to URL
- Parse expanded calculator_link records from response
- Remove call to fetchProductsByCode()

Lines 202-323: Extract parsing logic

- Create reusable parseAirtableRecord(record: any): Product helper function
- Move helper functions (parsePrice, parseLength, parseWidth) inside
- Use for both main product and linked records

Lines 25-172: fetchProductsByCode() function

- Mark as deprecated (optional - can be removed later)
- No longer used for thickness variants

2.  Files to Test (No Changes Required)

- src/components/ProductPage.tsx (lines 78-79, 169-177)
- src/components/WorktopCalculator.tsx (lines 18-25, 127-135)
- src/types/product.ts

Implementation Steps

Step 1: Create parseAirtableRecord() Helper Function

Extract the duplicated parsing logic into a reusable function:

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

Location: Add this function before fetchProduct() (around line 173)

Step 2: Modify fetchProduct() to Use Expand Parameter

Replace the current implementation (lines 174-340) with:

export async function fetchProduct(recordId: string, productType: 'regular' | 'front' = 'regular'): Promise<ProductWithVariants> {
// Try to fetch from each table until we find the record
let data: any = null;
let foundTableId: string | null = null;
const baseId = productType === 'front' ? FRONT_BASE_ID : BASE_ID;
const tableIds = productType === 'front' ? [FRONT_TABLE_ID] : TABLE_IDS;

for (const tableId of tableIds) {
// Add expand parameter for calculator_link field
const url = `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}?expand[]=calculator_link`;

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

// Parse main product using helper function
const product: Product = parseAirtableRecord(data);

// Handle thickness variants for worktop products (category: "blat")
let thicknessVariants: Product[] | undefined = undefined;

if (product.category.toLowerCase() === 'blat') {
try {
// Check if calculator_link field exists and has expanded records
if (data.fields.calculator_link &&
Array.isArray(data.fields.calculator_link) &&
data.fields.calculator_link.length > 0) {

         // Check if records are expanded (objects) vs just IDs (strings)
         const firstItem = data.fields.calculator_link[0];

         if (typeof firstItem === 'object' && firstItem.fields) {
           // Records are expanded - parse them
           thicknessVariants = data.fields.calculator_link
             .filter((linkedRecord: any) => linkedRecord && linkedRecord.fields)
             .map((linkedRecord: any) => parseAirtableRecord(linkedRecord))
             .filter((variant: Product) =>
               variant.id !== product.id && variant.thickness !== product.thickness
             );

           // If no valid variants after filtering, set to undefined
           if (thicknessVariants.length === 0) {
             thicknessVariants = undefined;
           }
         } else {
           // calculator_link contains IDs instead of expanded records
           // This means expand parameter didn't work - calculator works with single product only
           console.warn('calculator_link not expanded for product:', recordId);
           thicknessVariants = undefined;
         }
       } else {
         // No calculator_link field or empty array
         // Calculator works with only this single product (valid state)
         thicknessVariants = undefined;
       }
     } catch (error) {
       console.error('Error parsing calculator_link for product:', recordId, error);
       thicknessVariants = undefined;
     }

}

return { product, thicknessVariants };
}

Step 3: Mark fetchProductsByCode() as Deprecated (Optional)

Add deprecation comment above the function (line 25):

/\*\*

- @deprecated This function is no longer used for fetching thickness variants.
- Thickness variants are now fetched using Airtable's expand parameter on calculator_link field.
- Kept for potential future use cases.
  \*/
  async function fetchProductsByCode(code: string, productType: 'regular' | 'front' = 'regular'): Promise<Product[]> {
  // ... existing implementation (unchanged)
  }

Edge Cases & Handling

1.  calculator_link Field Missing or Empty

- Behavior: thicknessVariants = undefined
- UI Impact: Calculator works with single product only (no thickness selector shown)
- This is a valid state per user requirements

2.  calculator_link Contains Only IDs (Not Expanded)

- Cause: Expand parameter failed or unsupported
- Behavior: Log warning, set thicknessVariants = undefined
- UI Impact: Calculator works with single product only

3.  Circular References

- Example: Juan 28mm links to Juan 38mm, which links back to Juan 28mm
- Solution: Filter by variant.id !== product.id
- Already handled in filter logic

4.  Invalid Linked Records

- Cause: Linked record has missing or malformed fields
- Solution: Filter with linkedRecord && linkedRecord.fields check
- Wrapped in try-catch for safety

5.  Non-Worktop Products

- Products with category !== "blat"
- Behavior: Skip thickness variant logic entirely
- No changes to existing behavior

Testing Checklist

Manual Testing

Test 1: Worktop with calculator_link (Juan products)

- Open Juan 28mm product page
- Verify thickness selector shows 28mm and 38mm options
- Switch between thicknesses
- Verify prices update correctly
- Check Network tab: Should see 1-6 API calls (not 7-12)

Test 2: Worktop without calculator_link

- Open a worktop product that doesn't have calculator_link set
- Verify product page loads without errors
- Verify calculator shows only one thickness (no selector)
- Verify prices display correctly

Test 3: Non-worktop products

- Open a panel (płyta) product
- Verify loads correctly (unaffected)
- Open a front product
- Verify loads correctly (unaffected)

Test 4: Network Performance

- Open DevTools Network tab
- Load a Juan 28mm product
- Count Airtable API calls
- Expected: 1-6 calls (down from 7-12)

Browser Console Checks

- No unexpected errors in console
- Warning messages for non-expanded calculator_link (if any)
- No errors when calculator_link is missing

Performance Impact
┌────────────────────────┬────────┬───────┬───────────────┐
│ Metric │ Before │ After │ Improvement │
├────────────────────────┼────────┼───────┼───────────────┤
│ Best case API calls │ 7 │ 1 │ 86% reduction │
├────────────────────────┼────────┼───────┼───────────────┤
│ Average case API calls │ ~9 │ ~3 │ 67% reduction │
├────────────────────────┼────────┼───────┼───────────────┤
│ Worst case API calls │ 12 │ 6 │ 50% reduction │
└────────────────────────┴────────┴───────┴───────────────┘
Success Criteria

1.  Functionality:

- All worktop products load correctly
- Thickness variants work when calculator_link is present
- Single-product calculators work when calculator_link is missing
- Non-worktop products unaffected

2.  Performance:

- API calls reduced by at least 50%
- No increase in page load time
- No increase in error rates

3.  Code Quality:

- No code duplication (parseAirtableRecord reused)
- Proper error handling for all edge cases
- Clear comments explaining logic
- Backward compatible with UI components

4.  User Experience:

- No visible changes to UI behavior
- Faster page loads
- No new errors or broken features

Rollback Plan

If issues arise, the rollback is straightforward:

1.  Remove ?expand[]=calculator_link from URL
2.  Re-add the fetchProductsByCode() call in fetchProduct():
    if (product.category.toLowerCase() === 'blat' && product.code) {
    const variants = await fetchProductsByCode(product.code, productType);
    thicknessVariants = variants.filter(v =>
    v.id !== product.id && v.thickness !== product.thickness
    );
    }
3.  Remove parseAirtableRecord() function
4.  Restore original parsing logic in fetchProduct()
