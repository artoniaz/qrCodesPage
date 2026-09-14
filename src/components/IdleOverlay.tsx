import "./IdleOverlay.css";

/**
 * Polish counts in three forms. Bare 1 takes the accusative "sekundę" — but
 * only bare 1, because "dwadzieścia jeden sekund" is genitive plural, so the
 * test is n === 1 rather than n % 10 === 1. For 2-4, but not 12-14, the plural
 * is "sekundy"; everything else takes "sekund".
 */
function secondsLabel(n: number): string {
  if (n === 1) return "sekundę";

  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return "sekundy";
  }
  return "sekund";
}

interface IdleOverlayProps {
  secondsLeft: number;
  onStay: () => void;
}

/**
 * The warning before the kiosk walks itself back to the welcome screen.
 *
 * Any touch anywhere cancels it — the whole overlay is the "stay" target, and
 * the copy says so. The button is there to make that explicit for anyone who
 * looks for one.
 */
export default function IdleOverlay({ secondsLeft, onStay }: IdleOverlayProps) {
  return (
    // Not inert-ing the page behind: on a kiosk with no assistive technology
    // in use, true modality would buy nothing and cost a second failure mode.
    <div
      className="idle-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-title"
      aria-describedby="idle-announce"
    >
      <div className="idle-card">
        <h2 className="idle-title" id="idle-title">
          Wracamy do ekranu startowego
        </h2>

        {/* The digits change four times a second; a live region on them would
            have a screen reader talking over itself. The announcement below
            is the static version of the same message. */}
        <p className="idle-count" aria-hidden="true">
          za <span className="idle-number">{secondsLeft}</span>{" "}
          {secondsLabel(secondsLeft)}
        </p>
        <p className="idle-announce" id="idle-announce" aria-live="polite">
          Strona wróci za chwilę do ekranu startowego. Dotknij ekranu, aby
          zostać.
        </p>

        {/* No autoFocus — the Enter that ends a scan would activate whatever
            is focused. */}
        <button type="button" className="idle-stay" onClick={onStay}>
          Zostań na stronie
        </button>

        <p className="idle-hint">Dotknij ekranu, aby zostać.</p>
      </div>
    </div>
  );
}
