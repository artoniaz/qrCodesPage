Optimization Plan: Reduce API Calls from 1-6 to 1

IMPORTANT IMPLEMENTATION NOTE (Updated 2026-01-19)

The calculator_link optimization has been successfully implemented, BUT with a different approach than originally planned:

PLANNED APPROACH (Didn't Work):
- Use Airtable's expand parameter: ?expand[]=calculator_link
- Goal: Get expanded linked records in single API call

ACTUAL IMPLEMENTATION (What Works):
- Airtable REST API v0 does NOT support the expand parameter for linked records
- Instead: Fetch calculator_link IDs, then fetch each linked record directly by ID
- Result: 2-3 API calls instead of 7-12 (still 67-75% reduction)
- Code location: src/services/airtable.ts lines 291-365

Current Performance After calculator_link Implementation:
- Best case: 2 calls (1 main product + 1 linked variant)
- Average case: 2-3 calls
- Worst case: 3 calls (1 main + 2 linked variants)

This optimization plan assumes calculator_link is already implemented using direct ID fetching (not expand parameter).

Executive Summary

After implementing the calculator_link optimization (reducing 7-12 calls to 2-3 calls), the remaining inefficiency is the sequential table search that loops through up to 6 tables to find which table contains a
product.

Current bottleneck (lines 295-311 in airtable.ts):
for (const tableId of tableIds) { // Loops through up to 6 tables
const url = `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`;
const response = await fetch(url, ...);
if (response.ok) {
data = await response.json();
foundTableId = tableId;
break; // Found - but may have made 1-6 calls
}
}

Result for MAIN PRODUCT fetch:

- Best case: 1 call (product in first table)
- Average case: ~3 calls
- Worst case: 6 calls (product in last table)

Then ADDITIONAL calls for calculator_link variants:
- 1-2 more calls to fetch linked records by ID (if product is a worktop)

Total: 2-8 calls per page load (1-6 for main product + 0-2 for variants)

Recommended Solution: Hybrid Approach

Since you control the link generation system, the optimal solution combines two strategies:

Strategy A (Primary): URL Parameter with tableId

Include tableId in product URLs for deterministic 1-call performance.

Strategy B (Fallback): localStorage Caching

Cache recordId→tableId mappings for old links and bookmarks.

Performance outcome:

- New links with tableId: Always 1 call
- Old/cached links: 1 call after first visit
- Uncached old links: 1-6 calls (graceful degradation)

Implementation Details

Part 1: URL Parameter Support

1.1 Modify ProductPage Component

File: E:\projects\azm_products_page\src\components\ProductPage.tsx (lines 16-38)

Changes needed:
useEffect(() => {
if (!id) {
setError("No product ID provided");
setLoading(false);
return;
}

setLoading(true);
setError(null);

// Determine product type based on URL path
const productType = location.pathname.includes('/product/front/')
? 'front'
: 'regular';

// Extract tableId from query parameters (NEW)
const searchParams = new URLSearchParams(location.search);
const tableId = searchParams.get('table') || undefined;

fetchProduct(id, productType, tableId) // Pass tableId as third parameter
.then((data) => {
setProductData(data);
setLoading(false);
})
.catch((err) => {
setError(err.message || "Failed to load product");
setLoading(false);
});
}, [id, location.pathname, location.search]); // Add location.search to dependencies

1.2 Update Link Generation System

When generating product links, include the table query parameter:

New URL format:
/product/rec2hkOvAAFTTVVTd?table=tblRVfJUWXvulicRm
/product/front/recIfsL5hZkvDeyfz?table=tblHkykZmLJghpL6Z

Backward compatible - old format still works:
/product/rec2hkOvAAFTTVVTd

Table IDs reference:
// Regular products - 6 tables
TABLE_IDS = [
'tblRVfJUWXvulicRm',
'tbl2PygUg7hR2dvAS',
'tblBYMKX2LLcGH0AT',
'tblsIe86QUiwNHxN6',
'tblNItna4sii6GlL9',
'tblsEnC8rEzMpe3rC',
]

// Front products - 1 table
FRONT_TABLE_ID = 'tblHkykZmLJghpL6Z'

Note: You'll need to ensure your link generation system knows which table each product is in. This mapping should already exist in the system that manages product data.

Part 2: localStorage Caching (Fallback)

2.1 Add Cache Helper Functions

File: E:\projects\azm_products_page\src\services\airtable.ts (before line 174)

// Cache interface for recordId → tableId mapping
interface TableCache {
[recordId: string]: {
tableId: string;
timestamp: number;
};
}

const CACHE_KEY = 'airtable_product_table_cache';
const CACHE_DURATION = 30 _ 24 _ 60 _ 60 _ 1000; // 30 days

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

2.2 Modify fetchProduct Function

File: E:\projects\azm_products_page\src\services\airtable.ts (lines 174-199)

Replace the current implementation with:

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

// Rest of the parsing logic remains unchanged...
// (includes calculator_link fetching by ID - see actual implementation in airtable.ts)

Note: The calculator_link linked records are fetched separately by ID (not using expand parameter which doesn't work with Airtable REST API v0).

Part 3: Update Type Signature

File: E:\projects\azm_products_page\src\services\airtable.ts (around line 174)

The function signature changes from:
export async function fetchProduct(
recordId: string,
productType: 'regular' | 'front' = 'regular'
): Promise<ProductWithVariants>

To:
export async function fetchProduct(
recordId: string,
productType: 'regular' | 'front' = 'regular',
tableIdHint?: string // NEW optional parameter
): Promise<ProductWithVariants>

Performance Comparison
┌──────────────────────────────────────┬────────────┬───────────────────────┬─────────────────┐
│ Scenario │ Original │ After calculator_link │ After This Plan │
├──────────────────────────────────────┼────────────┼───────────────────────┼─────────────────┤
│ First visit (new link with tableId) │ 7-12 calls │ 2-3 calls │ 2-3 calls ✓ │
├──────────────────────────────────────┼────────────┼───────────────────────┼─────────────────┤
│ First visit (old link, no cache) │ 7-12 calls │ 2-9 calls │ 2-9 calls │
├──────────────────────────────────────┼────────────┼───────────────────────┼─────────────────┤
│ Repeat visit (cached) │ 7-12 calls │ 2-3 calls │ 2-3 calls ✓ │
├──────────────────────────────────────┼────────────┼───────────────────────┼─────────────────┤
│ Repeat visit (new link with tableId) │ 7-12 calls │ 2-3 calls │ 2-3 calls ✓ │
└──────────────────────────────────────┴────────────┴───────────────────────┴─────────────────┘
Overall reduction:

- From original: 75-83% reduction (7-12 calls → 2-3 calls)
- From calculator_link: Same performance (main product table lookup still needs optimization)

Note: The calculator_link optimization reduced thickness variant fetching (6 table searches → 1-2 direct ID fetches).
The remaining optimization in this plan focuses on reducing the main product table lookup (1-6 calls → 1 call).

Critical Files

1.  E:\projects\azm_products_page\src\services\airtable.ts

- Lines 174-199: fetchProduct function (PRIMARY CHANGES)
- Before line 174: Add cache helper functions

2.  E:\projects\azm_products_page\src\components\ProductPage.tsx

- Lines 16-38: useEffect hook (extract tableId from URL query)

3.  Your link generation system (external to this repo)

- Update to include ?table=<tableId> parameter in product URLs

Edge Cases & Handling

1.  tableId Invalid or Product Not in Specified Table

Scenario: URL has ?table=tblXXX but product is not in that table (data migration, incorrect link)

Behavior: Falls back to loop through all tables

Code: Lines checking tableIds.includes(tableIdHint) ensure invalid table IDs are rejected

2.  localStorage Disabled or Full

Scenario: User has localStorage disabled (privacy mode) or quota exceeded

Behavior: Caching fails silently, falls back to URL hint or loop

Code: try-catch blocks in getCachedTableId() and setCachedTableId()

3.  Cache Stale (Product Moved Tables)

Scenario: Product was in table A (cached), but moved to table B

Behavior: Cache lookup returns 404, falls back to loop, updates cache

Code: if (response.ok) check after cache lookup - continues to loop if failed

4.  Old Links Without tableId

Scenario: Bookmarked links, external links, or links generated before this update

Behavior: First visit uses loop (1-6 calls), subsequent visits use cache (1 call)

Code: Both optimizations skip gracefully if tableIdHint undefined

5.  Front Products

Scenario: Front products only have 1 table (already optimized)

Behavior: Always 1 call regardless (cache not needed but doesn't hurt)

Code: productType === 'front' ? [FRONT_TABLE_ID] : TABLE_IDS

Testing Strategy

Manual Testing

Test 1: New Link with tableId

1.  Generate a product link with ?table=tblRVfJUWXvulicRm
2.  Open in fresh browser (clear localStorage)
3.  Verify Network tab shows exactly 1 API call
4.  Verify product page loads correctly

Test 2: Old Link (No tableId, First Visit)

1.  Clear localStorage
2.  Open product with URL like /product/rec2hkOvAAFTTVVTd (no table param)
3.  Verify Network tab shows 1-6 API calls
4.  Verify product page loads correctly
5.  Check localStorage - should contain cached tableId

Test 3: Old Link (Cached)

1.  After Test 2, refresh the same product page
2.  Verify Network tab shows exactly 1 API call
3.  Verify product page loads correctly

Test 4: Invalid tableId in URL

1.  Open URL with ?table=invalid_table_id
2.  Verify fallback to loop works (1-6 calls)
3.  Verify product page loads correctly

Test 5: Cache Expiration

1.  Manually edit localStorage to set an old timestamp (>30 days)
2.  Reload product page
3.  Verify expired cache is ignored (1-6 calls)
4.  Verify new cache entry is created

Test 6: Front Products

1.  Open front product with /product/front/recXXX
2.  Verify always 1 call (unchanged from current)
3.  Test with and without ?table=tblHkykZmLJghpL6Z

Browser Console Checks

- No errors related to localStorage
- Cache warnings (if any) appear in console but don't break functionality
- Network tab shows correct number of API calls

Edge Case Testing

- localStorage disabled: Test in private browsing mode
- localStorage full: Fill localStorage to quota, verify graceful degradation
- Multiple tabs: Open same product in multiple tabs, verify cache consistency
- Product migration: Move product to different table in Airtable, verify cache updates

Rollback Strategy

If issues arise, rollback is straightforward:

Step 1: Revert airtable.ts

1.  Remove cache helper functions
2.  Restore original fetchProduct signature (remove tableIdHint parameter)
3.  Remove optimization code (lines checking tableIdHint and cache)
4.  Keep the loop logic as-is

Step 2: Revert ProductPage.tsx

1.  Remove searchParams and tableId extraction
2.  Remove location.search from useEffect dependencies
3.  Call fetchProduct(id, productType) without third parameter

Step 3: Link Generation (Optional)

- Old links continue to work
- Can gradually remove ?table= parameter from link generation

Impact of rollback: Returns to 2-8 API calls per page load (same as current calculator_link implementation)

Migration Path

PREREQUISITE: calculator_link optimization (COMPLETED)
- Status: ✓ Implemented (2026-01-19)
- Current state: 2-8 API calls per page load (down from 7-12)

Phase 1: Implement Code Changes (This Plan)

- Add cache helpers to airtable.ts
- Modify fetchProduct to accept tableIdHint
- Update ProductPage to extract tableId from URL
- Deploy and test

Impact: Reduces main product table lookup from 1-6 calls to 1 call, backward compatible with all existing links

Phase 2: Update Link Generation System

- Identify where product links are generated
- Add logic to include ?table=<tableId> parameter
- Deploy link generation changes

Impact: New links get deterministic 1-call performance

Phase 3: Monitor & Optimize

- Track cache hit rate in analytics
- Monitor API call reduction
- Adjust cache duration if needed (currently 30 days)

Impact: Continuous improvement based on real-world data

Success Metrics

Performance Targets

- Average API calls per page load: ≤2.5 (down from current 2-8)
- Main product lookup: 1 call (down from 1-6 with cache/URL hint)
- Cache hit rate: ≥90% after 1 week
- First-load latency: ≤400ms (down from 500-3000ms worst case)
- Repeat visit latency: ≤200ms (1 main product call + 1-2 variant calls)

User Experience

- No visible changes to UI behavior
- Faster page loads (especially repeat visits)
- No new errors or broken features
- Graceful degradation for edge cases

Code Quality

- Clean separation of concerns (cache, URL hint, fallback)
- Comprehensive error handling
- Backward compatible with existing links
- Well-documented code

Additional Considerations

localStorage Size Management

- Each cache entry: ~60 bytes (recordId + tableId + timestamp)
- 1000 products: ~60KB
- 5MB localStorage limit: ~80,000 products
- Conclusion: Size is not a concern for this use case

Cache Invalidation Strategy

- Current: 30-day expiration (reasonable for stable product catalogs)
- Future: Could add version key to force cache refresh on deployment
- Alternative: Add admin button to "Clear product cache" if needed

Airtable Rate Limits

- Current: Airtable allows 5 requests/second per base
- Impact: This optimization significantly reduces API usage
- Benefit: Less likely to hit rate limits, especially with high traffic

SEO Implications

- URLs with ?table= parameter are SEO-friendly (query params are fine)
- Old URLs without parameter continue to work (no broken links)
- Canonical URLs can remain without table parameter if desired

Verification Steps

After implementing this plan:

1.  Network Analysis:

- Open DevTools Network tab
- Load a product page with new link format
- Verify 2-3 Airtable API calls (1 main product + 1-2 thickness variants if applicable)
- Verify first call returns calculator_link IDs, subsequent calls fetch those records

2.  Cache Verification:

- Open DevTools Application → Local Storage
- Find airtable_product_table_cache key
- Verify it contains recordId→tableId mapping
- Check timestamp is recent

3.  Functionality Check:

- All product types load correctly
- Calculator shows thickness variants (if applicable)
- Prices display correctly
- No console errors

4.  Performance Measurement:

- Compare before/after API call counts
- Measure page load time improvement
- Verify cache hit rate over time

Summary

This hybrid optimization strategy leverages both URL parameters (for new links) and localStorage caching (for old links and bookmarks) to achieve:

- Always 1 API call for new product links
- 1 API call after first visit for old/bookmarked links
- Graceful fallback for edge cases
- Backward compatible with all existing links
- Zero breaking changes to external systems (though they can benefit from updating)
