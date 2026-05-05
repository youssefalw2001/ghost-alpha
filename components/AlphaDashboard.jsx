'use client';

import { useEffect, useMemo, useState } from 'react';

const TYPE_LABELS = {
  funding_rate_arbitrage: 'Funding rate',
  solana_route_arbitrage: 'Solana route',
  stablecoin_arbitrage: 'Stablecoin',
  evm_flashloan_template: 'EVM flash-loan',
  paper_arbitrage: 'Paper route',
};

function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}

function riskClass(risk) {
  if (risk === 'low') return 'risk-low';
  if (risk === 'medium') return 'risk-med';
  return 'risk-high';
}

export default function AlphaDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [capital, setCapital] = useState('1000');
  const [minProfit, setMinProfit] = useState('0.25');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    if (!data?.opportunities) return [];
    if (filter === 'all') return data.opportunities;
    return data.opportunities.filter((item) => item.type === filter);
  }, [data, filter]);

  const positives = useMemo(() => {
    return filtered.filter((item) => item.expectedNetUsd >= Number(minProfit || 0));
  }, [filtered, minProfit]);

  async function scan() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/opportunities', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Scanner failed');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scanner failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    scan();
  }, []);

  return (
    <div className="panel">
      <div className="panelHead">
        <div>
          <h2 className="panelTitle">Private opportunity scanner</h2>
          <p className="panelText">
            Paper mode only. Ghost Alpha scans funding rates, Solana routes, stablecoins, and EVM flash-loan templates before any execution is enabled.
          </p>
        </div>
        <span className="pill">Paper mode</span>
      </div>

      <div className="controls">
        <label className="field">
          <span>Capital to model</span>
          <input className="input" value={capital} onChange={(event) => setCapital(event.target.value)} />
        </label>
        <label className="field">
          <span>Minimum net alert</span>
          <input className="input" value={minProfit} onChange={(event) => setMinProfit(event.target.value)} />
        </label>
        <label className="field">
          <span>Module filter</span>
          <select className="input" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All modules</option>
            <option value="funding_rate_arbitrage">Funding rates</option>
            <option value="solana_route_arbitrage">Solana routes</option>
            <option value="stablecoin_arbitrage">Stablecoins</option>
            <option value="evm_flashloan_template">EVM flash-loan templates</option>
          </select>
        </label>
        <button className="btn" onClick={scan} disabled={loading}>{loading ? 'Scanning...' : 'Run scan'}</button>
        <button className="btn btn2" disabled>Execution locked</button>
      </div>

      {error ? <div className="opps"><div className="opp risk-high">{error}</div></div> : null}

      <div className="grid stats" style={{ padding: 18 }}>
        <div className="card">
          <div className="label">Visible opportunities</div>
          <div className="value">{filtered.length || data?.summary?.total || '—'}</div>
        </div>
        <div className="card">
          <div className="label">Positive paper signals</div>
          <div className="value">{positives.length}</div>
        </div>
        <div className="card">
          <div className="label">All-module estimated net</div>
          <div className="value">{money(data?.summary?.estimatedNetUsd)}</div>
        </div>
      </div>

      {data?.modules ? (
        <div className="grid stats" style={{ padding: '0 18px 18px' }}>
          {Object.entries(data.modules).map(([key, value]) => (
            <div className="card" key={key}>
              <div className="label">{TYPE_LABELS[key] || key}</div>
              <div className="value">{value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="opps">
        {filtered.map((opp) => (
          <article className="opp" key={opp.id}>
            <div className="oppTop">
              <div>
                <div className="oppTitle">{opp.title}</div>
                <p className="panelText">{opp.route}</p>
              </div>
              <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                <span className="badge">{TYPE_LABELS[opp.type] || opp.type}</span>
                <span className="badge">{opp.status.replaceAll('_', ' ')}</span>
              </div>
            </div>
            <div className="oppGrid">
              <div className="mini"><span className="label">Gross</span><b>{money(opp.expectedGrossUsd)}</b></div>
              <div className="mini"><span className="label">Fees</span><b>{money(opp.estimatedFeesUsd)}</b></div>
              <div className="mini"><span className="label">Net</span><b>{money(opp.expectedNetUsd)}</b></div>
              <div className="mini"><span className="label">Risk</span><b className={riskClass(opp.risk)}>{opp.risk}</b></div>
            </div>
            <p className="panelText">{opp.notes}</p>
          </article>
        ))}
      </div>

      <div className="opps">
        <div className="opp">
          <div className="oppTitle">System log</div>
          <pre className="log">{JSON.stringify({ mode: data?.mode, generatedAt: data?.generatedAt, modules: data?.modules, logs: data?.logs || [], safety: data?.safety }, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
