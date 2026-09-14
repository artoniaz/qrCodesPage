import { useCallback, useEffect, useRef, useState } from "react";

// What counts as "somebody is still here". Deliberately NOT pointermove: a
// resting finger, or a fly on the screen, would keep the page alive all day.
// keydown is in the list because a scan burst is keystrokes — scanning a new
// sample resets the timer for free.
const ACTIVITY_EVENTS = ["pointerdown", "touchstart", "keydown", "wheel"] as const;

// The countdown re-reads a deadline rather than decrementing a counter, so it
// survives a throttled tab. Four ticks a second keeps the shown number from
// ever lagging behind by a whole second.
const TICK_MS = 250;

interface IdleTimeoutOptions {
  /** When false nothing is scheduled and no listener is attached at all. */
  enabled: boolean;
  /** Changing this restarts the idle window — pass the location key. */
  resetKey: string;
  idleMs: number;
  countdownMs: number;
  onTimeout: () => void;
}

interface IdleTimeout {
  /** Seconds left before the timeout fires, or null while not counting down. */
  secondsLeft: number | null;
  stayActive: () => void;
}

/**
 * Watches for a stretch with no activity, shows a countdown for the last few
 * seconds of it, and then calls onTimeout.
 *
 * Two phases rather than one so nothing is ever taken away from somebody
 * without warning: the customer gets the countdown, and any touch at all
 * cancels it.
 */
export default function useIdleTimeout({
  enabled,
  resetKey,
  idleMs,
  countdownMs,
  onTimeout,
}: IdleTimeoutOptions): IdleTimeout {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // onTimeout is a new closure on every render. Behind a ref it stays out of
  // the effect's dependencies, so the listeners are attached once per
  // navigation instead of once per render.
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  });

  // Lets the "stay" button reach the current effect's reset without the effect
  // having to depend on anything the caller holds.
  const resetRef = useRef<() => void>(() => {});
  const stayActive = useCallback(() => resetRef.current(), []);

  useEffect(() => {
    if (!enabled) {
      // Also the path that takes the overlay down after the timeout's own
      // navigation. Already null on every other path, so React bails out and
      // this cannot loop.
      setSecondsLeft(null);
      return;
    }

    // Effect-local rather than refs: under StrictMode the effect runs twice
    // and each run has to clear its own handles. A shared ref would let the
    // second run overwrite the first's ids before its cleanup ever saw them.
    let idleId = 0;
    let tickId = 0;
    let deadline = 0;
    // Mirrors secondsLeft without reading state — reset fires on every scroll
    // frame and must not schedule a render when nothing is on screen.
    let counting = false;

    const clearTimers = () => {
      window.clearTimeout(idleId);
      window.clearInterval(tickId);
    };

    const startCountdown = () => {
      counting = true;
      deadline = Date.now() + countdownMs;
      setSecondsLeft(Math.ceil(countdownMs / 1000));

      tickId = window.setInterval(() => {
        const left = Math.ceil((deadline - Date.now()) / 1000);
        if (left <= 0) {
          clearTimers();
          counting = false;
          setSecondsLeft(null);
          onTimeoutRef.current();
          return;
        }
        setSecondsLeft(left);
      }, TICK_MS);
    };

    const reset = () => {
      clearTimers();
      if (counting) {
        counting = false;
        setSecondsLeft(null);
      }
      idleId = window.setTimeout(startCountdown, idleMs);
    };

    resetRef.current = reset;
    reset();

    for (const type of ACTIVITY_EVENTS) {
      window.addEventListener(type, reset, { passive: true });
    }
    // Capture phase on the document, because a scroll inside a container does
    // not bubble to window — the engraving price table is a sideways scroller
    // on a narrow screen.
    document.addEventListener("scroll", reset, { passive: true, capture: true });
    // Coming back to a tab that was hidden should not land straight into a
    // countdown that ran while nobody could see it.
    document.addEventListener("visibilitychange", reset);

    return () => {
      clearTimers();
      for (const type of ACTIVITY_EVENTS) {
        window.removeEventListener(type, reset);
      }
      document.removeEventListener("scroll", reset, { capture: true });
      document.removeEventListener("visibilitychange", reset);
    };
    // resetKey is depended on for its identity alone: a new location tears the
    // timers down and rebuilds them, so every page gets a full idle window.
  }, [enabled, resetKey, idleMs, countdownMs]);

  return { secondsLeft, stayActive };
}
