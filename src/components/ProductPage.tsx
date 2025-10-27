import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchProduct, type ProductWithVariants } from "../services/airtable";
import WorktopCalculator from "./WorktopCalculator";
import "./ProductPage.css";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
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

    fetchProduct(id)
      .then((data) => {
        setProductData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load product");
        setLoading(false);
      });
  }, [id]);

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

  return (
    <div className="product-page">
      <div className="product-container">
        <h1 className="product-title">{product.name}</h1>

        <div className="product-info">
          <div className="info-section">
            <span className="info-label">Dekor:</span>
            <span className="info-value">{product.decor}</span>
          </div>

          <div className="info-section">
            <span className="info-label">Struktura:</span>
            <span className="info-value">{product.structure}</span>
          </div>

          <div className="info-section description">
            <span className="info-value">{product.description}</span>
          </div>
        </div>

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
                    {product.width ? `${product.width}mm` : "undefinedmm"} x{" "}
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
                  {[
                    product.price_600_m_1 || product.price_600_m_2
                      ? "600mm"
                      : null,
                    product.price_635_m_1 ? "635mm" : null,
                    product.price_650_m_1 ? "650mm" : null,
                    product.price_700_m_1 || product.price_700_m_2
                      ? "700mm"
                      : null,
                    product.price_800_m_1 || product.price_800_m_2
                      ? "800mm"
                      : null,
                    product.price_900_m_1 || product.price_900_m_2
                      ? "900mm"
                      : null,
                    product.price_1200_m_1 || product.price_1200_m_2
                      ? "1200mm"
                      : null,
                    product.price_1300_m_1 ? "1300mm" : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
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
      </div>
    </div>
  );
}
