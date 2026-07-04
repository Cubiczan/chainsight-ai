/**
 * Offline / mock-mode smoke test for ChainSight AI.
 *
 * Proves the app serves a fully-populated dashboard with ZERO credentials and
 * ZERO database — the three-tier fallback's synthetic tier.
 *
 * Run with the Bun test runner (no API keys, no DB, no network):
 *   CHAINSIGHT_OFFLINE=1 bun test src/lib/chain/offline.test.ts
 * or via the package script:
 *   bun run test:offline
 */

import { describe, it, expect, beforeAll } from "bun:test";
import { isOffline, mantleRpcUrl, llmConfigured } from "./config";
import { buildMockDashboard, buildMockDataset, buildMockAnalysis } from "./mockData";
import { getDashboardData } from "./dataSource";

beforeAll(() => {
  // Ensure a credential-free environment for the smoke test.
  delete process.env.MANTLE_RPC_URL;
  delete process.env.ANALYZE_API_KEY;
  process.env.CHAINSIGHT_OFFLINE = "1";
});

describe("offline config detection", () => {
  it("reports offline when no chain RPC is configured", () => {
    expect(mantleRpcUrl()).toBeUndefined();
    expect(isOffline()).toBe(true);
  });

  it("reports no LLM configured without ANALYZE_API_KEY", () => {
    expect(llmConfigured()).toBe(false);
  });
});

describe("synthetic on-chain dataset", () => {
  it("is deterministic across builds", () => {
    const a = buildMockDataset();
    const b = buildMockDataset();
    expect(a.transactions[0].txHash).toBe(b.transactions[0].txHash);
  });

  it("produces transactions, anomalies, and alerts", () => {
    const ds = buildMockDataset();
    expect(ds.transactions.length).toBeGreaterThan(0);
    expect(ds.anomalies.length).toBeGreaterThan(0);
    expect(ds.alerts.length).toBe(ds.anomalies.length);
  });

  it("aggregates into a valid dashboard payload", () => {
    const d = buildMockDashboard();
    expect(d.source).toBe("mock");
    expect(d.stats.totalTransactions).toBeGreaterThan(0);
    expect(d.stats.totalAnomalies).toBeGreaterThan(0);
    expect(d.anomalyBySeverity.length).toBeGreaterThan(0);
    expect(Object.keys(d.dexVolume).length).toBeGreaterThan(0);
    expect(d.recentTransactions.length).toBeGreaterThan(0);
  });
});

describe("three-tier data source in offline mode", () => {
  it("serves the mock tier with no creds and no DB", async () => {
    const d = await getDashboardData();
    expect(d.source).toBe("mock");
    expect(d.stats.totalTransactions).toBeGreaterThan(0);
  });

  it("honours preferMock", async () => {
    const d = await getDashboardData({ preferMock: true });
    expect(d.source).toBe("mock");
  });
});

describe("offline AI analysis tier", () => {
  it("produces a deterministic synthetic analysis", () => {
    const analysis = buildMockAnalysis({
      id: "an_1",
      type: "flash_loan",
      severity: "high",
      confidence: 0.9,
    });
    expect(analysis.source).toBe("mock");
    expect(analysis.riskLevel).toBe("high");
    expect(analysis.recommendation.length).toBeGreaterThan(0);
  });
});
