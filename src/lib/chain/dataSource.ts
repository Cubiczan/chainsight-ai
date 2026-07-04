/**
 * Three-tier on-chain data access for ChainSight AI.
 *
 * Mirrors the Cubiczan donor pattern (finance-cockpit / market-radar):
 *
 *   1. LIVE  — a Mantle RPC/indexer, attempted only when `MANTLE_RPC_URL` is a
 *              real (non-placeholder) URL and offline mode is off.
 *   2. CACHE — the local Prisma/SQLite database, when it has ingested rows.
 *   3. MOCK  — the embedded synthetic dataset (always available).
 *
 * `getDashboardData()` returns a payload shaped exactly like the existing
 * `/api/dashboard` response, tagged with `source` so the UI footer can show
 * provenance. With no credentials and no database, it transparently serves the
 * synthetic tier so the app always boots and the smoke test passes.
 */

import { isOffline, mantleRpcUrl, type DataTier } from "./config";
import { buildMockDashboard } from "./mockData";

export interface DashboardPayload {
  stats: {
    totalTransactions: number;
    totalAnomalies: number;
    criticalAlerts: number;
    unreadAlerts: number;
    monitoredAddresses: number;
  };
  anomalyByType: { type: string; count: number }[];
  anomalyBySeverity: { severity: string; count: number }[];
  dexVolume: Record<string, number>;
  recentAnomalies: unknown[];
  recentTransactions: unknown[];
  hourlyVolume: Record<string, unknown>[];
  source: DataTier;
}

/**
 * Tier 1: live ingestion from a Mantle RPC/indexer.
 *
 * Not wired to a real indexer in this offline-first build — returns `null` so
 * the layer falls through to cache/mock. A production deployment would replace
 * this with viem/ethers calls against `mantleRpcUrl()` and normalize the result
 * to `DashboardPayload`.
 */
async function fetchLive(): Promise<DashboardPayload | null> {
  const url = mantleRpcUrl();
  if (!url) return null;
  return null; // live ingestion intentionally not implemented in offline build
}

/**
 * Tier 2: read the local Prisma database if it has been seeded/ingested.
 *
 * The Prisma client is imported lazily so that when the DB is absent (offline,
 * fresh checkout) the import failure never crashes the caller — we just fall
 * through to the mock tier.
 */
async function fetchFromDb(): Promise<DashboardPayload | null> {
  try {
    const { db } = await import("@/lib/db");
    const totalTransactions = await db.onchainTransaction.count();
    if (totalTransactions === 0) return null; // empty DB => not a real cache hit

    const [totalAnomalies, criticalAlerts, unreadAlerts, monitoredAddresses] =
      await Promise.all([
        db.anomaly.count(),
        db.alert.count({ where: { severity: "critical" } }),
        db.alert.count({ where: { isRead: false } }),
        db.monitoredAddress.count(),
      ]);

    const anomalyByType = await db.anomaly.groupBy({
      by: ["type"],
      _count: { id: true },
    });
    const anomalyBySeverity = await db.anomaly.groupBy({
      by: ["severity"],
      _count: { id: true },
    });

    const txForVolume = await db.onchainTransaction.findMany({
      take: 200,
      select: { dex: true, usdValue: true },
    });
    const dexVolume: Record<string, number> = {};
    for (const tx of txForVolume) dexVolume[tx.dex] = (dexVolume[tx.dex] || 0) + tx.usdValue;

    const recentAnomalies = await db.anomaly.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
    });
    const recentTransactions = await db.onchainTransaction.findMany({
      take: 15,
      orderBy: { timestamp: "desc" },
    });

    return {
      stats: {
        totalTransactions,
        totalAnomalies,
        criticalAlerts,
        unreadAlerts,
        monitoredAddresses,
      },
      anomalyByType: anomalyByType.map((a) => ({ type: a.type, count: a._count.id })),
      anomalyBySeverity: anomalyBySeverity.map((a) => ({
        severity: a.severity,
        count: a._count.id,
      })),
      dexVolume,
      recentAnomalies,
      recentTransactions,
      hourlyVolume: [],
      source: "cache",
    };
  } catch {
    return null; // DB unavailable — fall through to mock
  }
}

/** Tier 3: embedded synthetic dataset, always available. */
function fetchMock(): DashboardPayload {
  return buildMockDashboard();
}

/**
 * Resolve the dashboard payload from the best available tier.
 *
 * @param opts.preferMock Force the synthetic tier (used by the smoke test).
 */
export async function getDashboardData(
  opts: { preferMock?: boolean } = {},
): Promise<DashboardPayload> {
  if (opts.preferMock) return fetchMock();

  if (!isOffline()) {
    const live = await fetchLive();
    if (live) return live;
  }

  const cached = await fetchFromDb();
  if (cached) return cached;

  return fetchMock();
}
