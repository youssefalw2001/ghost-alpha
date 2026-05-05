import { NextResponse } from 'next/server';

const TOKENS = {
  SOL: {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    decimals: 9,
  },
  USDC: {
    mint: 'EPjFWdd5AufqSSqeM2qnc1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    decimals: 6,
  },
  USDT: {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4Yy5oLFRV3NzzBK9mzq6G',
    symbol: 'USDT',
    decimals: 6,
  },
};

const ROUTES = [
  { id: 'sol-usdc-loop', chain: 'solana', base: 'SOL', quote: 'USDC', sizeUsd: 250 },
  { id: 'sol-usdt-loop', chain: 'solana', base: 'SOL', quote: 'USDT', sizeUsd: 250 },
  { id: 'usdc-usdt-loop', chain: 'solana', base: 'USDC', quote: 'USDT', sizeUsd: 500 },
];

function nowIso() {
  return new Date().toISOString();
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

async function jupiterQuote(inputMint, outputMint, amount) {
  const url = new URL('https://quote-api.jup.ag/v6/quote');
  url.searchParams.set('inputMint', inputMint);
  url.searchParams.set('outputMint', outputMint);
  url.searchParams.set('amount', String(amount));
  url.searchParams.set('slippageBps', '50');
  url.searchParams.set('onlyDirectRoutes', 'false');
  url.searchParams.set('maxAccounts', '64');

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Jupiter quote failed: ${res.status}`);
  return res.json();
}

function fallbackOpportunities() {
  return ROUTES.map((route, index) => {
    const grossEdgePct = randomBetween(-0.18, 0.55);
    const feeUsd = randomBetween(0.02, 0.18);
    const grossProfitUsd = route.sizeUsd * (grossEdgePct / 100);
    const netProfitUsd = grossProfitUsd - feeUsd;
    const risk = netProfitUsd > 0.6 ? 'low' : netProfitUsd > 0.1 ? 'medium' : 'high';

    return {
      id: route.id,
      chain: route.chain,
      type: 'paper_arbitrage',
      title: `${route.base}/${route.quote} loop monitor`,
      route: `${route.base} -> ${route.quote} -> ${route.base}`,
      status: netProfitUsd > 0 ? 'paper_positive' : 'not_profitable',
      expectedGrossUsd: Number(grossProfitUsd.toFixed(4)),
      estimatedFeesUsd: Number(feeUsd.toFixed(4)),
      expectedNetUsd: Number(netProfitUsd.toFixed(4)),
      confidence: index === 0 ? 62 : 48,
      risk,
      capitalUsd: route.sizeUsd,
      createdAt: nowIso(),
      notes: 'Fallback simulator data. Connect live quote sources and paper logs before enabling execution.',
    };
  });
}

export async function GET() {
  const live = [];
  const logs = [];

  try {
    for (const route of ROUTES) {
      const base = TOKENS[route.base];
      const quote = TOKENS[route.quote];
      if (!base || !quote) continue;

      const inputAmount = Math.floor((route.sizeUsd / 100) * 10 ** base.decimals);
      const first = await jupiterQuote(base.mint, quote.mint, inputAmount);
      const second = await jupiterQuote(quote.mint, base.mint, first.outAmount || 0);

      const finalBaseAmount = Number(second.outAmount || 0) / 10 ** base.decimals;
      const startBaseAmount = inputAmount / 10 ** base.decimals;
      const edgeBase = finalBaseAmount - startBaseAmount;
      const estimatedNetUsd = edgeBase * 100;
      const status = estimatedNetUsd > 0.25 ? 'paper_positive' : 'not_profitable';

      live.push({
        id: route.id,
        chain: 'solana',
        type: 'paper_arbitrage',
        title: `${route.base}/${route.quote} Jupiter loop`,
        route: `${route.base} -> ${route.quote} -> ${route.base}`,
        status,
        expectedGrossUsd: Number((estimatedNetUsd + 0.08).toFixed(4)),
        estimatedFeesUsd: 0.08,
        expectedNetUsd: Number(estimatedNetUsd.toFixed(4)),
        confidence: status === 'paper_positive' ? 74 : 42,
        risk: estimatedNetUsd > 1 ? 'low' : estimatedNetUsd > 0.25 ? 'medium' : 'high',
        capitalUsd: route.sizeUsd,
        createdAt: nowIso(),
        notes: 'Paper result from live Jupiter quotes. Not executed. Does not account for route staleness, priority fees, or failed transactions.',
      });
    }
  } catch (error) {
    logs.push(error instanceof Error ? error.message : 'Live scan failed.');
  }

  const opportunities = live.length ? live : fallbackOpportunities();

  return NextResponse.json({
    mode: live.length ? 'live_quotes_paper_mode' : 'fallback_paper_mode',
    generatedAt: nowIso(),
    summary: {
      total: opportunities.length,
      positive: opportunities.filter((item) => item.expectedNetUsd > 0).length,
      estimatedNetUsd: Number(opportunities.reduce((sum, item) => sum + Math.max(item.expectedNetUsd, 0), 0).toFixed(4)),
      executionEnabled: false,
    },
    opportunities,
    logs,
    safety: 'Ghost Alpha is in paper mode. It scans and scores opportunities but does not submit trades or manipulate user transactions.',
  });
}
