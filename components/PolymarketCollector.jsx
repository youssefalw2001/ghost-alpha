'use client';

import { useState } from 'react';

function pct(value) {
  return `${Number((Number(value || 0) * 100).toFixed(2))}%`;
}

function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function price(value) {
  if (value == null) return '—';
  return `${Math.round(Number(value) * 100)}¢`;
}

export default function PolymarketCollector() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function scan() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/polymarket-live', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Collector failed');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Collector failed');
    } finally {
      setLoading(false);
    }
  }

  const best = data?.signals?.[0];

  return (
    <div className="panel" style={{ marginTop: 24 }}>
      <div className="panelHead">
        <div>
          <h2 className="panelTitle">Polymarket BTC live collector</h2>
          <p className="panelText">
            Scans BTC 15m and 1h Up/Down markets, checks orderbooks, estimates fair probability, and creates paper trade decisions.
          </p>
        </div>
        <span className="pill">1h + 15m</span>
      </div>

      <div className="controls">
        <button className="btn" onClick={scan} disabled={loading}>{loading ? 'Scanning...' : 'Run BTC live scan'}</button>
        <button className="btn btn2" disabled>Paper only</button>
      </div>

      {error ? <div className="opps"><div className="opp risk-high">{error}</div></div> : null}

      {best ? (
        <div className="opps">
          <article className="opp" style={{ borderColor: 'rgba(110,231,183,.3)', background: 'rgba(110,231,183,.08)' }}>
            <div className="oppTop">
              <div>
                <div className="label">Best BTC Up/Down signal</div>
                <div className="oppTitle">{best.question}</div>
                <p className="panelText">{best.decision.reason}</p>
                {best.url ? <a className="panelText" href={best.url} target="_blank" rel="noreferrer">Open market</a> : null}
              </div>
              <span className="badge">{best.decision.action}</span>
            </div>
            <div className="oppGrid">
              <div className="mini"><span className="label">Interval</span><b>{best.interval}</b></div>
              <div className="mini"><span className="label">Side</span><b>{best.decision.side}</b></div>
              <div className="mini"><span className="label">Edge</span><b>{pct(best.decision.edge)}</b></div>
              <div className="mini"><span className="label">Score</span><b>{best.decision.score}</b></div>
            </div>
            <div className="oppGrid" style={{ marginTop: 12 }}>
              <div className="mini"><span className="label">Market price</span><b>{price(best.decision.marketPrice)}</b></div>
              <div className="mini"><span className="label">Fair UP</span><b>{pct(best.decision.fairUp)}</b></div>
              <div className="mini"><span className="label">BTC move</span><b>{best.btc.distancePct}%</b></div>
              <div className="mini"><span className="label">Time left</span><b>{Math.floor(best.btc.secondsLeft / 60)}m {best.btc.secondsLeft % 60}s</b></div>
            </div>
          </article>
        </div>
      ) : null}

      {data ? (
        <div className="grid stats" style={{ padding: 18 }}>
          <div className="card"><div className="label">Markets found</div><div className="value">{data.summary.marketsFound}</div></div>
          <div className="card"><div className="label">Signals built</div><div className="value">{data.summary.signalsBuilt}</div></div>
          <div className="card"><div className="label">Paper buys</div><div className="value">{data.summary.paperBuys}</div></div>
        </div>
      ) : null}

      <div className="opps">
        {(data?.signals || []).slice(0, 12).map((signal) => (
          <article className="opp" key={signal.id}>
            <div className="oppTop">
              <div>
                <div className="oppTitle">{signal.question}</div>
                <p className="panelText">{signal.decision.reason}</p>
              </div>
              <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                <span className="badge">{signal.interval}</span>
                <span className="badge">Score {signal.decision.score}</span>
              </div>
            </div>
            <div className="oppGrid">
              <div className="mini"><span className="label">Action</span><b>{signal.decision.action}</b></div>
              <div className="mini"><span className="label">Side</span><b>{signal.decision.side}</b></div>
              <div className="mini"><span className="label">Edge</span><b>{pct(signal.decision.edge)}</b></div>
              <div className="mini"><span className="label">Spread</span><b>{signal.decision.spread == null ? '—' : pct(signal.decision.spread)}</b></div>
            </div>
          </article>
        ))}
      </div>

      {data ? (
        <div className="opps">
          <div className="opp">
            <div className="oppTitle">Collector notes</div>
            <pre className="log">{JSON.stringify({ notes: data.sourceNotes, contexts: data.contexts, logs: data.logs }, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
