import { NextResponse } from 'next/server';

const MODULES = {
  all: ['funding_rate_arbitrage', 'solana_route_arbitrage', 'stablecoin_arbitrage', 'evm_flashloan_template'],
  funding_rate_arbitrage: ['funding_rate_arbitrage'],
  solana_route_arbitrage: ['solana_route_arbitrage'],
  stablecoin_arbitrage: ['stablecoin_arbitrage'],
  evm_flashloan_template: ['evm_flashloan_template'],
};

const PROFILE = {
  funding_rate_arbitrage: { label: 'Funding rates', avg: 0.72, spread: 2.1, winRate: 0.58, fee: 0.35, risk: 0.65 },
  solana_route_arbitrage: { label: 'Solana routes', avg: 0.18, spread: 1.15, winRate: 0.42, fee: 0.08, risk: 0.9 },
  stablecoin_arbitrage: { label: 'Stablecoins', avg: 0.06, spread: 0.28, winRate: 0.53, fee: 0.05, risk: 0.35 },
  evm_flashloan_template: { label: 'EVM flash-loan templates', avg: -1.8, spread: 14, winRate: 0.24, fee: 5.5, risk: 1.65 },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals = 4) {
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

function runBacktest({ days, scansPerDay, startingCapitalUsd, minNetUsd, module }) {
  const activeModules = MODULES[module] || MODULES.all;
  const rand = random(Number(`${days}${scansPerDay}${Math.floor(startingCapitalUsd)}${Math.floor(minNetUsd * 100)}`));
  const trades = [];
  const moduleStats = {};
  let equity = startingCapitalUsd;
  let peak = startingCapitalUsd;
  let maxDrawdownUsd = 0;
  let passedSignals = 0;
  let rejectedSignals = 0;

  activeModules.forEach((key) => {
    moduleStats[key] = {
      label: PROFILE[key].label,
      signals: 0,
      passed: 0,
      wins: 0,
      losses: 0,
      netUsd: 0,
    };
  });

  for (let day = 1; day <= days; day += 1) {
    for (let scan = 1; scan <= scansPerDay; scan += 1) {
      for (const key of activeModules) {
        const profile = PROFILE[key];
        const signalChance = key === 'evm_flashloan_template' ? 0.38 : key === 'stablecoin_arbitrage' ? 0.62 : 0.75;
        moduleStats[key].signals += 1;

        if (rand() > signalChance) {
          rejectedSignals += 1;
          continue;
        }

        const paperEdge = profile.avg + normalish(rand) * profile.spread;
        const expectedNet = paperEdge - profile.fee;

        if (expectedNet < minNetUsd) {
          rejectedSignals += 1;
          continue;
        }

        passedSignals += 1;
        moduleStats[key].passed += 1;

        const capitalFactor = clamp(startingCapitalUsd / 1000, 0.2, 8);
        const slippagePenalty = Math.max(0, normalish(rand) * profile.risk);
        const executionNoise = normalish(rand) * profile.spread * 0.35;
        const actualNet = (expectedNet + executionNoise - slippagePenalty) * capitalFactor;
        const won = actualNet > 0;

        equity += actualNet;
        peak = Math.max(peak, equity);
        maxDrawdownUsd = Math.max(maxDrawdownUsd, peak - equity);

        moduleStats[key].netUsd += actualNet;
        if (won) moduleStats[key].wins += 1;
        else moduleStats[key].losses += 1;

        trades.push({
          day,
          scan,
          module: key,
          label: profile.label,
          expectedNetUsd: round(expectedNet),
          actualNetUsd: round(actualNet),
          status: won ? 'paper_win' : 'paper_loss',
          equityUsd: round(equity),
        });
      }
    }
  }

  const wins = trades.filter((item) => item.actualNetUsd > 0).length;
  const losses = trades.length - wins;
  const totalNetUsd = equity - startingCapitalUsd;

  const byModule = Object.entries(moduleStats).map(([key, value]) => ({
    key,
    label: value.label,
    signals: value.signals,
    passed: value.passed,
    wins: value.wins,
    losses: value.losses,
    winRatePct: value.passed ? round((value.wins / value.passed) * 100, 2) : 0,
    netUsd: round(value.netUsd),
  })).sort((a, b) => b.netUsd - a.netUsd);

  return {
    generatedAt: new Date().toISOString(),
    mode: 'paper_backtest',
    settings: { days, scansPerDay, startingCapitalUsd, minNetUsd, module },
    summary: {
      startingCapitalUsd: round(startingCapitalUsd),
      endingEquityUsd: round(equity),
      totalNetUsd: round(totalNetUsd),
      dailyAverageUsd: round(totalNetUsd / days),
      trades: trades.length,
      wins,
      losses,
      winRatePct: trades.length ? round((wins / trades.length) * 100, 2) : 0,
      passedSignals,
      rejectedSignals,
      maxDrawdownUsd: round(maxDrawdownUsd),
      maxDrawdownPct: round((maxDrawdownUsd / startingCapitalUsd) * 100, 2),
    },
    byModule,
    trades: trades.slice(-80).reverse(),
    safety: 'This is a paper backtest model. It does not prove future profit and does not execute trades.',
  };
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const days = clamp(Number(body.days || 7), 1, 90);
  const scansPerDay = clamp(Number(body.scansPerDay || 24), 1, 288);
  const startingCapitalUsd = clamp(Number(body.startingCapitalUsd || 1000), 50, 1000000);
  const minNetUsd = clamp(Number(body.minNetUsd || 0.25), -1000, 10000);
  const module = String(body.module || 'all');

  return NextResponse.json(runBacktest({ days, scansPerDay, startingCapitalUsd, minNetUsd, module }));
}

export async function GET() {
  return NextResponse.json(runBacktest({ days: 7, scansPerDay: 24, startingCapitalUsd: 1000, minNetUsd: 0.25, module: 'all' }));
}
