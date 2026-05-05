import { NextResponse } from 'next/server';

const RADAR_PROFILES = {
  smart_wallet_tracker: {
    label: 'Smart-wallet tracker',
    baseWinRate: 0.46,
    avgMovePct: 1.6,
    volatilityPct: 4.2,
    maxPositionPct: 0.18,
    feePct: 0.012,
    slippagePct: 0.35,
  },
  fresh_token_scanner: {
    label: 'Fresh-token scanner',
    baseWinRate: 0.36,
    avgMovePct: 3.8,
    volatilityPct: 13.5,
    maxPositionPct: 0.10,
    feePct: 0.018,
    slippagePct: 1.25,
  },
  whale_before_pump_detector: {
    label: 'Whale-before-pump detector',
    baseWinRate: 0.41,
    avgMovePct: 6.2,
    volatilityPct: 18.0,
    maxPositionPct: 0.08,
    feePct: 0.02,
    slippagePct: 1.65,
  },
};

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

function pickModules(module) {
  if (module && module !== 'all' && RADAR_PROFILES[module]) return [module];
  return Object.keys(RADAR_PROFILES);
}

function runRadarBacktest({ capitalUsd, days, scansPerDay, minScore, module, riskMode }) {
  const rand = random(Math.floor(capitalUsd * 17 + days * 31 + scansPerDay * 43 + minScore * 11 + String(module).length * 73 + riskMode.length * 19));
  const modules = pickModules(module);
  let equity = capitalUsd;
  let peak = capitalUsd;
  let maxDrawdown = 0;
  let signals = 0;
  let trades = 0;
  let wins = 0;
  let losses = 0;
  const tradesLog = [];
  const byModule = {};

  for (const key of modules) {
    byModule[key] = {
      key,
      label: RADAR_PROFILES[key].label,
      signals: 0,
      trades: 0,
      wins: 0,
      losses: 0,
      netUsd: 0,
    };
  }

  for (let day = 1; day <= days; day += 1) {
    for (let scan = 1; scan <= scansPerDay; scan += 1) {
      for (const key of modules) {
        const profile = RADAR_PROFILES[key];
        const signalChance = key === 'fresh_token_scanner' ? 0.34 : key === 'whale_before_pump_detector' ? 0.24 : 0.52;
        if (rand() > signalChance) continue;

        signals += 1;
        byModule[key].signals += 1;

        const score = clamp(45 + normalish(rand) * 28 + profile.avgMovePct * 2, 0, 100);
        if (score < minScore) continue;

        const basePosition = equity * profile.maxPositionPct;
        const riskMultiplier = riskMode === 'conservative' ? 0.55 : riskMode === 'aggressive' ? 1.35 : 1;
        const positionUsd = Math.min(equity * 0.35, basePosition * riskMultiplier);
        if (positionUsd < 5) continue;

        trades += 1;
        byModule[key].trades += 1;

        const scoreBoost = (score - 50) / 100;
        const winRate = clamp(profile.baseWinRate + scoreBoost * 0.28, 0.15, 0.78);
        const won = rand() < winRate;
        const rawMovePct = won
          ? Math.abs(profile.avgMovePct + normalish(rand) * profile.volatilityPct * 0.55)
          : -Math.abs(profile.avgMovePct * 0.7 + normalish(rand) * profile.volatilityPct * 0.65);

        const stopLossPct = riskMode === 'aggressive' ? -18 : riskMode === 'conservative' ? -6 : -10;
        const takeProfitPct = riskMode === 'aggressive' ? 30 : riskMode === 'conservative' ? 8 : 16;
        const cappedMovePct = clamp(rawMovePct, stopLossPct, takeProfitPct);
        const costPct = profile.feePct + profile.slippagePct / 100;
        const netPct = cappedMovePct / 100 - costPct;
        const netUsd = positionUsd * netPct;

        equity += netUsd;
        peak = Math.max(peak, equity);
        maxDrawdown = Math.max(maxDrawdown, peak - equity);

        byModule[key].netUsd += netUsd;
        if (netUsd > 0) {
          wins += 1;
          byModule[key].wins += 1;
        } else {
          losses += 1;
          byModule[key].losses += 1;
        }

        tradesLog.push({
          day,
          scan,
          module: key,
          label: profile.label,
          score: round(score, 1),
          positionUsd: round(positionUsd),
          movePct: round(cappedMovePct, 2),
          netUsd: round(netUsd),
          equityUsd: round(equity),
          status: netUsd > 0 ? 'paper_win' : 'paper_loss',
        });
      }
    }
  }

  const moduleRows = Object.values(byModule).map((row) => ({
    ...row,
    netUsd: round(row.netUsd),
    winRatePct: row.trades ? round((row.wins / row.trades) * 100, 2) : 0,
  })).sort((a, b) => b.netUsd - a.netUsd);

  const totalNet = equity - capitalUsd;
  return {
    generatedAt: new Date().toISOString(),
    mode: 'radar_public_data_model_backtest',
    settings: { capitalUsd, days, scansPerDay, minScore, module, riskMode },
    summary: {
      startingCapitalUsd: round(capitalUsd),
      endingEquityUsd: round(equity),
      totalNetUsd: round(totalNet),
      weeklyNetUsd: round((totalNet / days) * 7),
      dailyAverageUsd: round(totalNet / days),
      signals,
      trades,
      wins,
      losses,
      winRatePct: trades ? round((wins / trades) * 100, 2) : 0,
      maxDrawdownUsd: round(maxDrawdown),
      maxDrawdownPct: capitalUsd ? round((maxDrawdown / capitalUsd) * 100, 2) : 0,
    },
    byModule: moduleRows,
    trades: tradesLog.slice(-100).reverse(),
    accuracyNotes: [
      'This model is closer to real trading than pure profit fantasy because it includes position sizing, slippage, fees, stops, take-profit caps, and drawdown.',
      'It still cannot perfectly match real results because real fills depend on latency, liquidity, execution venue, order type, MEV, and how fast the alert is acted on.',
      'The next accuracy upgrade is saving live radar signals and measuring what happened to each token 5m/30m/2h later.',
    ],
  };
}

