import { NextResponse } from 'next/server';

const TOKENS = {
  SOL: { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL', decimals: 9, usd: 100 },
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qnc1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', decimals: 6, usd: 1 },
  USDT: { mint: 'Es9vMFrzaCERmJfrF4H2FYD4Yy5oLFRV3NzzBK9mzq6G', symbol: 'USDT', decimals: 6, usd: 1 },
  JUP: { mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', symbol: 'JUP', decimals: 6, usd: 0.8 },
  BONK: { mint: 'DezXAZ8z7PnrnRJjz3WhHGpPB2633p6C3oCc6AynXnP', symbol: 'BONK', decimals: 5, usd: 0.00002 },
  PYUSD: { mint: '2b1kV6D3UNqWZaLSqWQ9GzSPrge8KaU3R89zcgjA1jXJ', symbol: 'PYUSD', decimals: 6, usd: 1 },
};

const SOLANA_ROUTES = [
  { id: 'sol-usdc-loop', base: 'SOL', quote: 'USDC', sizeUsd: 250 },
  { id: 'sol-usdt-loop', base: 'SOL', quote: 'USDT', sizeUsd: 250 },
  { id: 'usdc-sol-usdt-loop', base: 'USDC', quote: 'SOL', sizeUsd: 500, final: 'USDT' },
  { id: 'jup-usdc-loop', base: 'JUP', quote: 'USDC', sizeUsd: 200 },
  { id: 'bonk-usdc-loop', base: 'BONK', quote: 'USDC', sizeUsd: 150 },
];

const STABLE_ROUTES = [
  { id: 'usdc-usdt-stable', base: 'USDC', quote: 'USDT', sizeUsd: 1000 },
  { id: 'usdc-pyusd-stable', base: 'USDC', quote: 'PYUSD', sizeUsd: 750 },
  { id: 'usdt-pyusd-stable', base: 'USDT', quote: 'PYUSD', sizeUsd: 750 },
];

const FLASH_TEMPLATES = [
  { id: 'eth-usdc-weth', chain: 'ethereum', venueA: 'Uniswap V3', venueB: 'SushiSwap', pair: 'WETH/USDC', capitalUsd: 5000, borrowAsset: 'USDC' },
  { id: 'base-usdc-weth', chain: 'base', venueA: 'Aerodrome', venueB: 'Uniswap V3', pair: 'WETH/USDC', capitalUsd: 2500, borrowAsset: 'USDC' },
  { id: 'arbitrum-usdc-weth', chain: 'arbitrum', venueA: 'Camelot', venueB: 'Uniswap V3', pair: 'WETH/USDC', capitalUsd: 3000, borrowAsset: 'USDC' },
  { id: 'polygon-usdc-wmatic', chain: 'polygon', venueA: 'QuickSwap', venueB: 'Uniswap V3', pair: 'WMATIC/USDC', capitalUsd: 1500, borrowAsset: 'USDC' },
];

function nowIso() {
  return new Date().toISOString();
}

function round(value, decimals = 4) {
  return Number(Number(value || 0).toFixed(decimals));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function riskFromNet(netUsd) {
  if (netUsd > 1) return 'low';
  if (netUsd > 0.15) return 'medium';
  return 'high';
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

async function scanJupiterLoop(route, category) {
  const base = TOKENS[route.base];
  const quote = TOKENS[route.quote];
  const final = TOKENS[route.final || route.base];
  if (!base || !quote || !final) throw new Error(`Missing token config for ${route.id}`);

  const inputAmount = Math.max(1, Math.floor((route.sizeUsd / base.usd) * 10 ** base.decimals));
  const first = await jupiterQuote(base.mint, quote.mint, inputAmount);
  const second = await jupiterQuote(quote.mint, final.mint, first.outAmount || 0);

  const startUsd = (inputAmount / 10 ** base.decimals) * base.usd;
  const finalUsd = (Number(second.outAmount || 0) / 10 ** final.decimals) * final.usd;
  const estimatedFeesUsd = category === 'stablecoin_arbitrage' ? 0.05 : 0.08;
  const gross = finalUsd - startUsd;
  const net = gross - estimatedFeesUsd;

  return {
    id: route.id,
    chain: 'solana',
    type: category,
    title: category === 'stablecoin_arbitrage' ? `${route.base}/${route.quote} stablecoin loop` : `${route.base}/${route.quote} Jupiter loop`,
    route: `${route.base} -> ${route.quote} -> ${route.final || route.base}`,
    status: net > 0 ? 'paper_positive' : 'not_profitable',
    expectedGrossUsd: round(gross),
    estimatedFeesUsd: round(estimatedFeesUsd),
    expectedNetUsd: round(net),
    confidence: net > 1 ? 78 : net > 0.15 ? 61 : 36,
    risk: riskFromNet(net),
    capitalUsd: route.sizeUsd,
    createdAt: nowIso(),
    notes: 'Paper result from live Jupiter quotes. Not executed. Must survive route staleness, priority fees, slippage, and failed transaction checks before execution.',
  };
}

function fallbackRoute(route, category) {
  const edgePct = category === 'stablecoin_arbitrage' ? randomBetween(-0.04, 0.08) : randomBetween(-0.2, 0.42);
  const feeUsd = category === 'stablecoin_arbitrage' ? randomBetween(0.02, 0.08) : randomBetween(0.04, 0.22);
  const gross = route.sizeUsd * (edgePct / 100);
  const net = gross - feeUsd;

  return {
    id: route.id,
    chain: 'solana',
    type: category,
    title: category === 'stablecoin_arbitrage' ? `${route.base}/${route.quote} stablecoin monitor` : `${route.base}/${route.quote} route monitor`,
    route: `${route.base} -> ${route.quote} -> ${route.final || route.base}`,
    status: net > 0 ? 'paper_positive' : 'not_profitable',
    expectedGrossUsd: round(gross),
    estimatedFeesUsd: round(feeUsd),
    expectedNetUsd: round(net),
    confidence: net > 0 ? 48 : 24,
    risk: riskFromNet(net),
    capitalUsd: route.sizeUsd,
    createdAt: nowIso(),
    notes: 'Fallback paper simulator. Live quote source was unavailable or rate-limited.',
  };
}

async function scanSolanaRoutes(logs) {
  const results = [];
  for (const route of SOLANA_ROUTES) {
    try {
      results.push(await scanJupiterLoop(route, 'solana_route_arbitrage'));
    } catch (error) {
      logs.push(`[solana] ${route.id}: ${error instanceof Error ? error.message : 'failed'}`);
      results.push(fallbackRoute(route, 'solana_route_arbitrage'));
    }
  }
  return results;
}

async function scanStablecoins(logs) {
  const results = [];
  for (const route of STABLE_ROUTES) {
    try {
      results.push(await scanJupiterLoop(route, 'stablecoin_arbitrage'));
    } catch (error) {
      logs.push(`[stablecoin] ${route.id}: ${error instanceof Error ? error.message : 'failed'}`);
      results.push(fallbackRoute(route, 'stablecoin_arbitrage'));
    }
  }
  return results;
}

async function scanFundingRates(logs) {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Hyperliquid failed: ${res.status}`);
    const data = await res.json();
    const meta = data?.[0]?.universe || [];
    const ctxs = data?.[1] || [];

    return ctxs.map((ctx, index) => {
      const coin = meta[index]?.name || `ASSET-${index}`;
      const hourlyFunding = Number(ctx.funding || 0);
      const annualizedPct = hourlyFunding * 24 * 365 * 100;
      const absAnnualized = Math.abs(annualizedPct);
      const capitalUsd = 1000;
      const expectedDailyUsd = capitalUsd * (Math.abs(hourlyFunding) * 24);
      const net = expectedDailyUsd - 0.35;
      const direction = hourlyFunding > 0 ? 'short perp + hold spot' : 'long perp + short/hedge spot';

      return {
        id: `funding-${coin.toLowerCase()}`,
        chain: 'hyperliquid',
        type: 'funding_rate_arbitrage',
        title: `${coin} funding monitor`,
        route: direction,
        status: net > 0.25 && absAnnualized > 12 ? 'paper_positive' : 'watch_only',
        expectedGrossUsd: round(expectedDailyUsd),
        estimatedFeesUsd: 0.35,
        expectedNetUsd: round(net),
        confidence: absAnnualized > 50 ? 78 : absAnnualized > 15 ? 62 : 38,
        risk: absAnnualized > 80 ? 'high' : absAnnualized > 20 ? 'medium' : 'low',
        capitalUsd,
        annualizedFundingPct: round(annualizedPct, 2),
        createdAt: nowIso(),
        notes: `Hourly funding ${round(hourlyFunding * 100, 5)}%. Paper model only; execution requires delta-neutral spot/perp handling and exchange account setup.`,
      };
    }).sort((a, b) => Math.abs(b.annualizedFundingPct) - Math.abs(a.annualizedFundingPct)).slice(0, 8);
  } catch (error) {
    logs.push(`[funding] ${error instanceof Error ? error.message : 'failed'}`);
    return ['BTC', 'ETH', 'SOL', 'HYPE'].map((coin, index) => {
      const annualized = [28, -18, 54, -9][index];
      const gross = Math.abs(annualized) / 3650 * 1000;
      const net = gross - 0.35;
      return {
        id: `funding-${coin.toLowerCase()}`,
        chain: 'hyperliquid',
        type: 'funding_rate_arbitrage',
        title: `${coin} funding monitor`,
        route: annualized > 0 ? 'short perp + hold spot' : 'long perp + hedge spot',
        status: net > 0.25 ? 'paper_positive' : 'watch_only',
        expectedGrossUsd: round(gross),
        estimatedFeesUsd: 0.35,
        expectedNetUsd: round(net),
        confidence: 42,
        risk: Math.abs(annualized) > 40 ? 'high' : 'medium',
        capitalUsd: 1000,
        annualizedFundingPct: annualized,
        createdAt: nowIso(),
        notes: 'Fallback funding model. Live funding source unavailable.',
      };
    });
  }
}

function scanEvmFlashLoanTemplates() {
  return FLASH_TEMPLATES.map((item, index) => {
    const spreadPct = randomBetween(-0.08, 0.22);
    const flashFeePct = 0.09;
    const gasUsd = randomBetween(1.5, 9);
    const gross = item.capitalUsd * (spreadPct / 100);
    const flashFee = item.capitalUsd * (flashFeePct / 100);
    const net = gross - flashFee - gasUsd;

    return {
      id: `flash-${item.id}`,
      chain: item.chain,
      type: 'evm_flashloan_template',
      title: `${item.chain} ${item.pair} flash-loan template`,
      route: `${item.venueA} -> ${item.venueB} using ${item.borrowAsset}`,
      status: net > 5 ? 'paper_positive' : 'not_profitable',
      expectedGrossUsd: round(gross),
      estimatedFeesUsd: round(flashFee + gasUsd),
      expectedNetUsd: round(net),
      confidence: net > 10 ? 58 : 26,
      risk: net > 15 ? 'medium' : 'high',
      capitalUsd: item.capitalUsd,
      createdAt: nowIso(),
      notes: 'Template scanner only. No contract deployment or execution. Real flash-loan execution requires protocol-specific contracts, simulations, gas modeling, and revert-safe tests.',
    };
  });
}

export async function GET() {
  const logs = [];
  const [solanaRoutes, stablecoins, fundingRates] = await Promise.all([
    scanSolanaRoutes(logs),
    scanStablecoins(logs),
    scanFundingRates(logs),
  ]);
  const evmFlashLoans = scanEvmFlashLoanTemplates();

  const opportunities = [...fundingRates, ...solanaRoutes, ...stablecoins, ...evmFlashLoans]
    .sort((a, b) => Math.max(b.expectedNetUsd, 0) - Math.max(a.expectedNetUsd, 0));

  const moduleSummary = {
    funding_rate_arbitrage: fundingRates.length,
    solana_route_arbitrage: solanaRoutes.length,
    stablecoin_arbitrage: stablecoins.length,
    evm_flashloan_template: evmFlashLoans.length,
  };

  return NextResponse.json({
    mode: 'multi_module_paper_mode',
    generatedAt: nowIso(),
    modules: moduleSummary,
    summary: {
      total: opportunities.length,
      positive: opportunities.filter((item) => item.expectedNetUsd > 0).length,
      estimatedNetUsd: round(opportunities.reduce((sum, item) => sum + Math.max(item.expectedNetUsd, 0), 0)),
      executionEnabled: false,
    },
    opportunities,
    logs,
    safety: 'Ghost Alpha is in paper mode. It scans funding rates, Solana routes, stablecoin routes, and EVM flash-loan templates, but does not submit trades or manipulate user transactions.',
  });
}
