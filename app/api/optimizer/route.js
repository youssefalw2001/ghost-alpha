import { NextResponse } from 'next/server';

const MODULES = ['funding_rate_arbitrage', 'solana_route_arbitrage', 'stablecoin_arbitrage', 'evm_flashloan_template', 'all'];

const PROFILE = {
  funding_rate_arbitrage: { label: 'Funding rates', avg: 0.72, spread: 2.1, winRate: 0.58, fee: 0.35, risk: 0.65, quality: 0.82 },
  solana_route_arbitrage: { label: 'Solana routes', avg: 0.18, spread: 1.15, winRate: 0.42, fee: 0.08, risk: 0.9, quality: 0.54 },
  stablecoin_arbitrage: { label: 'Stablecoins', avg: 0.06, spread: 0.28, winRate: 0.53, fee: 0.05, risk: 0.35, quality: 0.38 },
  evm_flashloan_template: { label: 'EVM flash-loan templates', avg: -1.8, spread: 14, winRate: 0.24, fee: 5.5, risk: 1.65, quality: 0.18 },
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

function activeModules(module) {
  if (module === 'all') return Object.keys(PROFILE);
  return PROFILE[module] ? [module] : Object.keys(PROFILE);
}

function simulate({ module, days, scansPerDay, capitalUsd, minNetUsd, riskMode }) {
  const rand = random(Math.floor(capitalUsd + days * 17 + scansPerDay * 31 + minNetUsd * 1000 + module.length * 13 + riskMode.length * 19));
  const modules = activeModules(module);
  let equity = capitalUsd;
  let peak = capitalUsd;
  let maxDrawdown = 0;
  let trades = 0;
  let wins = 0;
  let losses = 0;
  const moduleNet = {};

  modules.forEach((key) => {
    moduleNet[key] = 0;
  });

  for (let day = 1; day <= days; day += 1) {
    for (let scan = 1; scan <= scansPerDay; scan += 1) {
      for (const key of modules) {
        const profile = PROFILE[key];
        const chance = key === 'evm_flashloan_template' ? 0.28 : key === 'stablecoin_arbitrage' ? 0.54 : key === 'funding_rate_arbitrage' ? 0.7 : 0.62;
        if (rand() > chance) continue;

        const grossSignal = profile.avg + normalish(rand) * profile.spread;
        let expectedNet = grossSignal - profile.fee;
        if (riskMode === 'conservative') expectedNet -= profile.risk * 0.2;
        if (riskMode === 'aggressive') expectedNet += profile.risk * 0.18;
        if (expectedNet < minNetUsd) continue;

        const capitalFactor = clamp(capitalUsd / 1000, 0.1, 30);
        const scalingPenalty = Math.max(0, capitalFactor - 8) * profile.risk * 0.07;
        const slippagePenalty = Math.max(0, normalish(rand) * profile.risk) + scalingPenalty;
        const executionNoise = normalish(rand) * profile.spread * 0.32;
        const actualNet = (expectedNet + executionNoise - slippagePenalty) * capitalFactor * profile.quality;

        trades += 1;
        if (actualNet > 0) wins += 1;
        else losses += 1;

        equity += actualNet;
        moduleNet[key] += actualNet;
        peak = Math.max(peak, equity);
        maxDrawdown = Math.max(maxDrawdown, peak - equity);
      }
    }
  }

  const net = equity - capitalUsd;
  return {
    module,
    days,
    scansPerDay,
    capitalUsd: round(capitalUsd),
    minNetUsd: round(minNetUsd, 4),
    riskMode,
    weeklyNetUsd: round(net),
    dailyAverageUsd: round(net / days),
    endingEquityUsd: round(equity),
    trades,
    wins,
    losses,
    winRatePct: trades ? round((wins / trades) * 100, 2) : 0,
    maxDrawdownUsd: round(maxDrawdown),
    maxDrawdownPct: capitalUsd ? round((maxDrawdown / capitalUsd) * 100, 2) : 0,
    moduleNet: Object.entries(moduleNet).map(([key, value]) => ({ key, label: PROFILE[key].label, netUsd: round(value) })).sort((a, b) => b.netUsd - a.netUsd),
  };
}

function optimize({ targetWeeklyUsd }) {
  const candidates = [];
  const capitalOptions = [500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
  const scanOptions = [24, 48, 96, 144, 288];
  const minNetOptions = [0.1, 0.25, 0.5, 1, 2.5, 5];
  const riskModes = ['conservative', 'balanced', 'aggressive'];

  for (const module of MODULES) {
    for (const capitalUsd of capitalOptions) {
      for (const scansPerDay of scanOptions) {
        for (const minNetUsd of minNetOptions) {
          for (const riskMode of riskModes) {
            const result = simulate({ module, days: 7, scansPerDay, capitalUsd, minNetUsd, riskMode });
            const distance = Math.abs(targetWeeklyUsd - result.weeklyNetUsd);
            const capitalEfficiency = result.weeklyNetUsd / capitalUsd;
            const drawdownPenalty = result.maxDrawdownPct * 20;
            const score = result.weeklyNetUsd - distance * 0.2 + capitalEfficiency * 1500 - drawdownPenalty;
            candidates.push({ ...result, distanceToTargetUsd: round(distance), capitalEfficiencyPct: round(capitalEfficiency * 100, 2), score: round(score) });
          }
        }
      }
    }
  }

  const ranked = candidates.sort((a, b) => b.score - a.score);
  const targetHits = ranked.filter((item) => item.weeklyNetUsd >= targetWeeklyUsd).sort((a, b) => a.capitalUsd - b.capitalUsd || b.weeklyNetUsd - a.weeklyNetUsd);
  const bestOverall = ranked[0];
  const bestHit = targetHits[0] || null;

  return {
    generatedAt: new Date().toISOString(),
    mode: 'paper_optimizer',
    targetWeeklyUsd,
    targetHit: Boolean(bestHit),
    bestTargetPlan: bestHit,
    bestOverallPlan: bestOverall,
    topPlans: ranked.slice(0, 12),
    targetPlans: targetHits.slice(0, 8),
    warning: 'This optimizer uses paper simulation. It does not guarantee real profit. Real execution needs live fills, latency, fees, slippage, failed transaction tracking, and risk limits.',
    nextBuildRecommendation: bestHit
      ? 'Build live paper-history logging for this plan and track it for 3-7 days before enabling execution.'
      : 'The current paper model did not safely reach the target. Improve funding-rate scanner, add real CEX/DEX spreads, and add persistent paper logs before execution.',
  };
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const targetWeeklyUsd = clamp(Number(body.targetWeeklyUsd || 2500), 100, 100000);
  return NextResponse.json(optimize({ targetWeeklyUsd }));
}

export async function GET() {
  return NextResponse.json(optimize({ targetWeeklyUsd: 2500 }));
}
