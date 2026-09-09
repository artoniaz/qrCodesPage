import { useEffect, useState } from "react";

// Below this threshold what remains is rounding and a sliver of padding
// rather than content — without it the cue would flicker at the very end of
// the scroll.
const THRESHOLD_PX = 24;

/**
 * Whether there is still content to scroll to below the edge of the screen.
 *
 * The window scrolls, not any container — the only place in the app that
 * touches scrolling is `window.scrollTo(0, 0)` in ProductPage.
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

    // Document height also changes without scrolling and without a window
    // resize: the price card appears and disappears as chips are tapped.
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
