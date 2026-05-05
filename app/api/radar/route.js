import { NextResponse } from 'next/server';

const DEFAULT_WALLETS = [
  { label: 'Solana whale watch 1', address: '9xQeWvG816bUx9EPf6o6RkLz7jA1Yq9UKnmwMCPYqD8p', type: 'watchlist' },
  { label: 'Solana whale watch 2', address: 'HYPERfwdTjyJ2SCaKHmpF2MtrXqWxrsotYDsTrshHWq8', type: 'watchlist' },
  { label: 'Solana whale watch 3', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', type: 'watchlist' },
];

function nowIso() {
  return new Date().toISOString();
}

function round(value, decimals = 4) {
  return Number(Number(value || 0).toFixed(decimals));
}

function parseWatchlist() {
  const raw = process.env.SMART_WALLETS || '';
  if (!raw.trim()) return DEFAULT_WALLETS;

  return raw.split(',').map((item, index) => {
    const [label, address] = item.includes(':') ? item.split(':') : [`Wallet ${index + 1}`, item];
    return { label: label.trim(), address: address.trim(), type: 'env_watchlist' };
  }).filter((item) => item.address);
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, { ...options, cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return data;
}

async function fetchDexScreenerLatestProfiles() {
  try {
    const profiles = await jsonFetch('https://api.dexscreener.com/token-profiles/latest/v1');
    const solana = Array.isArray(profiles) ? profiles.filter((item) => item.chainId === 'solana') : [];
    return solana.slice(0, 30);
  } catch (error) {
    return [];
  }
}

async function fetchTokenPairs(tokenAddresses) {
  const addresses = [...new Set(tokenAddresses.filter(Boolean))].slice(0, 25);
  if (!addresses.length) return [];

  try {
    const data = await jsonFetch(`https://api.dexscreener.com/latest/dex/tokens/${addresses.join(',')}`);
    return Array.isArray(data?.pairs) ? data.pairs.filter((pair) => pair.chainId === 'solana') : [];
  } catch (error) {
    return [];
  }
}

function scorePair(pair) {
  const liquidityUsd = Number(pair?.liquidity?.usd || 0);
  const volume5m = Number(pair?.volume?.m5 || 0);
  const volume1h = Number(pair?.volume?.h1 || 0);
  const priceChange5m = Number(pair?.priceChange?.m5 || 0);
  const priceChange1h = Number(pair?.priceChange?.h1 || 0);
  const txns5m = Number(pair?.txns?.m5?.buys || 0) + Number(pair?.txns?.m5?.sells || 0);
  const txns1h = Number(pair?.txns?.h1?.buys || 0) + Number(pair?.txns?.h1?.sells || 0);

  const liquidityScore = Math.min(30, Math.log10(Math.max(liquidityUsd, 1)) * 7);
  const volumeScore = Math.min(25, Math.log10(Math.max(volume1h + volume5m, 1)) * 5);
  const txnScore = Math.min(20, Math.log10(Math.max(txns1h + txns5m, 1)) * 8);
  const momentumScore = Math.max(-20, Math.min(25, priceChange5m * 0.35 + priceChange1h * 0.12));
  const dangerPenalty = liquidityUsd < 5000 ? 25 : liquidityUsd < 15000 ? 12 : 0;

  return Math.round(Math.max(0, Math.min(100, liquidityScore + volumeScore + txnScore + momentumScore - dangerPenalty)));
}

function classifyRisk(pair) {
  const liquidityUsd = Number(pair?.liquidity?.usd || 0);
  const priceChange5m = Math.abs(Number(pair?.priceChange?.m5 || 0));
  if (liquidityUsd < 5000 || priceChange5m > 80) return 'high';
  if (liquidityUsd < 25000 || priceChange5m > 35) return 'medium';
  return 'low';
}

async function scanFreshTokens() {
  const profiles = await fetchDexScreenerLatestProfiles();
  const pairs = await fetchTokenPairs(profiles.map((item) => item.tokenAddress));

  const byToken = new Map();
  for (const pair of pairs) {
    const token = pair?.baseToken?.address || pair?.quoteToken?.address;
    if (!token) continue;
    const score = scorePair(pair);
    const existing = byToken.get(token);
    if (!existing || score > existing.score) byToken.set(token, { pair, score });
  }

  return [...byToken.values()].map(({ pair, score }) => ({
    id: `fresh-${pair.pairAddress}`,
    module: 'fresh_token_scanner',
    title: `${pair.baseToken?.symbol || 'TOKEN'} fresh liquidity signal`,
    token: pair.baseToken?.symbol || 'UNKNOWN',
    tokenName: pair.baseToken?.name || 'Unknown token',
    tokenAddress: pair.baseToken?.address,
    pairAddress: pair.pairAddress,
    dex: pair.dexId,
    url: pair.url,
    liquidityUsd: round(pair?.liquidity?.usd, 2),
    volume5mUsd: round(pair?.volume?.m5, 2),
    volume1hUsd: round(pair?.volume?.h1, 2),
    priceChange5mPct: round(pair?.priceChange?.m5, 2),
    priceChange1hPct: round(pair?.priceChange?.h1, 2),
    score,
    risk: classifyRisk(pair),
    status: score >= 70 ? 'strong_watch' : score >= 45 ? 'watch' : 'low_quality',
    notes: 'Fresh-token score uses live DEX Screener liquidity, volume, transaction activity, and momentum. It does not guarantee profit.',
  })).sort((a, b) => b.score - a.score).slice(0, 12);
}

async function scanWalletActivity() {
  const watchlist = parseWatchlist().slice(0, 12);
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const results = [];

  for (const wallet of watchlist) {
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'ghost-alpha',
          method: 'getSignaturesForAddress',
          params: [wallet.address, { limit: 10 }],
        }),
        cache: 'no-store',
      });
      const data = await res.json();
      const signatures = Array.isArray(data?.result) ? data.result : [];
      const now = Math.floor(Date.now() / 1000);
      const recent = signatures.filter((sig) => sig.blockTime && now - sig.blockTime < 3600);
      const last = signatures[0];
      const activityScore = Math.min(100, recent.length * 18 + signatures.length * 3);

      results.push({
        id: `wallet-${wallet.address}`,
        module: 'smart_wallet_tracker',
        title: `${wallet.label} activity`,
        wallet: wallet.address,
        walletType: wallet.type,
        recentTx1h: recent.length,
        lastSignature: last?.signature || null,
        lastSeenAt: last?.blockTime ? new Date(last.blockTime * 1000).toISOString() : null,
        score: activityScore,
        risk: activityScore > 70 ? 'medium' : 'low',
        status: recent.length >= 3 ? 'active_now' : signatures.length ? 'recently_active' : 'quiet',
        notes: 'Wallet tracker uses public Solana transaction activity. Add your own known profitable wallets in SMART_WALLETS for better alpha.',
      });
    } catch (error) {
      results.push({
        id: `wallet-${wallet.address}`,
        module: 'smart_wallet_tracker',
        title: `${wallet.label} activity`,
        wallet: wallet.address,
        recentTx1h: 0,
        score: 0,
        risk: 'unknown',
        status: 'scan_failed',
        notes: error instanceof Error ? error.message : 'Wallet scan failed.',
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

function buildWhaleBeforePumpSignals(wallets, freshTokens) {
  const activeWallets = wallets.filter((item) => item.recentTx1h > 0).length;
  const activeMultiplier = Math.min(25, activeWallets * 5);

  return freshTokens.slice(0, 10).map((token) => {
    const combinedScore = Math.min(100, Math.round(token.score * 0.72 + activeMultiplier));
    const status = combinedScore >= 78 ? 'possible_early_move' : combinedScore >= 55 ? 'watch_closely' : 'not_enough_signal';
    return {
      id: `pump-${token.pairAddress}`,
      module: 'whale_before_pump_detector',
      title: `${token.token} whale-before-pump radar`,
      token: token.token,
      tokenName: token.tokenName,
      tokenAddress: token.tokenAddress,
      pairAddress: token.pairAddress,
      url: token.url,
      liquidityUsd: token.liquidityUsd,
      volume1hUsd: token.volume1hUsd,
      priceChange5mPct: token.priceChange5mPct,
      smartWalletsActive1h: activeWallets,
      score: combinedScore,
      risk: token.risk === 'low' && combinedScore > 70 ? 'medium' : token.risk,
      status,
      notes: 'Combines fresh-token momentum with watched-wallet activity. This is legal public on-chain intelligence, not insider information.',
    };
  }).sort((a, b) => b.score - a.score);
}

export async function GET() {
  const logs = [];
  const [freshTokens, wallets] = await Promise.all([
    scanFreshTokens().catch((error) => {
      logs.push(error instanceof Error ? error.message : 'Fresh token scan failed');
      return [];
    }),
    scanWalletActivity().catch((error) => {
      logs.push(error instanceof Error ? error.message : 'Wallet activity scan failed');
      return [];
    }),
  ]);

  const pumpSignals = buildWhaleBeforePumpSignals(wallets, freshTokens);
  const allSignals = [...pumpSignals, ...freshTokens, ...wallets].sort((a, b) => (b.score || 0) - (a.score || 0));

  return NextResponse.json({
    generatedAt: nowIso(),
    mode: 'ghost_alpha_radar_live_public_data',
    summary: {
      smartWallets: wallets.length,
      activeWallets1h: wallets.filter((item) => item.recentTx1h > 0).length,
      freshTokens: freshTokens.length,
      pumpSignals: pumpSignals.length,
      strongestScore: allSignals[0]?.score || 0,
    },
    modules: {
      smart_wallet_tracker: wallets,
      fresh_token_scanner: freshTokens,
      whale_before_pump_detector: pumpSignals,
    },
    signals: allSignals.slice(0, 30),
    logs,
    safety: 'Radar uses public blockchain and market data only. It does not use private insider information and does not execute trades.',
  });
}
