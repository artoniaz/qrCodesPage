import { useEffect, useState } from "react";

// Poniżej tego progu resztka strony to zaokrąglenia i cień paddingu, a nie
// treść — bez niego wskaźnik migotałby na samym końcu przewijania.
const THRESHOLD_PX = 24;

/**
 * Czy poniżej krawędzi ekranu jest jeszcze treść do przewinięcia.
 *
 * Przewija się okno, nie żaden kontener — jedyne miejsce w aplikacji, które
 * dotyka przewijania, to `window.scrollTo(0, 0)` w ProductPage.
 */
export default function useHasContentBelow(): boolean {
  const [hasContentBelow, setHasContentBelow] = useState(false);

  useEffect(() => {
    const check = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      setHasContentBelow(scrolled < total - THRESHOLD_PX);
    };

    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);

    // Wysokość dokumentu zmienia się także bez przewijania i bez zmiany
    // rozmiaru okna: karta z ceną pojawia się i znika po dotknięciu chipa.
    const observer = new ResizeObserver(check);
    observer.observe(document.body);

    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      observer.disconnect();
    };
  }, []);

  return hasContentBelow;
}
