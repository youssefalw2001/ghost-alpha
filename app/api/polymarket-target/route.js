import { NextResponse } from 'next/server';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals = 2) {
  return Number(Number(value || 0).toFixed(decimals));
}

function random(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function normalish(rand) {
  return (rand() + rand() + rand() + rand() + rand() + rand() - 3) / 3;
}

function simulatePredictionWeek({ bankrollUsd, tradesPerDay, stakePct, edgePct, spreadPct, maxDailyLossPct, seed }) {
  const rand = random(seed);
  let bankroll = bankrollUsd;
  let peak = bankrollUsd;
  let maxDrawdown = 0;
  let trades = 0;
  let wins = 0;
  let losses = 0;
  let stoppedDays = 0;
  const daily = [];

  for (let day = 1; day <= 7; day += 1) {
    const startDay = bankroll;
    let dayPnl = 0;
    let dayTrades = 0;

    for (let t = 1; t <= tradesPerDay; t += 1) {
      const dayLossPct = startDay > 0 ? Math.abs(Math.min(dayPnl, 0)) / startDay : 1;
      if (dayLossPct >= maxDailyLossPct / 100) {
        stoppedDays += 1;
        break;
      }

      const stakeUsd = Math.min(bankroll * (stakePct / 100), bankroll * 0.35);
      if (stakeUsd < 5 || bankroll <= 0) break;

      const marketPrice = clamp(0.50 + normalish(rand) * 0.18, 0.08, 0.92);
      const trueProb = clamp(marketPrice + edgePct / 100 + normalish(rand) * 0.025, 0.01, 0.99);
      const entryPrice = clamp(marketPrice + spreadPct / 200, 0.02, 0.98);
      const won = rand() < trueProb;
      const payout = won ? stakeUsd * ((1 - entryPrice) / entryPrice) : -stakeUsd;
      const extraFriction = stakeUsd * (spreadPct / 100) * 0.25;
      const pnl = payout - extraFriction;

      bankroll += pnl;
      dayPnl += pnl;
      trades += 1;
      dayTrades += 1;
      if (pnl > 0) wins += 1;
      else losses += 1;
      peak = Math.max(peak, bankroll);
      maxDrawdown = Math.max(maxDrawdown, peak - bankroll);
    }

    daily.push({ day, pnlUsd: round(dayPnl), trades: dayTrades, endingBankrollUsd: round(bankroll) });
  }

  const net = bankroll - bankrollUsd;
  return {
    bankrollUsd: round(bankrollUsd),
    endingBankrollUsd: round(bankroll),
    weeklyNetUsd: round(net),
    dailyAverageUsd: round(net / 7),
    trades,
    wins,
    losses,
    stoppedDays,
    winRatePct: trades ? round((wins / trades) * 100, 2) : 0,
    maxDrawdownUsd: round(maxDrawdown),
    maxDrawdownPct: bankrollUsd ? round((maxDrawdown / bankrollUsd) * 100, 2) : 0,
    daily,
  };
}

function monteCarloPlan(settings) {
  const runs = [];
  for (let i = 1; i <= 120; i += 1) {
    runs.push(simulatePredictionWeek({ ...settings, seed: 9000 + i * 7919 + Math.floor(settings.bankrollUsd) }));
  }

  const sorted = [...runs].sort((a, b) => a.weeklyNetUsd - b.weeklyNetUsd);
  const median = sorted[Math.floor(sorted.length * 0.5)];
  const p10 = sorted[Math.floor(sorted.length * 0.1)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  const profitable = runs.filter((item) => item.weeklyNetUsd > 0).length;

  return {
    settings,
    median,
    p10,
    p90,
    chanceProfitPct: round((profitable / runs.length) * 100, 2),
    chanceTargetPct: 0,
  };
}

function optimize({ startingBankrollUsd, targetWeeklyUsd }) {
  const bankrollOptions = [startingBankrollUsd, 1000, 2500, 5000, 10000, 25000, 50000, 100000].filter((v, i, arr) => v >= startingBankrollUsd && arr.indexOf(v) === i);
  const tradesOptions = [12, 24, 36, 48, 72, 96];
  const stakeOptions = [2, 3, 5, 7.5, 10, 15];
  const edgeOptions = [1.5, 2.5, 4, 6, 8];
  const spreadOptions = [0.75, 1.25, 2, 3];
  const lossOptions = [4, 7, 10, 15, 25];

  const candidates = [];

  for (const bankrollUsd of bankrollOptions) {
    for (const tradesPerDay of tradesOptions) {
      for (const stakePct of stakeOptions) {
        for (const edgePct of edgeOptions) {
          for (const spreadPct of spreadOptions) {
            for (const maxDailyLossPct of lossOptions) {
              const plan = monteCarloPlan({ bankrollUsd, tradesPerDay, stakePct, edgePct, spreadPct, maxDailyLossPct });
              plan.chanceTargetPct = round((plan.p90.weeklyNetUsd >= targetWeeklyUsd ? 25 : 0) + (plan.median.weeklyNetUsd >= targetWeeklyUsd ? 45 : 0) + (plan.p10.weeklyNetUsd >= targetWeeklyUsd ? 30 : 0), 2);
              const distance = Math.abs(targetWeeklyUsd - plan.median.weeklyNetUsd);
              const drawdownPenalty = plan.median.maxDrawdownPct * 4;
              const riskPenalty = stakePct >= 10 ? 25 : 0;
              const score = plan.median.weeklyNetUsd - distance * 0.2 + plan.chanceProfitPct * 2 - drawdownPenalty - riskPenalty;
              candidates.push({ ...plan, distanceToTargetUsd: round(distance), score: round(score) });
            }
          }
        }
      }
    }
  }

  const ranked = candidates.sort((a, b) => b.score - a.score);
  const targetPlans = candidates
    .filter((item) => item.median.weeklyNetUsd >= targetWeeklyUsd)
    .sort((a, b) => a.settings.bankrollUsd - b.settings.bankrollUsd || b.chanceProfitPct - a.chanceProfitPct)
    .slice(0, 8);

  const highCaseTargetPlans = candidates
    .filter((item) => item.p90.weeklyNetUsd >= targetWeeklyUsd)
    .sort((a, b) => a.settings.bankrollUsd - b.settings.bankrollUsd || b.p90.weeklyNetUsd - a.p90.weeklyNetUsd)
    .slice(0, 8);

  const userVolumePlans = [
    { weeklyVolumeUsd: 500000, feeBps: 50, weeklyRevenueUsd: 2500, note: '0.50% fee on user prediction/swap volume' },
    { weeklyVolumeUsd: 800000, feeBps: 50, weeklyRevenueUsd: 4000, note: '0.50% fee on user prediction/swap volume' },
    { weeklyVolumeUsd: 1500000, feeBps: 25, weeklyRevenueUsd: 3750, note: '0.25% fee on larger user volume' },
    { weeklyVolumeUsd: 3000000, feeBps: 10, weeklyRevenueUsd: 3000, note: '0.10% fee on high volume' },
  ];

  return {
    generatedAt: new Date().toISOString(),
    mode: 'btc_updown_target_optimizer',
    targetWeeklyUsd,
    startingBankrollUsd,
    ownBankrollTargetHit: targetPlans.length > 0,
    bestOwnPlan: ranked[0],
    medianTargetPlans: targetPlans,
    highCaseTargetPlans,
    topOwnPlans: ranked.slice(0, 10),
    userVolumePlans,
    conclusion: targetPlans.length
      ? 'The paper model found target-reaching plans, but they require strong edge and serious drawdown tolerance. Live paper validation is required before execution.'
      : 'The paper model did not find a reliable median plan from the starting bankroll. The target becomes more realistic through higher bankroll or user-volume fee revenue.',
    nextBuild: 'Build live BTC Up/Down collector: market discovery, Chainlink/BTC price tracking, orderbook snapshots, fair-probability log, and resolution outcome tracking.',
    safety: 'Paper model only. No real prediction-market orders are placed. Do not use restricted-region evasion or fake accounts.',
  };
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const startingBankrollUsd = clamp(Number(body.startingBankrollUsd || 500), 50, 1000000);
  const targetWeeklyUsd = clamp(Number(body.targetWeeklyUsd || 3500), 50, 10000000);
  return NextResponse.json(optimize({ startingBankrollUsd, targetWeeklyUsd }));
}

export async function GET() {
  return NextResponse.json(optimize({ startingBankrollUsd: 500, targetWeeklyUsd: 3500 }));
}
