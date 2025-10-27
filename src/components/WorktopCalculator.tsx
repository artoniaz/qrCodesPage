import { useState, useEffect } from "react";
import type { Product } from "../types/product";
import "./WorktopCalculator.css";

interface WorktopCalculatorProps {
  product: Product;
  thicknessVariants?: Product[];
}

interface WidthVariant {
  width: number;
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

  // State management
  const [selectedSide, setSelectedSide] = useState<1 | 2>(1);
  const [selectedWidth, setSelectedWidth] = useState<number | null>(null);
  const [selectedLength, setSelectedLength] = useState<number | null>(null);

  // Get available lengths from product
  const availableLengths: number[] = [];
  if (product.length_1) availableLengths.push(product.length_1);
  if (product.length_2) availableLengths.push(product.length_2);

  // Build available width variants by checking which price fields exist
  const allPossibleWidths = [600, 635, 650, 700, 800, 900, 1200, 1300];
  const widthVariants: WidthVariant[] = allPossibleWidths
    .map(width => {
      const priceField_1 = `price_${width}_m_1` as keyof Product;
      const priceField_2 = `price_${width}_m_2` as keyof Product;

      return {
        width,
        price_1: product[priceField_1] as number | undefined,
        price_2: product[priceField_2] as number | undefined,
      };
    })
    .filter(variant => variant.price_1 || variant.price_2);


  // Set initial selections and reset when thickness changes
  useEffect(() => {
    if (widthVariants.length > 0) {
      // Find first variant that has price for current side
      const firstAvailable = widthVariants.find(v =>
        selectedSide === 1 ? v.price_1 : v.price_2
      );
      if (firstAvailable) {
        setSelectedWidth(firstAvailable.width);
      }
    }
    if (availableLengths.length > 0) {
      setSelectedLength(availableLengths[0]);
    }
  }, [selectedSide, selectedThickness]);

  // Calculate price based on selections
  const calculatePrice = () => {
    if (!selectedWidth || !selectedLength) return null;

    const variant = widthVariants.find(v => v.width === selectedWidth);
    if (!variant) return null;

    const priceValue = selectedSide === 1 ? variant.price_1 : variant.price_2;
    if (!priceValue) return null;

    let netPrice: number;

    if (isKronospan) {
      // For Kronospan, the price is already for the whole item, not per meter
      netPrice = priceValue;
    } else {
      // For other producers, price is per meter
      const lengthInMeters = selectedLength / 1000;
      netPrice = priceValue * lengthInMeters;
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
              const hasPrice = selectedSide === 1 ? variant.price_1 : variant.price_2;
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
        <div className="option-group">
          <label className="option-label">Długość:</label>
          <div className="chip-selector">
            {availableLengths.map((length) => (
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
