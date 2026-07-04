/**
 * Embedded synthetic on-chain dataset for ChainSight AI (the MOCK tier).
 *
 * Generates deterministic Mantle-Network-shaped transactions, anomalies, alerts,
 * and a dashboard aggregate so the app is fully populated with ZERO credentials
 * and ZERO database. Deterministic (seeded PRNG) so the smoke test is stable.
 *
 * Shapes mirror the Prisma models (see prisma/schema.prisma) and the
 * `DashboardData` interface consumed by src/app/page.tsx.
 */

const MANTLE_ADDRESSES = [
  "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
  "0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B",
  "0x1111111254EEB25477B68fb85Ed929f73A960582",
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
];

const WHALE_ADDRESSES = [
  "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD",
  "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8",
];

const TOKENS = ["MNT", "USDC", "USDT", "WETH", "WBTC", "mETH", "USDY"];
const DEXS = ["merchant_moe", "agni_finance", "fluxion"];
const TX_TYPES = ["swap", "transfer", "flash_loan", "liquidity", "bridge"];
const ANOMALY_TYPES = [
  "flash_loan",
  "sandwich_attack",
  "whale_accumulation",
  "wash_trading",
  "unusual_volume",
  "mev_extraction",
];
const SEVERITIES = ["low", "medium", "high", "critical"];

/** Deterministic mulberry32 PRNG so mock output is stable across runs. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MockTransaction {
  id: string;
  txHash: string;
  blockNumber: number;
  fromAddress: string;
  toAddress: string;
  token: string;
  amount: number;
  usdValue: number;
  dex: string;
  txType: string;
  gasUsed: number;
  timestamp: string;
  createdAt: string;
}

export interface MockAnomaly {
  id: string;
  txId: string;
  txHash: string;
  type: string;
  severity: string;
  confidence: number;
  description: string;
  metadata: string;
  isAnalyzed: boolean;
  analyzedAt: string | null;
  createdAt: string;
  analysis: null;
}

export interface MockAlert {
  id: string;
  anomalyId: string | null;
  title: string;
  message: string;
  severity: string;
  channel: string;
  isRead: boolean;
  createdAt: string;
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function between(rng: () => number, min: number, max: number): number {
  return rng() * (max - min) + min;
}

function hexHash(rng: () => number, len: number): string {
  let s = "0x";
  for (let i = 0; i < len; i++) s += Math.floor(rng() * 16).toString(16);
  return s;
}

export interface MockDataset {
  transactions: MockTransaction[];
  anomalies: MockAnomaly[];
  alerts: MockAlert[];
  monitoredAddressCount: number;
}

/** Build the full synthetic dataset. Seed defaults keep output deterministic. */
export function buildMockDataset(seed = 42): MockDataset {
  const rng = makeRng(seed);
  const now = Date.now();

  const transactions: MockTransaction[] = [];
  for (let i = 0; i < 60; i++) {
    const ts = new Date(now - between(rng, 0, 72 * 3600 * 1000));
    const token = pick(rng, TOKENS);
    const amount = between(rng, 0.1, 5000);
    const usdValue =
      token === "WBTC" ? amount * 65000 : token === "WETH" ? amount * 3500 : amount;
    transactions.push({
      id: `tx_${i}`,
      txHash: hexHash(rng, 64),
      blockNumber: Math.floor(now / 1000) - Math.floor(between(rng, 0, 50000)),
      fromAddress: rng() > 0.3 ? pick(rng, WHALE_ADDRESSES) : hexHash(rng, 40),
      toAddress: pick(rng, MANTLE_ADDRESSES),
      token,
      amount: Math.round(amount * 1000) / 1000,
      usdValue: Math.round(usdValue * 100) / 100,
      dex: pick(rng, DEXS),
      txType: pick(rng, TX_TYPES),
      gasUsed: Math.round(between(rng, 21000, 500000)),
      timestamp: ts.toISOString(),
      createdAt: ts.toISOString(),
    });
  }

  const anomalies: MockAnomaly[] = [];
  const alerts: MockAlert[] = [];
  for (let i = 0; i < 18; i++) {
    const tx = pick(rng, transactions);
    const type = pick(rng, ANOMALY_TYPES);
    const severity = pick(rng, SEVERITIES);
    const created = new Date(now - between(rng, 0, 48 * 3600 * 1000)).toISOString();
    const description = `Synthetic ${type.replace(/_/g, " ")} pattern on ${tx.dex} involving ${tx.amount.toLocaleString()} ${tx.token} ($${tx.usdValue.toLocaleString()}). Offline mock data.`;
    const id = `an_${i}`;
    anomalies.push({
      id,
      txId: tx.id,
      txHash: tx.txHash,
      type,
      severity,
      confidence: Math.round(between(rng, 0.6, 0.99) * 100) / 100,
      description,
      metadata: JSON.stringify({ dex: tx.dex, token: tx.token, usdValue: tx.usdValue }),
      isAnalyzed: false,
      analyzedAt: null,
      createdAt: created,
      analysis: null,
    });
    alerts.push({
      id: `al_${i}`,
      anomalyId: id,
      title: `${severity.toUpperCase()}: ${type.replace(/_/g, " ")} detected`,
      message: description.slice(0, 120),
      severity,
      channel: "dashboard",
      isRead: rng() > 0.5,
      createdAt: created,
    });
  }

  return {
    transactions,
    anomalies,
    alerts,
    monitoredAddressCount: WHALE_ADDRESSES.length,
  };
}

