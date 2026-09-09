import logo from "../assets/logo-poziome.png";
import "./HomePage.css";

export default function HomePage() {
  return (
    <div className="home">
      <div className="home-card">
        {/* Wersja pozioma dodatkowa zawiera już hasło "akcesoria i płyty
            meblowe" — nie powtarzamy go pod logotypem. */}
        <img
          className="home-logo"
          src={logo}
          alt="azMEBLOPŁYT — akcesoria i płyty meblowe"
        />

        <h1 className="home-greeting">Witamy</h1>

        <span className="home-rule" aria-hidden="true" />

        <div className="scan" aria-hidden="true">
          {/* Jednolita grubość linii i ostre kąty — bez zaokrągleń i wypełnień,
              zgodnie z zasadami dla ikon w brandbooku. */}
          <svg
            className="scan-icon"
            viewBox="0 0 64 64"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="butt"
            strokeLinejoin="miter"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M5 23V5h18M41 5h18v18M59 41v18H41M23 59H5V41" />
            <rect x="17" y="17" width="12" height="12" />
            <rect x="35" y="17" width="12" height="12" />
            <rect x="17" y="35" width="12" height="12" />
            <rect x="37" y="37" width="8" height="8" />
          </svg>
          <span className="scan-line" />
        </div>

        <h2 className="home-instruction">Zeskanuj kod QR z próbki</h2>
        <p className="home-hint">
          Po zeskanowaniu na ekranie pojawią się szczegóły produktu
          <br />i aktualna cena.
        </p>
      </div>
    </div>
  );
}
