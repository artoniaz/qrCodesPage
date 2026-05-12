import { useState, useEffect } from "react";
import type { Product } from "../types/product";
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

export default function WorktopCalculator({ product: initialProduct, thicknessVariants }: WorktopCalculatorProps) {
  // State for selected thickness variant
  const [selectedThickness, setSelectedThickness] = useState<number>(initialProduct.thickness);

  // Get the current product based on selected thickness
  const product = selectedThickness === initialProduct.thickness
    ? initialProduct
    : thicknessVariants?.find(v => v.thickness === selectedThickness) || initialProduct;

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
  const availableLengths: number[] = [];
  if (product.length_1 !== undefined) availableLengths.push(product.length_1);
  if (product.length_2 !== undefined) availableLengths.push(product.length_2);

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

  // Hide the length chip group when the only available length is 0 (unit-priced row with no real length dimension)
  const showLengthGroup = !(availableLengths.length === 1 && availableLengths[0] === 0);


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
    if (selectedWidth === null || selectedLength === null) return null;

    let netPrice: number;

    if (usesPriceMap) {
      const priceValue = lookupMapPrice(selectedWidth, selectedLength, selectedSide);
      if (priceValue === undefined) return null;
      // Prices in the new Juan map are per-meter; multiply by length in meters.
      // Exception: a length of 0 denotes a unit-priced row with no real length dimension,
      // so the map value already IS the final net price — don't multiply by 0.
      netPrice = selectedLength === 0 ? priceValue : priceValue * (selectedLength / 1000);
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

  const getSideLabel = (side: 1 | 2) => {
    return side === 1 ? "jednostronnie zaoblony" : "obustronnie zaoblony";
  };

  // Build available thickness options
  const availableThicknesses: number[] = [initialProduct.thickness];
  if (thicknessVariants && thicknessVariants.length > 0) {
    thicknessVariants.forEach(v => {
      if (!availableThicknesses.includes(v.thickness)) {
        availableThicknesses.push(v.thickness);
      }
    });
  }
  availableThicknesses.sort((a, b) => a - b);

  return (
    <div className="worktop-calculator">
      <div className="calculator-header">
        <h3>Kalkulator ceny</h3>
      </div>

      <div className="calculator-options">
        {/* Thickness selection - only if variants exist */}
        {availableThicknesses.length > 1 && (
          <div className="option-group">
            <label className="option-label">Grubość:</label>
            <div className="chip-selector">
              {availableThicknesses.map((thickness) => (
                <button
                  key={thickness}
                  className={`chip ${selectedThickness === thickness ? 'chip-active' : ''}`}
                  onClick={() => setSelectedThickness(thickness)}
                >
                  {thickness}mm
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Side selection - only if product supports both */}
        {canChooseSide && (
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

        {/* Length selection */}
        {showLengthGroup && (
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
        <div className="price-display">
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
