import AlphaDashboard from '../components/AlphaDashboard';
import Backtester from '../components/Backtester';

export default function HomePage() {
  return (
    <main className="page">
      <div className="wrap">
        <nav className="nav">
          <div className="brand">
            <span className="logo">GA</span>
            <span>Ghost Alpha</span>
          </div>
          <span className="pill">Private beta</span>
        </nav>

        <section className="hero">
          <div>
            <div className="eyebrow"><span className="dot" /> Paper-mode crypto searcher</div>
            <h1>Your private alpha engine.</h1>
            <p className="lead">
              Ghost Alpha watches routes, scores opportunities, and backtests paper-mode results before real execution is enabled.
              The goal is simple: prove the data first, then automate only what survives testing.
            </p>

            <div className="grid stats">
              <div className="card">
                <div className="label">Mode</div>
                <div className="value">Paper</div>
              </div>
              <div className="card">
                <div className="label">Execution</div>
                <div className="value">Locked</div>
              </div>
              <div className="card">
                <div className="label">Focus</div>
                <div className="value">Scanner</div>
              </div>
            </div>

            <div className="notice">
              This app does not sandwich users, front-run victims, drain wallets, or auto-submit trades. It scans, models, and backtests safe arbitrage-style signals first.
            </div>
          </div>

          <div>
            <AlphaDashboard />
            <Backtester />
          </div>
        </section>

        <footer className="footer">
          Roadmap: saved paper-trading history, Telegram alerts, wallet watchlists, airdrop scanner, liquidation scanner, and manual approve-to-execute after the scanner proves profitable.
        </footer>
      </div>
    </main>
  );
}
