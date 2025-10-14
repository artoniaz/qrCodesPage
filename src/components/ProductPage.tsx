import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchProduct, type ProductWithVariants } from "../services/airtable";
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

  const { product, variants } = productData;
  const isWorktop = product.category.toLowerCase() === "blat";
  const isPanel = product.category.toLowerCase() === "płyta";

  // Sort variants by type (numeric value) in ascending order
  const sortedVariants = variants
    ? [...variants].sort((a, b) => {
        const typeA = parseInt(a.type || "0") || 0;
        const typeB = parseInt(b.type || "0") || 0;
        return typeA - typeB;
      })
    : [];

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
                  <span className="variant-label">Format sprzedaży:</span>
                  <span className="variant-value">{product.sellUnit}</span>
                </div>

                <div className="variant-row">
                  <span className="variant-label">Grubość:</span>
                  <span className="variant-value">{product.thickness}mm</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {isWorktop && sortedVariants && sortedVariants.length > 0 && (
          <div className="variants-section">
            {sortedVariants.map((variant) => (
              <div key={variant.id} className="variant-card">
                <div className="variant-header">
                  <span className="variant-title">
                    wariant: blat {variant.type}
                  </span>
                </div>

                <div className="variant-details">
                  <div className="variant-row">
                    <span className="variant-label">Cena:</span>
                    <span className="variant-value price">
                      {(variant.price * 1.23).toFixed(2)} zł brutto/szt.
                    </span>
                  </div>

                  <div className="variant-row">
                    <span className="variant-label">Wymiary:</span>
                    <span className="variant-value">
                      {variant.width ? `${variant.width}mm` : "undefinedmm"} x{" "}
                      {variant.height ? `${variant.height}mm` : "undefinedmm"}
                    </span>
                  </div>

                  <div className="variant-row">
                    <span className="variant-label">Forma sprzedaży:</span>
                    <span className="variant-value">{variant.sellUnit}</span>
                  </div>

                  <div className="variant-row">
                    <span className="variant-label">Grubość:</span>
                    <span className="variant-value">{variant.thickness}mm</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
