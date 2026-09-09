import logo from "../assets/logo-poziome.png";
import "./BrandHeader.css";

/**
 * Wersja pozioma dodatkowa logo — brandbook przypisuje ją wprost do banerów
 * i nagłówków www. Odstępy liczone są z pola ochronnego, nie dobierane na oko.
 */
export default function BrandHeader() {
  return (
    <header className="brand-header">
      <img
        className="brand-header-logo"
        src={logo}
        alt="azMEBLOPŁYT — akcesoria i płyty meblowe"
      />
    </header>
  );
}
