'use client';

import { useState } from 'react';

function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function Backtester() {
  const [days, setDays] = useState('7');
  const [scansPerDay, setScansPerDay] = useState('24');
  const [capital, setCapital] = useState('1000');
  const [minNet, setMinNet] = useState('0.25');
  const [module, setModule] = useState('all');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function runBacktest() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          days: Number(days),
          scansPerDay: Number(scansPerDay),
          startingCapitalUsd: Number(capital),
          minNetUsd: Number(minNet),
          module,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Backtest failed');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backtest failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel" style={{ marginTop: 24 }}>
      <div className="panelHead">
        <div>
          <h2 className="panelTitle">Paper backtester</h2>
          <p className="panelText">
            This answers the simple question: if Ghost Alpha followed these signals on paper, would it have won or lost?
          </p>
        </div>
        <span className="pill">Simulation</span>
      </div>

      <div className="controls">
        <label className="field"><span>Days</span><input className="input" value={days} onChange={(event) => setDays(event.target.value)} /></label>
        <label className="field"><span>Scans per day</span><input className="input" value={scansPerDay} onChange={(event) => setScansPerDay(event.target.value)} /></label>
        <label className="field"><span>Capital</span><input className="input" value={capital} onChange={(event) => setCapital(event.target.value)} /></label>
        <label className="field"><span>Min paper profit</span><input className="input" value={minNet} onChange={(event) => setMinNet(event.target.value)} /></label>
        <label className="field">
          <span>Module</span>
          <select className="input" value={module} onChange={(event) => setModule(event.target.value)}>
            <option value="all">All modules</option>
            <option value="funding_rate_arbitrage">Funding rates</option>
            <option value="solana_route_arbitrage">Solana routes</option>
            <option value="stablecoin_arbitrage">Stablecoins</option>
            <option value="evm_flashloan_template">EVM flash-loan templates</option>
          </select>
        </label>
        <button className="btn" onClick={runBacktest} disabled={loading}>{loading ? 'Running...' : 'Run backtest'}</button>
      </div>

      {error ? <div className="opps"><div className="opp risk-high">{error}</div></div> : null}

      {data ? (
        <>
          <div className="grid stats" style={{ padding: 18 }}>
            <div className="card"><div className="label">Paper net</div><div className="value">{money(data.summary.totalNetUsd)}</div></div>
            <div className="card"><div className="label">Daily avg</div><div className="value">{money(data.summary.dailyAverageUsd)}</div></div>
            <div className="card"><div className="label">Win rate</div><div className="value">{data.summary.winRatePct}%</div></div>
          </div>

          <div className="grid stats" style={{ padding: '0 18px 18px' }}>
            <div className="card"><div className="label">Trades</div><div className="value">{data.summary.trades}</div></div>
            <div className="card"><div className="label">Max drawdown</div><div className="value">{money(data.summary.maxDrawdownUsd)}</div></div>
            <div className="card"><div className="label">Ending equity</div><div className="value">{money(data.summary.endingEquityUsd)}</div></div>
          </div>

          <div className="opps">
            <div className="opp">
              <div className="oppTitle">Best modules</div>
              <div className="oppGrid" style={{ marginTop: 12 }}>
                {data.byModule.map((item) => (
                  <div className="mini" key={item.key}>
                    <span className="label">{item.label}</span>
                    <b>{money(item.netUsd)}</b>
                    <p className="panelText">{item.passed} passed · {item.winRatePct}% wins</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="opps">
            <div className="opp">
              <div className="oppTitle">Recent paper trades</div>
              <pre className="log">{JSON.stringify(data.trades.slice(0, 20), null, 2)}</pre>
            </div>
          </div>
        </>
      ) : (
        <div className="opps">
          <div className="opp">
            <div className="oppTitle">No backtest run yet</div>
            <p className="panelText">Click Run backtest to see paper win/loss, drawdown, and best modules.</p>
          </div>
        </div>
      )}
    </div>
  );
}
