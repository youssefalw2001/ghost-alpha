'use client';

import { useEffect, useMemo, useState } from 'react';

const MODULE_LABELS = {
  smart_wallet_tracker: 'Smart wallets',
  fresh_token_scanner: 'Fresh tokens',
  whale_before_pump_detector: 'Whale-before-pump',
};

function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function pct(value) {
  return `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export default function RadarDashboard() {
  const [radar, setRadar] = useState(null);
  const [test, setTest] = useState(null);
  const [loadingRadar, setLoadingRadar] = useState(false);
  const [loadingTest, setLoadingTest] = useState(false);
  const [capital, setCapital] = useState('500');
  const [days, setDays] = useState('30');
  const [scansPerDay, setScansPerDay] = useState('48');
  const [minScore, setMinScore] = useState('65');
  const [riskMode, setRiskMode] = useState('balanced');
  const [targetWeekly, setTargetWeekly] = useState('250');
  const [error, setError] = useState('');

  const bestSignal = useMemo(() => {
    if (!radar?.signals?.length) return null;
    return radar.signals[0];
  }, [radar]);

  async function scanRadar() {
    setLoadingRadar(true);
    setError('');
    try {
      const res = await fetch('/api/radar', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Radar scan failed');
      setRadar(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Radar scan failed');
    } finally {
      setLoadingRadar(false);
    }
  }

  async function runRadarBacktest() {
    setLoadingTest(true);
    setError('');
    try {
      const res = await fetch('/api/radar-backtest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          capitalUsd: Number(capital),
          days: Number(days),
          scansPerDay: Number(scansPerDay),
          minScore: Number(minScore),
          riskMode,
          module: 'all',
          targetWeeklyUsd: Number(targetWeekly),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Radar backtest failed');
      setTest(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Radar backtest failed');
    } finally {
      setLoadingTest(false);
    }
  }

  useEffect(() => {
    scanRadar();
  }, []);

  return (
    <div className="panel" style={{ marginTop: 24 }}>
      <div className="panelHead">
        <div>
          <h2 className="panelTitle">Smart Money Radar</h2>
          <p className="panelText">
            First 3 modules: smart wallets, fresh token liquidity, and whale-before-pump detection. Uses public data only.
          </p>
        </div>
        <span className="pill">Radar</span>
      </div>

      <div className="opps">
        <div className="opp" style={{ borderColor: 'rgba(110,231,183,.3)', background: 'rgba(110,231,183,.08)' }}>
          <div className="oppTop">
            <div>
              <div className="label">Best live radar signal</div>
              <div className="oppTitle">{bestSignal ? bestSignal.title : 'No signal loaded yet'}</div>
              <p className="panelText">
                {bestSignal ? bestSignal.notes : 'Run the radar scan to load live public-data signals.'}
              </p>
            </div>
            <span className="badge">Score {bestSignal?.score || 0}</span>
          </div>
          {bestSignal ? (
            <div className="oppGrid">
              <div className="mini"><span className="label">Module</span><b>{MODULE_LABELS[bestSignal.module] || bestSignal.module}</b></div>
              <div className="mini"><span className="label">Status</span><b>{bestSignal.status}</b></div>
              <div className="mini"><span className="label">Risk</span><b>{bestSignal.risk}</b></div>
              <div className="mini"><span className="label">Liquidity</span><b>{money(bestSignal.liquidityUsd)}</b></div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="controls">
        <button className="btn" onClick={scanRadar} disabled={loadingRadar}>{loadingRadar ? 'Scanning...' : 'Run live radar'}</button>
        <button className="btn btn2" disabled>Public data only</button>
      </div>

      {radar ? (
        <div className="grid stats" style={{ padding: 18 }}>
          <div className="card"><div className="label">Fresh tokens</div><div className="value">{radar.summary.freshTokens}</div></div>
          <div className="card"><div className="label">Pump signals</div><div className="value">{radar.summary.pumpSignals}</div></div>
          <div className="card"><div className="label">Active wallets</div><div className="value">{radar.summary.activeWallets1h}</div></div>
        </div>
      ) : null}

      <div className="opps">
        {(radar?.signals || []).slice(0, 10).map((signal) => (
          <article className="opp" key={signal.id}>
            <div className="oppTop">
              <div>
                <div className="oppTitle">{signal.title}</div>
                <p className="panelText">{signal.notes}</p>
                {signal.url ? <a className="panelText" href={signal.url} target="_blank" rel="noreferrer">Open chart</a> : null}
              </div>
              <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                <span className="badge">{MODULE_LABELS[signal.module] || signal.module}</span>
                <span className="badge">Score {signal.score}</span>
              </div>
            </div>
            <div className="oppGrid">
              <div className="mini"><span className="label">Status</span><b>{signal.status}</b></div>
              <div className="mini"><span className="label">Risk</span><b>{signal.risk}</b></div>
              <div className="mini"><span className="label">Volume 1h</span><b>{money(signal.volume1hUsd)}</b></div>
              <div className="mini"><span className="label">5m change</span><b>{pct(signal.priceChange5mPct)}</b></div>
            </div>
          </article>
        ))}
      </div>

      <div className="panelHead" style={{ borderTop: '1px solid rgba(255,255,255,.1)' }}>
        <div>
          <h2 className="panelTitle">$500 Radar backtest</h2>
          <p className="panelText">
            Runs the first 3 modules in a more realistic paper model with position sizing, slippage, fees, stops, and drawdown.
          </p>
        </div>
        <span className="pill">$500 model</span>
      </div>

      <div className="controls">
        <label className="field"><span>Capital</span><input className="input" value={capital} onChange={(event) => setCapital(event.target.value)} /></label>
        <label className="field"><span>Days</span><input className="input" value={days} onChange={(event) => setDays(event.target.value)} /></label>
        <label className="field"><span>Scans/day</span><input className="input" value={scansPerDay} onChange={(event) => setScansPerDay(event.target.value)} /></label>
        <label className="field"><span>Min score</span><input className="input" value={minScore} onChange={(event) => setMinScore(event.target.value)} /></label>
        <label className="field">
          <span>Risk mode</span>
          <select className="input" value={riskMode} onChange={(event) => setRiskMode(event.target.value)}>
            <option value="conservative">Conservative</option>
            <option value="balanced">Balanced</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </label>
        <label className="field"><span>Weekly target</span><input className="input" value={targetWeekly} onChange={(event) => setTargetWeekly(event.target.value)} /></label>
        <button className="btn" onClick={runRadarBacktest} disabled={loadingTest}>{loadingTest ? 'Testing...' : 'Backtest radar'}</button>
      </div>

      {error ? <div className="opps"><div className="opp risk-high">{error}</div></div> : null}

      {test ? (
        <>
          <div className="grid stats" style={{ padding: 18 }}>
            <div className="card"><div className="label">Weekly paper net</div><div className="value">{money(test.backtest.summary.weeklyNetUsd)}</div></div>
            <div className="card"><div className="label">Ending equity</div><div className="value">{money(test.backtest.summary.endingEquityUsd)}</div></div>
            <div className="card"><div className="label">Win rate</div><div className="value">{pct(test.backtest.summary.winRatePct)}</div></div>
          </div>

          <div className="grid stats" style={{ padding: '0 18px 18px' }}>
            <div className="card"><div className="label">Trades</div><div className="value">{test.backtest.summary.trades}</div></div>
            <div className="card"><div className="label">Max drawdown</div><div className="value">{money(test.backtest.summary.maxDrawdownUsd)}</div></div>
            <div className="card"><div className="label">Best optimized weekly</div><div className="value">{money(test.optimizer.bestPlan?.summary?.weeklyNetUsd)}</div></div>
          </div>

          <div className="opps">
            <div className="opp">
              <div className="oppTitle">Best modules in this test</div>
              <div className="oppGrid" style={{ marginTop: 12 }}>
                {test.backtest.byModule.map((item) => (
                  <div className="mini" key={item.key}>
                    <span className="label">{item.label}</span>
                    <b>{money(item.netUsd)}</b>
                    <p className="panelText">{item.trades} trades · {pct(item.winRatePct)} wins</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="opps">
            <div className="opp">
              <div className="oppTitle">Accuracy notes</div>
              <pre className="log">{JSON.stringify(test.backtest.accuracyNotes, null, 2)}</pre>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
