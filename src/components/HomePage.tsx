import logo from "../assets/Logo-05.png";
import "./HomePage.css";

export default function HomePage() {
  return (
    <div className="home">
      <div className="home-card">
        <img className="home-logo" src={logo} alt="AZ MEBLOPŁYT" />

        <h1 className="home-greeting">Witamy</h1>
        <p className="home-sub">akcesoria i płyty meblowe</p>

        <div className="scan" aria-hidden="true">
          <svg
            className="scan-icon"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6 22V10a4 4 0 0 1 4-4h12M42 6h12a4 4 0 0 1 4 4v12M58 42v12a4 4 0 0 1-4 4H42M22 58H10a4 4 0 0 1-4-4V42"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <rect x="18" y="18" width="11" height="11" rx="1.5" fill="currentColor" />
            <rect x="35" y="18" width="11" height="11" rx="1.5" fill="currentColor" />
            <rect x="18" y="35" width="11" height="11" rx="1.5" fill="currentColor" />
            <rect x="38" y="38" width="8" height="8" rx="1.5" fill="currentColor" />
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
