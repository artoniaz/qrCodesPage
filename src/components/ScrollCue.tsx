import useHasContentBelow from "../hooks/useHasContentBelow";
import "./ScrollCue.css";

/**
 * Signals that content continues below the edge of the screen. On a flat
 * background with no shadows and no visible scrollbar, nothing else says so.
 *
 * A chevron of two straight strokes at a sharp angle — the same geometric
 * motif as the monogram's zigzag and the background accent.
 */
export default function ScrollCue() {
  const hasContentBelow = useHasContentBelow();
  if (!hasContentBelow) return null;

  return (
    <div className="scroll-cue" aria-hidden="true">
      <svg
        viewBox="0 0 44 22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M3 4 22 18 41 4" />
      </svg>
    </div>
  );
}
