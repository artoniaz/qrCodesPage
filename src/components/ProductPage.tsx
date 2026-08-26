import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { fetchProduct, type ProductWithVariants } from "../services/airtable";
import type { ProductKind } from "../types/product";
import WorktopCalculator from "./WorktopCalculator";
import "./ProductPage.css";

const PRICE_HIDDEN_NOTICE = "zmiana cennika, tymczasowo proszę pytać obsługę";

// Neither sales form is an Airtable field — they are inherent to the sheet+front
// schema: the sheet is sold whole, the front by the square metre.
const SHEET_SELL_UNIT = "arkusz";
const FRONT_SELL_UNIT = "sprzedaż na m²";

// 0 is how Airtable records "no catalogue price yet" — never a free product.
function formatPrice(value: number, unit: string): string {
  return value > 0
    ? `${value.toFixed(2)} zł brutto / ${unit}`
    : "wycena indywidualna";
}

// A labelled row that renders nothing when the underlying Airtable field is
// empty. Most of this page is exactly that shape.
function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="info-row">
      <span className="info-label">{label}:</span>
      <span className="info-value-simple">{value}</span>
    </div>
  );
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [productData, setProductData] = useState<ProductWithVariants | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("No product ID provided");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Determine product type based on URL path
    const productType = location.pathname.includes('/product/front/') ? 'front' : 'regular';

    // Extract tableId from query parameters
    const searchParams = new URLSearchParams(location.search);
    const tableId = searchParams.get('table') || undefined;

    fetchProduct(id, productType, tableId)
      .then((data) => {
        setProductData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load product");
        setLoading(false);
      });
  }, [id, location.pathname, location.search]);

  // Scroll to top after content loads
  useEffect(() => {
    if (!loading && productData) {
      window.scrollTo(0, 0);
    }
  }, [loading, productData]);

  if (loading) {
    return (
      <div className="product-page">
        <div className="loader-container">
          <div className="loader"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="product-page">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!productData) {
    return (
      <div className="product-page">
        <div className="error-container">
          <h2>Product not found</h2>
        </div>
      </div>
    );
  }

  const { product, thicknessVariants } = productData;
  // Which view to render comes from the record's own fields, not from the route
  // — the same record is reachable through both /product/:id and
  // /product/front/:id depending on when its QR code was printed. The
  // path/category heuristic survives only as a fallback for responses still
  // being served from an edge cache that predates the `kind` field.
  const kind: ProductKind =
    product.kind ??
    (location.pathname.includes("/product/front/")
      ? "front"
      : product.category.toLowerCase() === "blat"
        ? "blat"
        : "other");
  const isWorktop = kind === "blat";
  // Sheet+front record: one product, two producers, two lead times.
  const isSheetFront = kind === "front_arkusz";
  const isFront = kind === "front" || isSheetFront;
  const isPriceHidden = product.ukryj_cene === true;

  // On a sheet+front record the sheet is the product on the shelf, so the page
  // is titled by the colour — matching the printed sample label — rather than
  // by a generic "Front Meblowy".
  const title = isSheetFront
    ? product.kolor || product.front_typ || "Front meblowy"
    : isFront
      ? "Front Meblowy"
      : product.name;

  // "2800 × 1300 × 18", skipping whatever Airtable leaves blank.
  const sheetDimensions = [
    product.arkusz_dlugosc,
    product.arkusz_szerokosc,
    product.arkusz_grubosc,
  ]
    .filter((v): v is number => typeof v === "number" && v > 0)
    .join(" × ");

  const hasProductInfo = product.decor || product.structure || product.category || product.description;

  return (
    <div className="product-page">
      <div className="product-container">
        <h1 className="product-title">{title}</h1>

        {hasProductInfo && (
          <div className="product-info">
            {product.decor && (
              <div className="info-section">
                <span className="info-label">Dekor:</span>
                <span className="info-value">{product.decor}</span>
              </div>
            )}

            {product.structure && (
              <div className="info-section">
                <span className="info-label">Struktura:</span>
                <span className="info-value">{product.structure}</span>
              </div>
            )}

            {product.category && (
              <div className="info-section">
                <span className="info-label">Kategoria:</span>
                <span className="info-value">{product.category}</span>
              </div>
            )}

            {product.description && (
              <div className="info-section description">
                <span className="info-value">{product.description}</span>
              </div>
            )}
          </div>
        )}

        {isPriceHidden && !isWorktop && !isFront && (
          <div className="variants-section">
            <div className="variant-card">
              <div className="variant-details">
                <div className="variant-row">
                  <span className="variant-label">Cena:</span>
                  <span className="variant-value price">
                    {PRICE_HIDDEN_NOTICE}
                  </span>
                </div>

                {product.width_1 && product.height && (
                  <div className="variant-row">
                    <span className="variant-label">Wymiary:</span>
                    <span className="variant-value">
                      {product.width_1}mm x {product.height}mm
                    </span>
                  </div>
                )}

                {product.sellUnit && (
                  <div className="variant-row">
                    <span className="variant-label">Forma sprzedaży:</span>
                    <span className="variant-value">{product.sellUnit}</span>
                  </div>
                )}

                {product.producer && (
                  <div className="variant-row">
                    <span className="variant-label">Producent:</span>
                    <span className="variant-value">{product.producer}</span>
                  </div>
                )}

                {product.thickness > 0 && (
                  <div className="variant-row">
                    <span className="variant-label">Grubość:</span>
                    <span className="variant-value">{product.thickness}mm</span>
                  </div>
                )}

                {product.code && (
                  <div className="variant-row">
                    <span className="variant-label">Kod:</span>
                    <span className="variant-value">{product.code}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {isWorktop && (
          <>
            <div className="worktop-basic-info">
              {product.producer && (
                <div className="info-row">
                  <span className="info-label">Producent:</span>
                  <span className="info-value-simple">{product.producer}</span>
                </div>
              )}
              <div className="info-row">
                <span className="info-label">Dostępne grubości:</span>
                <span className="info-value-simple">
                  {product.thickness}mm
                  {thicknessVariants &&
                    thicknessVariants.length > 0 &&
                    thicknessVariants.map((v) => `, ${v.thickness}mm`).join("")}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Dostępne szerokości:</span>
                <span className="info-value-simple">
                  {product.width
                    ? product.width
                        .split(";")
                        .map((w) => `${w.trim()}mm`)
                        .join(", ")
                    : "Brak danych"}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Dostępne długości:</span>
                <span className="info-value-simple">
                  {product.length
                    ? product.length
                        .split(";")
                        .map((l) => `${l.trim()}mm`)
                        .join(", ")
                    : "Brak danych"}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Forma sprzedaży:</span>
                <span className="info-value-simple">{product.sellUnit}</span>
              </div>
            </div>
            <WorktopCalculator
              product={product}
              thicknessVariants={thicknessVariants}
            />
          </>
        )}

        {kind === "front" && (
          <div className="worktop-basic-info front-info">
            <InfoRow label="Producent" value={product.producer} />
            <InfoRow label="Typ frontu" value={product.front_typ} />
            <InfoRow label="Frez" value={product.frez_typ} />
            <InfoRow label="Kolor" value={product.kolor} />
            <InfoRow label="Informacje" value={product.info} />
            <InfoRow label="Czas oczekiwania" value={product.czas_oczekiwania} />
            {isPriceHidden ? (
              <InfoRow label="Cena" value={PRICE_HIDDEN_NOTICE} />
            ) : product.cena_brutto !== undefined && product.cena_brutto_laser !== undefined && product.cena_brutto_laser > 0 ? (
              <div className="engraving-price-table">
                <table>
                  <thead>
                    <tr>
                      <th>Oklajanie:</th>
                      <th>standardowe</th>
                      <th>laserowe</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Cena:</td>
                      <td>{formatPrice(product.cena_brutto, "m²")}</td>
                      <td>{formatPrice(product.cena_brutto_laser, "m²")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : product.cena_brutto !== undefined ? (
              <InfoRow
                label="Cena"
                value={formatPrice(product.cena_brutto, "m²")}
              />
            ) : null}
          </div>
        )}

        {/* Sheet first and unheaded — it is the product being sold; the front is
            the finish applied to it. Row order mirrors the printed sample label
            so the screen reads like the sticker the customer just scanned. */}
        {isSheetFront && (
          <div className="worktop-basic-info sheet-front-group sheet-info">
            <InfoRow label="Producent" value={product.producent_arkusz} />
            <InfoRow label="Typ" value={product.front_typ} />
            <InfoRow label="Informacje" value={product.info} />
            <InfoRow
              label="Dostępność"
              value={product.arkusz_czas_oczekiwania}
            />
            <InfoRow
              label="Wymiary"
              value={sheetDimensions ? `${sheetDimensions} mm` : undefined}
            />
            <InfoRow label="Forma sprzedaży" value={SHEET_SELL_UNIT} />
            {/* Priced on its own in Airtable — never derived from the front's
                per-m² price and the sheet's area. */}
            {isPriceHidden ? (
              <InfoRow label="Cena" value={PRICE_HIDDEN_NOTICE} />
            ) : product.cena_brutto_arkusz !== undefined ? (
              <InfoRow
                label="Cena"
                value={formatPrice(product.cena_brutto_arkusz, "szt.")}
              />
            ) : null}
          </div>
        )}

        {isSheetFront && (
          <div className="worktop-basic-info sheet-front-group front-info">
            <h2 className="info-group-title">Front meblowy</h2>
            <InfoRow label="Producent" value={product.producent_front} />
            <InfoRow label="Frezowanie" value={product.frez_typ} />
            <InfoRow label="Dostępność" value={product.czas_oczekiwania} />
            <InfoRow label="Forma sprzedaży" value={FRONT_SELL_UNIT} />
            {isPriceHidden ? (
              <InfoRow label="Cena" value={PRICE_HIDDEN_NOTICE} />
            ) : product.cena_brutto !== undefined ? (
              <InfoRow
                label="Cena"
                value={formatPrice(product.cena_brutto, "m²")}
              />
            ) : null}
          </div>
        )}

        {!isWorktop && !isPriceHidden && !isFront && (
          <div className="variants-section">
            <div className="variant-card">
              <div className="variant-details">
                {product.price > 0 && (
                  <div className="variant-row">
                    <span className="variant-label">Cena:</span>
                    <span className="variant-value price">
                      {(product.price * 1.23).toFixed(2)} zł brutto/szt.
                    </span>
                  </div>
                )}

                {product.width_1 && product.height && (
                  <div className="variant-row">
                    <span className="variant-label">Wymiary:</span>
                    <span className="variant-value">
                      {product.width_1}mm x {product.height}mm
                    </span>
                  </div>
                )}

                {product.sellUnit && (
                  <div className="variant-row">
                    <span className="variant-label">Forma sprzedaży:</span>
                    <span className="variant-value">{product.sellUnit}</span>
                  </div>
                )}

                {product.producer && (
                  <div className="variant-row">
                    <span className="variant-label">Producent:</span>
                    <span className="variant-value">{product.producer}</span>
                  </div>
                )}

                {product.thickness > 0 && (
                  <div className="variant-row">
                    <span className="variant-label">Grubość:</span>
                    <span className="variant-value">{product.thickness}mm</span>
                  </div>
                )}

                {product.code && (
                  <div className="variant-row">
                    <span className="variant-label">Kod:</span>
                    <span className="variant-value">{product.code}</span>
                  </div>
                )}

                {product.type && (
                  <div className="variant-row">
                    <span className="variant-label">Typ:</span>
                    <span className="variant-value">{product.type}</span>
                  </div>
                )}

                {product.label && (
                  <div className="variant-row">
                    <span className="variant-label">Etykieta:</span>
                    <span className="variant-value">{product.label}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
