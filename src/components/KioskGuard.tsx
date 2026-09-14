import { useLocation, useNavigate } from "react-router-dom";
import { isKiosk } from "../lib/kiosk";
import useIdleTimeout from "../hooks/useIdleTimeout";
import IdleOverlay from "./IdleOverlay";

// Long enough that a customer reading a spec sheet, or working out a worktop
// price in their head, is never interrupted — the first attempt at 60s was cut
// as too eager. Short enough that the tablet is back on the welcome screen
// before the next person reaches it.
const IDLE_MS = 90_000;

// The warning. Ten seconds is enough to look up, read one sentence and put a
// finger on the screen.
const COUNTDOWN_MS = 10_000;

/**
 * Returns the kiosk to the welcome screen when nobody is using it, so the next
 * customer does not walk up to the previous one's product.
 *
 * A sibling of <Routes> rather than part of a page: the countdown ticks four
 * times a second and this keeps those renders away from ProductPage and the
 * worktop calculator, whose normalising effect runs on every render of it.
 */
export default function KioskGuard() {
  const location = useLocation();
  const navigate = useNavigate();

  // Read on every render. It needs no subscription — see lib/kiosk.
  const kiosk = isKiosk();

  const { secondsLeft, stayActive } = useIdleTimeout({
    // Never on a phone, and never on the home page — there is nowhere to
    // return to from there.
    enabled: kiosk && location.pathname !== "/",
    // A new page is a fresh idle window, even when the navigation itself
    // produced no activity events.
    resetKey: location.key,
    idleMs: IDLE_MS,
    countdownMs: COUNTDOWN_MS,
    // replace, so the back button cannot walk into the product the kiosk has
    // just left behind.
    onTimeout: () => navigate("/", { replace: true }),
  });

  if (secondsLeft === null) return null;
  return <IdleOverlay secondsLeft={secondsLeft} onStay={stayActive} />;
}
