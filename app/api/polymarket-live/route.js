import { NextResponse } from 'next/server';

const GAMMA = 'https://gamma-api.polymarket.com';
const CLOB = 'https://clob.polymarket.com';
const BINANCE = 'https://api.binance.com';

function round(value, decimals = 4) {
  return Number(Number(value || 0).toFixed(decimals));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { ...options, cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return data;
}

function safeJson(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function textOf(market) {
  return [market.question, market.title, market.slug, market.description, market.event?.title, market.event?.slug]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function detectWindow(market) {
  const text = textOf(market);
  if (text.includes('15m') || text.includes('15 m') || text.includes('15 minute') || text.includes('15-minute')) return '15m';
  if (text.includes('hour') || text.includes('1h') || text.includes('1 h') || text.includes('hourly')) return '1h';
  return null;
}

function isBtcUpDownMarket(market) {
  const text = textOf(market);
  const isBtc = text.includes('bitcoin') || text.includes('btc');
  const isDirection = text.includes('up') && text.includes('down');
  const window = detectWindow(market);
  return isBtc && isDirection && Boolean(window);
}

async function fetchMarkets() {
  const pages = [0, 100, 200];
  const all = [];

  for (const offset of pages) {
    const url = `${GAMMA}/markets?active=true&closed=false&order=volume_24hr&ascending=false&limit=100&offset=${offset}`;
    const markets = await fetchJson(url).catch(() => []);
    if (Array.isArray(markets)) all.push(...markets);
  }

  return all.filter(isBtcUpDownMarket).slice(0, 20);
}

async function fetchOrderBook(tokenId) {
  if (!tokenId) return null;
  try {
    return await fetchJson(`${CLOB}/book?token_id=${encodeURIComponent(tokenId)}`);
  } catch {
    return null;
  }
}

function summarizeBook(book) {
  const bids = Array.isArray(book?.bids) ? book.bids : [];
  const asks = Array.isArray(book?.asks) ? book.asks : [];
  const bestBid = bids.length ? Math.max(...bids.map((item) => Number(item.price || 0))) : 0;
  const bestAsk = asks.length ? Math.min(...asks.map((item) => Number(item.price || 0)).filter(Boolean)) : 0;
  const askSize = asks.reduce((sum, item) => sum + Number(item.size || 0), 0);
  const bidSize = bids.reduce((sum, item) => sum + Number(item.size || 0), 0);
  const spread = bestAsk && bestBid ? bestAsk - bestBid : null;
  return { bestBid, bestAsk, spread, askSize, bidSize };
}

async function fetchBtcContext(interval) {
  const binanceInterval = interval === '15m' ? '15m' : '1h';
  const data = await fetchJson(`${BINANCE}/api/v3/klines?symbol=BTCUSDT&interval=${binanceInterval}&limit=40`);
  const latest = data[data.length - 1];
  const prev = data.slice(-20);
  const open = Number(latest[1]);
  const high = Number(latest[2]);
  const low = Number(latest[3]);
  const close = Number(latest[4]);
  const openTime = latest[0];
  const closeTime = latest[6];
  const now = Date.now();
  const timeLeftMs = Math.max(0, closeTime - now);
  const totalMs = closeTime - openTime;
  const timeLeftPct = totalMs ? timeLeftMs / totalMs : 0;
  const distancePct = open ? ((close - open) / open) * 100 : 0;
  const ranges = prev.map((item) => Math.abs((Number(item[4]) - Number(item[1])) / Number(item[1])) * 100);
  const avgAbsMovePct = ranges.reduce((sum, value) => sum + value, 0) / Math.max(ranges.length, 1);
  const volatilityPct = Math.max(avgAbsMovePct, 0.03);

  return {
    source: 'binance_proxy',
    interval,
    open,
    current: close,
    high,
    low,
    openTime: new Date(openTime).toISOString(),
    closeTime: new Date(closeTime).toISOString(),
    secondsLeft: Math.floor(timeLeftMs / 1000),
    timeLeftPct: round(timeLeftPct, 4),
    distancePct: round(distancePct, 4),
    volatilityPct: round(volatilityPct, 4),
  };
}

function normalCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (x > 0) prob = 1 - prob;
  return prob;
}

function fairProbabilityUp(ctx) {
  const timeScale = Math.sqrt(Math.max(ctx.timeLeftPct, 0.02));
  const sigma = Math.max(ctx.volatilityPct * timeScale, 0.02);
  const z = ctx.distancePct / sigma;
  return clamp(normalCdf(z), 0.02, 0.98);
}

function scoreSignal({ edge, spread, liquidityUsd, ctx, marketPrice }) {
  const edgeScore = clamp(edge * 500, 0, 40);
  const spreadScore = spread == null ? 0 : clamp((0.06 - spread) * 400, 0, 20);
  const liqScore = clamp(Math.log10(Math.max(liquidityUsd, 1)) * 5, 0, 20);
  const timeScore = ctx.interval === '15m'
    ? clamp((ctx.secondsLeft > 60 && ctx.secondsLeft < 300) ? 20 : 10, 0, 20)
    : clamp((ctx.secondsLeft > 240 && ctx.secondsLeft < 1200) ? 20 : 12, 0, 20);
  const pricePenalty = marketPrice > 0.92 || marketPrice < 0.08 ? 10 : 0;
  return Math.round(clamp(edgeScore + spreadScore + liqScore + timeScore - pricePenalty, 0, 100));
}

function decisionForMarket({ upAsk, downAsk, upSpread, downSpread, upLiquidity, downLiquidity, ctx }) {
  const fairUp = fairProbabilityUp(ctx);
  const fairDown = 1 - fairUp;
  const upEdge = upAsk ? fairUp - upAsk : -1;
  const downEdge = downAsk ? fairDown - downAsk : -1;
  const side = upEdge >= downEdge ? 'UP' : 'DOWN';
  const edge = Math.max(upEdge, downEdge);
  const marketPrice = side === 'UP' ? upAsk : downAsk;
  const spread = side === 'UP' ? upSpread : downSpread;
  const liquidity = side === 'UP' ? upLiquidity : downLiquidity;
  const minEdge = ctx.interval === '15m' ? 0.07 : 0.05;
  const maxSpread = ctx.interval === '15m' ? 0.035 : 0.045;
  const timeOk = ctx.interval === '15m'
    ? ctx.secondsLeft >= 60 && ctx.secondsLeft <= 300
    : ctx.secondsLeft >= 240 && ctx.secondsLeft <= 1200;
  const score = scoreSignal({ edge, spread, liquidityUsd: liquidity, ctx, marketPrice });

  const allowed = edge >= minEdge && (spread == null || spread <= maxSpread) && liquidity >= 20 && timeOk && score >= (ctx.interval === '15m' ? 82 : 76);

  return {
    action: allowed ? `PAPER_BUY_${side}` : 'SKIP',
    side,
    fairUp: round(fairUp, 4),
    fairDown: round(fairDown, 4),
    marketPrice: round(marketPrice, 4),
    edge: round(edge, 4),
    spread: spread == null ? null : round(spread, 4),
    liquidityUsd: round(liquidity, 2),
    score,
    reason: allowed ? 'Edge, spread, liquidity, time window, and score passed.' : 'One or more filters failed: edge, spread, liquidity, time window, or score.',
  };
}

function tokenIds(market) {
  const ids = safeJson(market.clobTokenIds, []);
  const outcomes = safeJson(market.outcomes, []);
  const upIndex = outcomes.findIndex((item) => String(item).toLowerCase().includes('up') || String(item).toLowerCase().includes('yes'));
  const downIndex = outcomes.findIndex((item) => String(item).toLowerCase().includes('down') || String(item).toLowerCase().includes('no'));
  return {
    up: ids[upIndex >= 0 ? upIndex : 0],
    down: ids[downIndex >= 0 ? downIndex : 1],
    outcomes,
    ids,
  };
}

export async function GET() {
  const logs = [];
  const markets = await fetchMarkets().catch((error) => {
    logs.push(error instanceof Error ? error.message : 'Market scan failed');
    return [];
  });

  const contexts = {
    '15m': await fetchBtcContext('15m').catch((error) => {
      logs.push(error instanceof Error ? error.message : '15m BTC context failed');
      return null;
    }),
    '1h': await fetchBtcContext('1h').catch((error) => {
      logs.push(error instanceof Error ? error.message : '1h BTC context failed');
      return null;
    }),
  };

  const signals = [];

  for (const market of markets) {
    const interval = detectWindow(market);
    const ctx = contexts[interval];
    if (!ctx) continue;

    const ids = tokenIds(market);
    const [upBook, downBook] = await Promise.all([
      fetchOrderBook(ids.up),
      fetchOrderBook(ids.down),
    ]);

    const up = summarizeBook(upBook);
    const down = summarizeBook(downBook);
    const decision = decisionForMarket({
      upAsk: up.bestAsk,
      downAsk: down.bestAsk,
      upSpread: up.spread,
      downSpread: down.spread,
      upLiquidity: up.askSize,
      downLiquidity: down.askSize,
      ctx,
    });

    signals.push({
      id: String(market.id || market.conditionId || market.slug),
      question: market.question || market.title || 'BTC Up/Down market',
      slug: market.slug,
      url: market.slug ? `https://polymarket.com/event/${market.slug}` : null,
      interval,
      marketVolume: round(market.volume || market.volumeNum || market.volume24hr || 0, 2),
      marketLiquidity: round(market.liquidity || market.liquidityNum || 0, 2),
      tokens: ids,
      orderbook: {
        up: { bestBid: round(up.bestBid), bestAsk: round(up.bestAsk), spread: up.spread == null ? null : round(up.spread), askSize: round(up.askSize, 2) },
        down: { bestBid: round(down.bestBid), bestAsk: round(down.bestAsk), spread: down.spread == null ? null : round(down.spread), askSize: round(down.askSize, 2) },
      },
      btc: ctx,
      decision,
      safety: 'Paper signal only. No order placed.',
    });
  }

  const ranked = signals.sort((a, b) => b.decision.score - a.decision.score);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    mode: 'polymarket_btc_live_collector_v1',
    sourceNotes: [
      'Polymarket markets/orderbooks are public read endpoints.',
      'BTC candle context uses Binance as a proxy in this v1 collector. Exact oracle-source tracking is the next accuracy upgrade.',
      'Signals are paper-only and do not place real orders.',
    ],
    summary: {
      marketsFound: markets.length,
      signalsBuilt: ranked.length,
      paperBuys: ranked.filter((item) => item.decision.action !== 'SKIP').length,
      bestScore: ranked[0]?.decision?.score || 0,
    },
    contexts,
    signals: ranked,
    logs,
  });
}
