'use client';

import { useState } from 'react';

function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function pct(value) {
  return `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

function Plan({ title, plan }) {
  if (!plan) {
    return (
      <div className="opp">
        <div className="oppTitle">{title}</div>
        <p className="panelText">No plan found for this category.</p>
      </div>
    );
  }

  return (
    <article className="opp">
      <div className="oppTop">
        <div>
          <div className="label">{title}</div>
          <div className="oppTitle">{money(plan.median.weeklyNetUsd)} median weekly</div>
          <p className="panelText">
            Bankroll {money(plan.settings.bankrollUsd)} · {plan.settings.tradesPerDay} trades/day · stake {plan.settings.stakePct}% · edge {plan.settings.edgePct}%
          </p>
        </div>
        <span className="badge">P90 {money(plan.p90.weeklyNetUsd)}</span>
      </div>
      <div className="oppGrid">
        <div className="mini"><span className="label">10% weak case</span><b>{money(plan.p10.weeklyNetUsd)}</b></div>
        <div className="mini"><span className="label">Median</span><b>{money(plan.median.weeklyNetUsd)}</b></div>
        <div className="mini"><span className="label">Strong case</span><b>{money(plan.p90.weeklyNetUsd)}</b></div>
        <div className="mini"><span className="label">Profit chance</span><b>{pct(plan.chanceProfitPct)}</b></div>
      </div>
      <div className="oppGrid" style={{ marginTop: 12 }}>
        <div className="mini"><span className="label">Drawdown</span><b>{money(plan.median.maxDrawdownUsd)}</b></div>
        <div className="mini"><span className="label">Win rate</span><b>{pct(plan.median.winRatePct)}</b></div>
        <div className="mini"><span className="label">Max daily loss</span><b>{pct(plan.settings.maxDailyLossPct)}</b></div>
        <div className="mini"><span className="label">Spread</span><b>{pct(plan.settings.spreadPct)}</b></div>
      </div>
    </article>
  );
}

export default function BtcTargetOptimizer() {
  const [bankroll, setBankroll] = useState('500');
  const [target, setTarget] = useState('3500');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function run() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/polymarket-target', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ startingBankrollUsd: Number(bankroll), targetWeeklyUsd: Number(target) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Target optimizer failed');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Target optimizer failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel" style={{ marginTop: 24 }}>
      <div className="panelHead">
        <div>
          <h2 className="panelTitle">BTC Up/Down target optimizer</h2>
          <p className="panelText">
            Models whether a BTC prediction-market strategy can reach a weekly target from your bankroll. It also shows when user-volume fees are more realistic than private trading.
          </p>
        </div>
        <span className="pill">BTC model</span>
      </div>

      <div className="controls">
        <label className="field"><span>Starting bankroll</span><input className="input" value={bankroll} onChange={(event) => setBankroll(event.target.value)} /></label>
        <label className="field"><span>Weekly target</span><input className="input" value={target} onChange={(event) => setTarget(event.target.value)} /></label>
        <button className="btn" onClick={run} disabled={loading}>{loading ? 'Testing...' : 'Optimize BTC target'}</button>
        <button className="btn btn2" disabled>No real orders</button>
      </div>

      {error ? <div className="opps"><div className="opp risk-high">{error}</div></div> : null}

      {data ? (
        <>
          <div className="grid stats" style={{ padding: 18 }}>
            <div className="card"><div className="label">Weekly target</div><div className="value">{money(data.targetWeeklyUsd)}</div></div>
            <div className="card"><div className="label">Own bankroll hit?</div><div className="value">{data.ownBankrollTargetHit ? 'Yes' : 'No'}</div></div>
            <div className="card"><div className="label">Best median</div><div className="value">{money(data.bestOwnPlan?.median?.weeklyNetUsd)}</div></div>
          </div>

          <div className="opps">
            <Plan title="Best own-bankroll plan" plan={data.bestOwnPlan} />
            <Plan title="Cheapest median target plan" plan={data.medianTargetPlans?.[0]} />
            <Plan title="Strong-case target plan" plan={data.highCaseTargetPlans?.[0]} />
          </div>

          <div className="opps">
            <div className="opp">
              <div className="oppTitle">User-volume path to target</div>
              <p className="panelText">If your private bankroll cannot safely hit the target, fees from user volume can.</p>
              <div className="oppGrid" style={{ marginTop: 12 }}>
                {data.userVolumePlans?.map((plan) => (
                  <div className="mini" key={`${plan.weeklyVolumeUsd}-${plan.feeBps}`}>
                    <span className="label">{money(plan.weeklyVolumeUsd)} volume</span>
                    <b>{money(plan.weeklyRevenueUsd)}/week</b>
                    <p className="panelText">{plan.feeBps / 100}% fee</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="opps">
            <div className="opp">
              <div className="oppTitle">Conclusion</div>
              <p className="panelText">{data.conclusion}</p>
              <p className="panelText">{data.nextBuild}</p>
              <p className="panelText">{data.safety}</p>
            </div>
          </div>
        </>
      ) : (
        <div className="opps">
          <div className="opp">
            <div className="oppTitle">No BTC target test yet</div>
            <p className="panelText">Run the optimizer to see if $3k–$4k/week is possible from your bankroll or if user-volume fees are the better path.</p>
          </div>
        </div>
      )}
    </div>
  );
}
