export function nowIso() {
  return new Date().toISOString();
}

export function number(value, decimals = 4) {
  return Number(Number(value || 0).toFixed(decimals));
}

export function money(value, decimals = 4) {
  return Number(Number(value || 0).toFixed(decimals));
}

export function riskFromNet(netUsd) {
  if (netUsd > 1) return 'low';
  if (netUsd > 0.15) return 'medium';
  return 'high';
}

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