/** Aggregate the synthetic dataset into the dashboard payload page.tsx expects. */
export function buildMockDashboard(seed = 42) {
  const ds = buildMockDataset(seed);

  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const a of ds.anomalies) {
    byType[a.type] = (byType[a.type] || 0) + 1;
    bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
  }

  const dexVolume: Record<string, number> = {};
  for (const tx of ds.transactions) {
    dexVolume[tx.dex] = (dexVolume[tx.dex] || 0) + tx.usdValue;
  }

  const recentTransactions = [...ds.transactions]
    .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
    .slice(0, 15);
  const recentAnomalies = [...ds.anomalies]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 10);

  return {
    stats: {
      totalTransactions: ds.transactions.length,
      totalAnomalies: ds.anomalies.length,
      criticalAlerts: ds.alerts.filter((a) => a.severity === "critical").length,
      unreadAlerts: ds.alerts.filter((a) => !a.isRead).length,
      monitoredAddresses: ds.monitoredAddressCount,
    },
    anomalyByType: Object.entries(byType).map(([type, count]) => ({ type, count })),
    anomalyBySeverity: Object.entries(bySeverity).map(([severity, count]) => ({
      severity,
      count,
    })),
    dexVolume,
    recentAnomalies,
    recentTransactions,
    hourlyVolume: [] as Record<string, unknown>[],
    source: "mock" as const,
  };
}

/** Deterministic synthetic AI analysis for an anomaly (offline LLM tier). */
export function buildMockAnalysis(anomaly: {
  id?: string;
  type: string;
  severity: string;
  confidence: number;
  description?: string;
}) {
  const recs: Record<string, string> = {
    low: "Monitor this address for further activity. No immediate action required.",
    medium: "Add this address to your watchlist; the pattern may escalate.",
    high: "Set price alerts and monitor related tokens — this could signal a larger move.",
    critical:
      "Immediate attention required. Pattern is consistent with exploitative behavior; consider reducing exposure to affected pools.",
  };
  const riskLevel = anomaly.severity;
  return {
    id: `mock_analysis_${anomaly.id ?? anomaly.type}`,
    anomalyId: anomaly.id ?? "",
    summary: `Synthetic analysis of a ${anomaly.type.replace(/_/g, " ")} event (confidence ${(anomaly.confidence * 100).toFixed(0)}%). Generated offline without a live LLM.`,
    riskLevel,
    recommendation: recs[riskLevel] ?? recs.medium,
    rawResponse: JSON.stringify({ model: "chainsight-mock-v1", source: "mock" }),
    createdAt: new Date().toISOString(),
    source: "mock" as const,
  };
}
