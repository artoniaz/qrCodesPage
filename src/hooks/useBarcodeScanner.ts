import { useEffect, useRef } from "react";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import { markScanSeen } from "../lib/kiosk";

// A keyboard-wedge scanner (Zebra) types the whole payload as a burst of
// keystrokes and finishes with Enter. Human typing is far slower, so a gap
// larger than this between keys is treated as the start of a new entry. This
// keeps stray human input from polluting the scan buffer, and is also what
// tells the kiosk apart from a customer's phone (see lib/kiosk).
const INTER_KEY_TIMEOUT_MS = 50;

// Ignore obviously-too-short buffers so a single accidental keypress + Enter
// never triggers a navigation.
const MIN_CODE_LENGTH = 3;

function handleScan(raw: string, navigate: NavigateFunction) {
  const value = raw.trim();

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // Defensive fallback: a bare same-origin path ("/product/123").
    if (value.startsWith("/")) {
      navigate(value);
    } else {
      console.warn("[scanner] ignored non-URL payload:", value);
    }
    return;
  }

  // Only ever navigate to http(s). A scanned "javascript:" or "data:" payload
  // parses as a valid URL with a null origin and would otherwise be handed to
  // window.location.assign — executing arbitrary script in the kiosk.
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    console.warn("[scanner] ignored non-http(s) payload:", value);
    return;
  }

  if (url.origin === window.location.origin) {
    // Same app → client-side route change, no full page reload.
    navigate(url.pathname + url.search + url.hash);
  } else {
    // Different site → hand off to the browser.
    window.location.assign(url.href);
  }
}

/**
 * Listens for barcode/QR scans coming from a keyboard-wedge scanner and
 * redirects accordingly. Must be used inside a React Router context.
 */
export default function useBarcodeScanner() {
  const navigate = useNavigate();
  const buffer = useRef("");
  const lastKeyTime = useRef(0);

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      const now = Date.now();

      // Too long since the previous key → this is a new entry, not a
      // continuation of an in-progress scan.
      if (now - lastKeyTime.current > INTER_KEY_TIMEOUT_MS) {
        buffer.current = "";
      }
      lastKeyTime.current = now;

      if (event.key === "Enter") {
        const code = buffer.current;
        buffer.current = "";
        if (code.length >= MIN_CODE_LENGTH) {
          // A burst this fast means a scanner, which means the kiosk. Set it
          // before navigating, and outside handleScan, so a payload that
          // turns out to be unusable still counts as proof of a scanner.
          markScanSeen();

          // The Enter that ends a scan would otherwise run its default action
          // once this handler returns: a click on whatever still has focus —
          // the chip the customer tapped last, or the idle overlay's button.
          // A scan navigates, and does nothing else.
          event.preventDefault();

          handleScan(code, navigate);
        }
        return;
      }

      // Collect printable characters only. Modifier/navigation keys
      // ("Shift", "Control", "Tab", "ArrowLeft", …) have key.length > 1.
      if (event.key.length === 1) {
        buffer.current += event.key;
      }
    }

    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [navigate]);
}