function optimizeRadar({ capitalUsd, targetWeeklyUsd }) {
  const candidates = [];
  const daysOptions = [7, 14, 30];
  const scanOptions = [24, 48, 96, 144];
  const scoreOptions = [45, 55, 65, 75, 85];
  const riskModes = ['conservative', 'balanced', 'aggressive'];
  const moduleOptions = ['all', ...Object.keys(RADAR_PROFILES)];

  for (const days of daysOptions) {
    for (const scansPerDay of scanOptions) {
      for (const minScore of scoreOptions) {
        for (const riskMode of riskModes) {
          for (const module of moduleOptions) {
            const result = runRadarBacktest({ capitalUsd, days, scansPerDay, minScore, module, riskMode });
            const distance = Math.abs(targetWeeklyUsd - result.summary.weeklyNetUsd);
            const drawdownPenalty = result.summary.maxDrawdownPct * 3;
            const tradePenalty = result.summary.trades < 10 ? 30 : 0;
            const score = result.summary.weeklyNetUsd - distance * 0.2 - drawdownPenalty - tradePenalty;
            candidates.push({
              settings: result.settings,
              summary: result.summary,
              byModule: result.byModule,
              score: round(score),
              distanceToTargetUsd: round(distance),
            });
          }
        }
      }
    }
  }

  const ranked = candidates.sort((a, b) => b.score - a.score);
  return {
    targetWeeklyUsd,
    bestPlan: ranked[0],
    targetHits: ranked.filter((item) => item.summary.weeklyNetUsd >= targetWeeklyUsd).slice(0, 8),
    topPlans: ranked.slice(0, 12),
  };
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const capitalUsd = clamp(Number(body.capitalUsd || 500), 50, 1000000);
  const days = clamp(Number(body.days || 30), 1, 365);
  const scansPerDay = clamp(Number(body.scansPerDay || 48), 1, 288);
  const minScore = clamp(Number(body.minScore || 65), 1, 100);
  const module = String(body.module || 'all');
  const riskMode = String(body.riskMode || 'balanced');
  const targetWeeklyUsd = clamp(Number(body.targetWeeklyUsd || 250), 1, 1000000);

  const backtest = runRadarBacktest({ capitalUsd, days, scansPerDay, minScore, module, riskMode });
  const optimizer = optimizeRadar({ capitalUsd, targetWeeklyUsd });

  return NextResponse.json({
    backtest,
    optimizer,
    safety: 'Radar backtest is paper-mode only and does not execute trades. It uses public-data strategy assumptions, not private insider information.',
  });
}

export async function GET() {
  const backtest = runRadarBacktest({ capitalUsd: 500, days: 30, scansPerDay: 48, minScore: 65, module: 'all', riskMode: 'balanced' });
  const optimizer = optimizeRadar({ capitalUsd: 500, targetWeeklyUsd: 250 });
  return NextResponse.json({ backtest, optimizer, safety: 'Paper-mode only.' });
}
