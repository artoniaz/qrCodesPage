import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { fetchProduct, type ProductWithVariants } from "../services/airtable";
import WorktopCalculator from "./WorktopCalculator";
import "./ProductPage.css";

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
  const isWorktop = product.category.toLowerCase() === "blat";
  const isPanel = product.category.toLowerCase() === "płyta";
  const isFront = location.pathname.includes('/product/front/');

  const hasProductInfo = product.decor || product.structure || product.category || product.description;

  return (
    <div className="product-page">
      <div className="product-container">
        <h1 className="product-title">{isFront ? "Front Meblowy" : product.name}</h1>

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

        {isPanel && (
          <div className="variants-section">
            <div className="variant-card">
              <div className="variant-details">
                <div className="variant-row">
                  <span className="variant-label">Cena:</span>
                  <span className="variant-value price">
                    {(product.price * 1.23).toFixed(2)} zł brutto/szt.
                  </span>
                </div>

                <div className="variant-row">
                  <span className="variant-label">Wymiary:</span>
                  <span className="variant-value">
                    {product.width_1 ? `${product.width_1}mm` : "undefinedmm"} x{" "}
                    {product.height ? `${product.height}mm` : "undefinedmm"}
                  </span>
                </div>

                <div className="variant-row">
                  <span className="variant-label">Forma sprzedaży:</span>
                  <span className="variant-value">{product.sellUnit}</span>
                </div>

                {product.producer && (
                  <div className="variant-row">
                    <span className="variant-label">Producent:</span>
                    <span className="variant-value">{product.producer}</span>
                  </div>
                )}
                <div className="variant-row">
                  <span className="variant-label">Grubość:</span>
                  <span className="variant-value">{product.thickness}mm</span>
                </div>
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

        {!isWorktop && !isPanel && isFront && (
          <div className="worktop-basic-info front-info">
            {product.producer && (
              <div className="info-row">
                <span className="info-label">Producent:</span>
                <span className="info-value-simple">{product.producer}</span>
              </div>
            )}
            {product.front_typ && (
              <div className="info-row">
                <span className="info-label">Typ frontu:</span>
                <span className="info-value-simple">{product.front_typ}</span>
              </div>
            )}
            {product.frez_typ && (
              <div className="info-row">
                <span className="info-label">Frez:</span>
                <span className="info-value-simple">{product.frez_typ}</span>
              </div>
            )}
            {product.kolor && (
              <div className="info-row">
                <span className="info-label">Kolor:</span>
                <span className="info-value-simple">{product.kolor}</span>
              </div>
            )}
            {product.info && (
              <div className="info-row">
                <span className="info-label">Informacje:</span>
                <span className="info-value-simple">{product.info}</span>
              </div>
            )}
            {product.czas_oczekiwania && (
              <div className="info-row">
                <span className="info-label">Czas oczekiwania:</span>
                <span className="info-value-simple">{product.czas_oczekiwania}</span>
              </div>
            )}
            {product.cena_brutto !== undefined && product.cena_brutto_laser !== undefined && product.cena_brutto_laser > 0 ? (
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
                      <td>
                        {product.cena_brutto > 0
                          ? `${product.cena_brutto.toFixed(2)} zł brutto / m²`
                          : 'wycena indywidualna'}
                      </td>
                      <td>{product.cena_brutto_laser.toFixed(2)} zł brutto / m²</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : product.cena_brutto !== undefined ? (
              <div className="info-row">
                <span className="info-label">Cena:</span>
                <span className="info-value-simple">
                  {product.cena_brutto > 0
                    ? `${product.cena_brutto.toFixed(2)} zł brutto / m²`
                    : 'wycena indywidualna'}
                </span>
              </div>
            ) : null}
          </div>
        )}

        {!isWorktop && !isPanel && !isFront && (
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
