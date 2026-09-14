/* ---------------------------------------------------------------------------
   Is this device the sales-hall kiosk, or a customer's own phone?

   The distinction decides one thing only: whether the page is allowed to walk
   itself back to the welcome screen after a while. On the kiosk that is the
   whole point — the tablet has to be ready for the next person. On a phone it
   would be sabotage: the customer scanned a sample with their camera, is
   reading the spec, and the page would vanish under them onto a screen that
   asks them to scan a QR code they have no scanner for.
--------------------------------------------------------------------------- */

// The kiosk app launches the tablet at "/?kiosk=1" every morning. A phone
// arrives from a QR code on a sample and never carries the flag.
const STORAGE_KEY = "azm:kiosk";
const PARAM = "kiosk";

// Session-only fallback, for a kiosk that was set up without the query
// parameter: a keyboard-wedge scanner types a whole URL in a few
// milliseconds, which no on-screen keyboard can do.
let scanSeen = false;

let persisted: boolean | null = null;

function syncFromUrl(): void {
  const value = new URLSearchParams(window.location.search).get(PARAM);
  if (value === null) return;

  try {
    // "?kiosk=0" is the escape hatch for a device that got marked by mistake.
    // Deliberately a URL and not a button: a button a customer could press is
    // a button a customer will press.
    if (value === "0") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Private browsing throws on write. The scan heuristic still applies.
  }
}

function persistedFlag(): boolean {
  if (persisted === null) {
    syncFromUrl();
    try {
      persisted = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      persisted = false;
    }
  }
  return persisted;
}

/**
 * Records that a keyboard-wedge scan happened, i.e. that there is a scanner
 * attached and this is the kiosk.
 *
 * Must be called BEFORE the navigation the scan triggers: that navigation is
 * what re-renders KioskGuard and therefore what makes the new answer visible.
 */
export function markScanSeen(): void {
  scanSeen = true;
}

/**
 * Whether this device is the sales-hall kiosk rather than a customer's phone.
 *
 * Safe to call during render — after the first call it is two boolean reads —
 * and deliberately not a subscribable store. The persisted flag cannot change
 * within a session, and the only thing that flips the heuristic is a scan,
 * which is itself a navigation and therefore already a re-render.
 *
 * The one gap: a scan whose payload is rejected sets the flag without
 * navigating, so the page already on screen keeps running without a timer
 * until the next navigation. If that ever matters, markScanSeen can dispatch
 * a CustomEvent for KioskGuard to listen for — six lines, not needed yet.
 */
export function isKiosk(): boolean {
  return persistedFlag() || scanSeen;
}
