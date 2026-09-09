import logo from "../assets/logo-poziome.png";
import "./BrandHeader.css";

/**
 * The secondary horizontal logo — the brandbook assigns it to banners and web
 * headers. Spacing is derived from the clear-space rule, not eyeballed.
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
