import type { Product } from '../types/product';

// Which thickness variant of a worktop may be priced, and which one the page
// should open on. Both the calculator and the product page around it ask these
// questions, and they must answer them identically — otherwise the header would
// list the dimensions of one variant while the calculator prices another.

// The lengths a variant can actually be cut to. Airtable spells "no data" as 0
// and the API already filters those out, but a response served from the edge
// cache (s-maxage=300 in api/product.ts) can still predate that change, so the
// zeroes are dropped here too.
export function priceableLengths(product: Product): number[] {
  return [product.length_1, product.length_2].filter(
    (l): l is number => typeof l === 'number' && l > 0,
  );
}

// A worktop's price is a per-metre rate multiplied by the chosen length, so
// without a length there is no price to show — only a rate that would be
// mistaken for one. Same for the width: it selects which rate applies.
export function isPriceable(product: Product): boolean {
  if (product.unavailable === true) return false;
  return priceableLengths(product).length > 0 && (product.width_1 ?? 0) > 0;
}

// The main record and its thickness variants as one list, thinnest first — the
// order the chips are offered in. One entry per thickness: Airtable should hold
// a single row per (dekor, struktura, kolekcja, grubość), but if it ever holds
// two, the one that can be priced is the one worth offering.
export function worktopVariants(
  product: Product,
  thicknessVariants?: Product[],
): Product[] {
  const byThickness = new Map<number, Product>();
  for (const variant of [product, ...(thicknessVariants ?? [])]) {
    const seen = byThickness.get(variant.thickness);
    if (!seen || (!isPriceable(seen) && isPriceable(variant))) {
      byThickness.set(variant.thickness, variant);
    }
  }
  return [...byThickness.values()].sort((a, b) => a.thickness - b.thickness);
}

// The variant to open on. A customer who scanned the QR code of an unpriceable
// sample gets the nearest thickness that does have a price rather than an empty
// calculator; when nothing can be priced, the scanned record stays selected and
// the calculator says so.
export function pickPriceableVariant(
  product: Product,
  thicknessVariants?: Product[],
): Product {
  if (isPriceable(product)) return product;
  return worktopVariants(product, thicknessVariants).find(isPriceable) ?? product;
}
