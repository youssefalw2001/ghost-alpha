'use client';

import { useState } from 'react';

function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function labelModule(value) {
  return String(value || '').replaceAll('_', ' ').replace('arbitrage', '').trim() || 'all';
}

function PlanCard({ title, plan }) {
  if (!plan) {
    return (
      <div className="opp">
        <div className="oppTitle">{title}</div>
        <p className="panelText">No plan reached the target yet under this paper model.</p>
      </div>
    );
  }

  return (
    <article className="opp">
      <div className="oppTop">
        <div>
          <div className="label">{title}</div>
          <div className="oppTitle">{labelModule(plan.module)} · {plan.riskMode}</div>
          <p className="panelText">Capital {money(plan.capitalUsd)} · {plan.scansPerDay} scans/day · min net {money(plan.minNetUsd)}</p>
        </div>
        <span className="badge">{money(plan.weeklyNetUsd)} / week</span>
      </div>
      <div className="oppGrid">
        <div className="mini"><span className="label">Daily avg</span><b>{money(plan.dailyAverageUsd)}</b></div>
        <div className="mini"><span className="label">Trades</span><b>{plan.trades}</b></div>
        <div className="mini"><span className="label">Win rate</span><b>{plan.winRatePct}%</b></div>
        <div className="mini"><span className="label">Drawdown</span><b>{money(plan.maxDrawdownUsd)}</b></div>
      </div>
      {plan.moduleNet?.length ? (
        <div className="oppGrid" style={{ marginTop: 12 }}>
          {plan.moduleNet.slice(0, 4).map((item) => (
            <div className="mini" key={item.key}>
              <span className="label">{item.label}</span>
              <b>{money(item.netUsd)}</b>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function Optimizer() {
  const [target, setTarget] = useState('2500');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function runOptimizer() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/optimizer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetWeeklyUsd: Number(target) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Optimizer failed');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Optimizer failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel" style={{ marginTop: 24 }}>
      <div className="panelHead">
        <div>
          <h2 className="panelTitle">Profit optimizer</h2>
          <p className="panelText">
            This searches paper settings to see what capital, module, scans/day, and risk mode can get closest to your weekly target.
          </p>
        </div>
        <span className="pill">Target mode</span>
      </div>

      <div className="controls">
        <label className="field">
          <span>Weekly target</span>
          <input className="input" value={target} onChange={(event) => setTarget(event.target.value)} />
        </label>
        <button className="btn" onClick={runOptimizer} disabled={loading}>{loading ? 'Optimizing...' : 'Find best plan'}</button>
        <button className="btn btn2" disabled>Real execution locked</button>
      </div>

      {error ? <div className="opps"><div className="opp risk-high">{error}</div></div> : null}

      {data ? (
        <>
          <div className="grid stats" style={{ padding: 18 }}>
            <div className="card"><div className="label">Target</div><div className="value">{money(data.targetWeeklyUsd)}</div></div>
            <div className="card"><div className="label">Reached target?</div><div className="value">{data.targetHit ? 'Yes' : 'No'}</div></div>
            <div className="card"><div className="label">Best paper result</div><div className="value">{money(data.bestOverallPlan?.weeklyNetUsd)}</div></div>
          </div>

          <div className="opps">
            <PlanCard title="Best target plan" plan={data.bestTargetPlan} />
            <PlanCard title="Best overall plan" plan={data.bestOverallPlan} />
          </div>

          <div className="opps">
            <div className="opp">
              <div className="oppTitle">Top plans</div>
              <div className="oppGrid" style={{ marginTop: 12 }}>
                {data.topPlans?.slice(0, 8).map((plan, index) => (
                  <div className="mini" key={`${plan.module}-${plan.capitalUsd}-${plan.scansPerDay}-${index}`}>
                    <span className="label">{labelModule(plan.module)}</span>
                    <b>{money(plan.weeklyNetUsd)}</b>
                    <p className="panelText">{money(plan.capitalUsd)} · {plan.scansPerDay}/day · {plan.riskMode}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="opps">
            <div className="opp">
              <div className="oppTitle">What this means</div>
              <p className="panelText">{data.nextBuildRecommendation}</p>
              <p className="panelText">{data.warning}</p>
            </div>
          </div>
        </>
      ) : (
        <div className="opps">
          <div className="opp">
            <div className="oppTitle">No optimizer run yet</div>
            <p className="panelText">Click Find best plan. The optimizer will try many settings and show what gets closest to the weekly target.</p>
          </div>
        </div>
      )}
    </div>
  );
}
