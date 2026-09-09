import useHasContentBelow from "../hooks/useHasContentBelow";
import "./ScrollCue.css";

/**
 * Sygnał, że treść trwa poniżej krawędzi ekranu. Na płaskim tle bez cieni
 * i bez widocznego paska przewijania nic innego tego nie komunikuje.
 *
 * Szewron zbudowany z dwóch prostych kresek pod ostrym kątem — ten sam motyw
 * geometryczny co zygzak w monogramie i akcent tła.
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
