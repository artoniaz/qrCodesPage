import { useState, useEffect, useLayoutEffect, useRef } from "react";
import type { Product } from "../types/product";
import {
  isPriceable,
  pickPriceableVariant,
  priceableLengths,
  worktopVariants,
} from "../lib/worktop";
import "./WorktopCalculator.css";

interface WorktopCalculatorProps {
  product: Product;
  thicknessVariants?: Product[];
}

interface WidthVariant {
  width: number;
  hasSide1: boolean;
  hasSide2: boolean;
  price_1?: number;
  price_2?: number;
}

const VAT_RATE = 1.23;

// Shown instead of a price when nothing about the product can be priced. The
// customer is at a kiosk in the showroom, so the way forward is a person.
const UNAVAILABLE_NOTICE =
  "Ten wariant jest chwilowo niedostępny — po cenę zapytaj obsługę.";

export default function WorktopCalculator({ product: initialProduct, thicknessVariants }: WorktopCalculatorProps) {
  // Thicknesses on offer, thinnest first. Variants that cannot be priced stay
  // on the list — the QR code the customer scanned may well be on one of them,
  // and hiding it would leave them wondering whether they scanned the wrong
  // sample.
  const variants = worktopVariants(initialProduct, thicknessVariants);

  // State for selected thickness variant. Opens on the scanned record unless it
  // has no price to show, in which case the nearest priceable thickness wins.
  const [selectedThickness, setSelectedThickness] = useState<number>(
    () => pickPriceableVariant(initialProduct, thicknessVariants).thickness,
  );

  // Get the current product based on selected thickness
  const product =
    variants.find((v) => v.thickness === selectedThickness) ?? initialProduct;

  // Determine if product can have both sides (but not for SL label)
  const isSlimLine = product.label === "SL";
  const canChooseSide = product.side === "1_2" && !isSlimLine;

  // Determine if product is Kronospan (per-item pricing, not per-meter)
  const isKronospan = product.producer === "Kronospan";

  // New Juan schema: JSON pricing map keyed by "WxLx<sideKey>" where <sideKey> varies
  // per product (some use "1"/"2", others "0_1"/"2"). The mapping is provided via
  // product.sideKeys. Values in the map are net price PER METER — multiplication
  // by the selected length happens in calculatePrice (confirmed: same value appears
  // for both 3050 and 4200 entries of the same width+side).
  const usesPriceMap = !!product.prices;
  const lookupMapPrice = (w: number, l: number, s: 1 | 2): number | undefined => {
    const sideKey = product.sideKeys?.[s];
    if (!sideKey) return undefined;
    return product.prices?.[`${w}x${l}x${sideKey}`];
  };

  // State management
  const [selectedSide, setSelectedSide] = useState<1 | 2>(1);
  const [selectedWidth, setSelectedWidth] = useState<number | null>(null);
  const [selectedLength, setSelectedLength] = useState<number | null>(null);

  // Get available lengths from product
  const availableLengths: number[] = priceableLengths(product);

  // Build available width variants from parsed width values
  const availableWidths: number[] = [];
  if (product.width_1) availableWidths.push(product.width_1);
  if (product.width_2) availableWidths.push(product.width_2);
  if (product.width_3) availableWidths.push(product.width_3);
  if (product.width_4) availableWidths.push(product.width_4);
  if (product.width_5) availableWidths.push(product.width_5);
  if (product.width_6) availableWidths.push(product.width_6);
  if (product.width_7) availableWidths.push(product.width_7);
  if (product.width_8) availableWidths.push(product.width_8);

  // For legacy products: per-side price per width comes from price_{width}_m_{side} fields.
  // For new Juan schema: derive price_1/price_2 as "is there ANY length with a price for this width+side?"
  // so the width chip filter works the same way regardless of mode.
  const widthVariants: WidthVariant[] = availableWidths.map(width => {
    if (usesPriceMap) {
      const hasSide1 = availableLengths.some(l => lookupMapPrice(width, l, 1) !== undefined);
      const hasSide2 = availableLengths.some(l => lookupMapPrice(width, l, 2) !== undefined);
      return {
        width,
        hasSide1,
        hasSide2,
        // price_1/price_2 intentionally left undefined; price-map path reads from lookupMapPrice.
      };
    }
    const priceField_1 = `price_${width}_m_1` as keyof Product;
    const priceField_2 = `price_${width}_m_2` as keyof Product;
    const price_1 = product[priceField_1] as number | undefined;
    const price_2 = product[priceField_2] as number | undefined;
    return {
      width,
      hasSide1: price_1 !== undefined,
      hasSide2: price_2 !== undefined,
      price_1,
      price_2,
    };
  });

  // Lengths available for the current (width, side) — only meaningful for the price-map path
  const lengthsForCurrent: number[] = usesPriceMap && selectedWidth !== null
    ? availableLengths.filter(l => lookupMapPrice(selectedWidth, l, selectedSide) !== undefined)
    : availableLengths;

  // Whether this thickness can be priced at all. False only for records Airtable
  // has not finished filling in; every combination of the pickers below would
  // otherwise show a per-metre rate as though it were a finished price.
  const variantPriceable = isPriceable(product);

  // Set initial selections only if not already set, or if current selection is invalid
  useEffect(() => {
    // Only set width if not selected yet, or if current selection is not available
    if (widthVariants.length > 0) {
      const currentWidthVariant = selectedWidth ? widthVariants.find(v => v.width === selectedWidth) : null;
      const currentWidthHasPrice = currentWidthVariant && (selectedSide === 1 ? currentWidthVariant.hasSide1 : currentWidthVariant.hasSide2);

      if (!selectedWidth || !currentWidthHasPrice) {
        // Find first variant that has price for current side
        const firstAvailable = widthVariants.find(v =>
          selectedSide === 1 ? v.hasSide1 : v.hasSide2
        );
        if (firstAvailable) {
          setSelectedWidth(firstAvailable.width);
        }
      }
    }

    // Only set length if not selected yet, or if current selection is not available
    if (lengthsForCurrent.length > 0 && (selectedLength === null || !lengthsForCurrent.includes(selectedLength))) {
      setSelectedLength(lengthsForCurrent[0]);
    }
  }, [selectedSide, selectedThickness, widthVariants, lengthsForCurrent, selectedWidth, selectedLength]);

  // Calculate price based on selections
  const calculatePrice = () => {
    if (!variantPriceable) return null;
    if (selectedWidth === null || selectedLength === null) return null;

    let netPrice: number;

    if (usesPriceMap) {
      const priceValue = lookupMapPrice(selectedWidth, selectedLength, selectedSide);
      if (priceValue === undefined) return null;
      // Prices in the new Juan map are per-meter; multiply by length in meters.
      netPrice = priceValue * (selectedLength / 1000);
    } else {
      const variant = widthVariants.find(v => v.width === selectedWidth);
      if (!variant) return null;

      const priceValue = selectedSide === 1 ? variant.price_1 : variant.price_2;
      if (!priceValue) return null;

      if (isKronospan) {
        // For Kronospan, the price is already for the whole item, not per meter
        netPrice = priceValue;
      } else {
        // For other producers, price is per meter
        const lengthInMeters = selectedLength / 1000;
        netPrice = priceValue * lengthInMeters;
      }
    }

    const grossPrice = netPrice * VAT_RATE;

    return {
      net: netPrice.toFixed(2),
      gross: grossPrice.toFixed(2),
    };
  };

  const price = calculatePrice();
  const hasPrice = price !== null;

  // The price bar is pinned to the bottom of the screen (position: fixed), so
  // it takes no room in the layout. The page has to reserve that room or the
  // bar would cover the last row of chips. The height is MEASURED rather than
  // computed from the tokens: the type scale is fluid (clamp), so any calc()
  // formula would drift on the first change of screen width.
  const priceBarRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const bar = priceBarRef.current;
    if (!bar) return;

    const apply = () => {
      root.style.setProperty("--azm-bottom-bar", `${bar.offsetHeight}px`);
    };
    apply();

    const observer = new ResizeObserver(apply);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      // Without this the reservation would survive a move to a product that
      // has no calculator.
      root.style.removeProperty("--azm-bottom-bar");
    };
  }, [hasPrice]);

  const getSideLabel = (side: 1 | 2) => {
    return side === 1 ? "jednostronnie zaoblony" : "obustronnie zaoblony";
  };

  return (
    <div className="worktop-calculator">
      <div className="calculator-header">
        <h3>Kalkulator ceny</h3>
      </div>

      <div className="calculator-options">
        {/* Thickness selection - only if variants exist */}
        {variants.length > 1 && (
          <div className="option-group">
            <label className="option-label">Grubość:</label>
            <div className="chip-selector">
              {variants.map((variant) => {
                const priceable = isPriceable(variant);
                return (
                  <button
                    key={variant.thickness}
                    className={`chip ${selectedThickness === variant.thickness ? 'chip-active' : ''} ${priceable ? '' : 'chip-unavailable'}`}
                    disabled={!priceable}
                    onClick={() => setSelectedThickness(variant.thickness)}
                  >
                    {variant.thickness}mm
                    {!priceable && <span className="chip-note">niedostępne</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Every remaining picker only makes sense for a variant that has a
            price. When it has none, the customer is told so instead. */}
        {!variantPriceable && (
          <p className="calculator-notice">{UNAVAILABLE_NOTICE}</p>
        )}

        {/* Side selection - only if product supports both */}
        {variantPriceable && canChooseSide && (
          <div className="option-group">
            <label className="option-label">Zaoblenie:</label>
            <div className="chip-selector">
              <button
                className={`chip ${selectedSide === 1 ? 'chip-active' : ''}`}
                onClick={() => setSelectedSide(1)}
              >
                {getSideLabel(1)}
              </button>
              <button
                className={`chip ${selectedSide === 2 ? 'chip-active' : ''}`}
                onClick={() => setSelectedSide(2)}
              >
                {getSideLabel(2)}
              </button>
            </div>
          </div>
        )}

        {/* Width selection */}
        {variantPriceable && (
          <div className="option-group">
            <label className="option-label">Szerokość:</label>
            <div className="chip-selector">
              {widthVariants.map((variant) => {
                const hasPrice = selectedSide === 1 ? variant.hasSide1 : variant.hasSide2;
                if (!hasPrice) return null;
                return (
                  <button
                    key={variant.width}
                    className={`chip ${selectedWidth === variant.width ? 'chip-active' : ''}`}
                    onClick={() => setSelectedWidth(variant.width)}
                  >
                    {variant.width}mm
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Length selection */}
        {variantPriceable && (
          <div className="option-group">
            <label className="option-label">Długość:</label>
            <div className="chip-selector">
              {lengthsForCurrent.map((length) => (
                <button
                  key={length}
                  className={`chip ${selectedLength === length ? 'chip-active' : ''}`}
                  onClick={() => setSelectedLength(length)}
                >
                  {(length / 1000).toFixed(2)}m
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Price display */}
      {price && (
        <div className="price-display" ref={priceBarRef}>
          <div className="price-card">
            <div className="price-details">
              <div className="price-row">
                <span>Cena netto:</span>
                <span className="price-value">{price.net} zł</span>
              </div>
              <div className="price-row gross">
                <span>Cena brutto:</span>
                <span className="price-value">{price.gross} zł</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
