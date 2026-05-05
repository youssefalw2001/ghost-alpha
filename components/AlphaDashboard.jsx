'use client';

import { useEffect, useMemo, useState } from 'react';

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
  const [error, setError] = useState('');

  const positives = useMemo(() => {
    if (!data?.opportunities) return [];
    return data.opportunities.filter((item) => item.expectedNetUsd >= Number(minProfit || 0));
  }, [data, minProfit]);

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
            Paper mode only. Ghost Alpha scans, scores, and logs opportunities before any execution is ever enabled.
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
        <button className="btn" onClick={scan} disabled={loading}>{loading ? 'Scanning...' : 'Run scan'}</button>
        <button className="btn btn2" disabled>Execution locked</button>
      </div>

      {error ? <div className="opps"><div className="opp risk-high">{error}</div></div> : null}

      <div className="grid stats" style={{ padding: 18 }}>
        <div className="card">
          <div className="label">Opportunities</div>
          <div className="value">{data?.summary?.total ?? '—'}</div>
        </div>
        <div className="card">
          <div className="label">Positive paper signals</div>
          <div className="value">{positives.length}</div>
        </div>
        <div className="card">
          <div className="label">Estimated net</div>
          <div className="value">{money(data?.summary?.estimatedNetUsd)}</div>
        </div>
      </div>

      <div className="opps">
        {(data?.opportunities || []).map((opp) => (
          <article className="opp" key={opp.id}>
            <div className="oppTop">
              <div>
                <div className="oppTitle">{opp.title}</div>
                <p className="panelText">{opp.route}</p>
              </div>
              <span className="badge">{opp.status.replaceAll('_', ' ')}</span>
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
          <pre className="log">{JSON.stringify({ mode: data?.mode, generatedAt: data?.generatedAt, logs: data?.logs || [], safety: data?.safety }, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
