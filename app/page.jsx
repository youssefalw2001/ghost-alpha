import AlphaDashboard from '../components/AlphaDashboard';
import Backtester from '../components/Backtester';
import Optimizer from '../components/Optimizer';
import RadarDashboard from '../components/RadarDashboard';
import BtcTargetOptimizer from '../components/BtcTargetOptimizer';
import PolymarketCollector from '../components/PolymarketCollector';

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
            <div className="eyebrow"><span className="dot" /> BTC Up/Down edge collector</div>
            <h1>Your private alpha engine.</h1>
            <p className="lead">
              Ghost Alpha watches Polymarket BTC 1h/15m markets, routes, smart wallets, fresh liquidity, and whale-before-pump signals, then backtests paper-mode results before real execution is enabled.
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
                <div className="label">BTC</div>
                <div className="value">1h/15m</div>
              </div>
            </div>

            <div className="notice">
              This app does not use private insider information, sandwich users, front-run victims, drain wallets, or auto-submit trades. It scans public market data, models outcomes, and backtests first.
            </div>
          </div>

          <div>
            <PolymarketCollector />
            <BtcTargetOptimizer />
            <RadarDashboard />
            <AlphaDashboard />
            <Backtester />
            <Optimizer />
          </div>
        </section>

        <footer className="footer">
          Roadmap: saved BTC signal history, resolution checker, token outcome tracking, Telegram alerts, wallet watchlists, and manual approve-to-execute after the scanner proves profitable.
        </footer>
      </div>
    </main>
  );
}
