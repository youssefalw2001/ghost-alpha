'use client';

import { useEffect, useMemo, useState } from 'react';

const TYPE_LABELS = {
  funding_rate_arbitrage: 'Funding rate',
  solana_route_arbitrage: 'Solana route',
  stablecoin_arbitrage: 'Stablecoin',
  evm_flashloan_template: 'EVM flash-loan',
  paper_arbitrage: 'Paper route',
};

const TYPE_SIMPLE = {
  funding_rate_arbitrage: 'A funding-rate idea. This means a futures market may be paying one side of the trade.',
  solana_route_arbitrage: 'A Solana swap-route idea. This means the app found a possible price difference through Jupiter routes.',
  stablecoin_arbitrage: 'A stablecoin spread idea. This checks whether stablecoins are slightly off peg against each other.',
  evm_flashloan_template: 'A future flash-loan idea. This is only a template right now, not executable yet.',
  paper_arbitrage: 'A paper route idea. This is a simulated opportunity only.',
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

  const best = useMemo(() => {
    if (!data?.opportunities?.length) return null;
    return [...data.opportunities].sort((a, b) => Number(b.expectedNetUsd || 0) - Number(a.expectedNetUsd || 0))[0];
  }, [data]);

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
          <h2 className="panelTitle">Ghost Alpha scanner</h2>
          <p className="panelText">
            Simple meaning: this app looks for crypto opportunities, but it is only pretending/paper-testing right now. It does not trade yet.
          </p>
        </div>
        <span className="pill">No real trades</span>
      </div>

      <div className="opps">
        <div className="opp" style={{ borderColor: 'rgba(110,231,183,.3)', background: 'rgba(110,231,183,.08)' }}>
          <div className="oppTop">
            <div>
              <div className="label">What you are seeing</div>
              <div className="oppTitle">The app is hunting for possible plays, not making money yet.</div>
              <p className="panelText">
                Think of it like radar. It says “this might be worth checking.” Later, after we track results, we decide what can be automated.
              </p>
            </div>
            <span className="badge">Scanner only</span>
          </div>
        </div>
      </div>

      {best ? (
        <div className="opps">
          <article className="opp" style={{ borderColor: 'rgba(251,191,36,.35)', background: 'rgba(251,191,36,.08)' }}>
            <div className="oppTop">
              <div>
                <div className="label">Best signal right now</div>
                <div className="oppTitle">{best.title}</div>
                <p className="panelText">{TYPE_SIMPLE[best.type] || 'This is a paper-mode signal.'}</p>
              </div>
              <span className="badge">{TYPE_LABELS[best.type] || best.type}</span>
            </div>
            <div className="oppGrid">
              <div className="mini"><span className="label">Paper profit</span><b>{money(best.expectedNetUsd)}</b></div>
              <div className="mini"><span className="label">Risk</span><b className={riskClass(best.risk)}>{best.risk}</b></div>
              <div className="mini"><span className="label">Can trade now?</span><b>No</b></div>
              <div className="mini"><span className="label">Next step</span><b>Track it</b></div>
            </div>
          </article>
        </div>
      ) : null}

      <div className="controls">
        <label className="field">
          <span>Test amount</span>
          <input className="input" value={capital} onChange={(event) => setCapital(event.target.value)} />
        </label>
        <label className="field">
          <span>Show only profit above</span>
          <input className="input" value={minProfit} onChange={(event) => setMinProfit(event.target.value)} />
        </label>
        <label className="field">
          <span>Type of signals</span>
          <select className="input" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All signals</option>
            <option value="funding_rate_arbitrage">Funding rates</option>
            <option value="solana_route_arbitrage">Solana swaps</option>
            <option value="stablecoin_arbitrage">Stablecoins</option>
            <option value="evm_flashloan_template">Flash-loan ideas</option>
          </select>
        </label>
        <button className="btn" onClick={scan} disabled={loading}>{loading ? 'Scanning...' : 'Scan again'}</button>
        <button className="btn btn2" disabled>Trading locked</button>
      </div>

      {error ? <div className="opps"><div className="opp risk-high">{error}</div></div> : null}

      <div className="grid stats" style={{ padding: 18 }}>
        <div className="card">
          <div className="label">Signals found</div>
          <div className="value">{filtered.length || data?.summary?.total || '—'}</div>
        </div>
        <div className="card">
          <div className="label">Look profitable on paper</div>
          <div className="value">{positives.length}</div>
        </div>
        <div className="card">
          <div className="label">Total paper profit</div>
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
                <p className="panelText">{TYPE_SIMPLE[opp.type] || opp.route}</p>
                <p className="panelText">Route: {opp.route}</p>
              </div>
              <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                <span className="badge">{TYPE_LABELS[opp.type] || opp.type}</span>
                <span className="badge">{opp.status.replaceAll('_', ' ')}</span>
              </div>
            </div>
            <div className="oppGrid">
              <div className="mini"><span className="label">Before fees</span><b>{money(opp.expectedGrossUsd)}</b></div>
              <div className="mini"><span className="label">Costs</span><b>{money(opp.estimatedFeesUsd)}</b></div>
              <div className="mini"><span className="label">Paper profit</span><b>{money(opp.expectedNetUsd)}</b></div>
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
