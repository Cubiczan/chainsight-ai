/**
 * Offline / mock-mode configuration for ChainSight AI.
 *
 * ChainSight needs two kinds of live credentials:
 *   1. A Mantle chain data source (RPC / indexer) to ingest on-chain activity.
 *   2. An LLM key (`ANALYZE_API_KEY`) to run AI analysis of anomalies.
 *
 * Following the Cubiczan donor pattern (finance-cockpit / market-radar), the app
 * must boot, demo, and pass a smoke test with ZERO credentials by auto-detecting
 * missing creds and serving embedded synthetic on-chain data. This module is the
 * single source of truth for that detection.
 */

/** Placeholder RPC value that means "not configured" (mirrors donor pattern). */
const RPC_PLACEHOLDER = "https://rpc.mantle.example.com";

/**
 * The configured Mantle RPC/indexer URL, or `undefined` when unset/placeholder.
 * Live on-chain ingestion is only attempted when this is a real URL.
 */
export function mantleRpcUrl(): string | undefined {
  const url = process.env.MANTLE_RPC_URL?.trim();
  if (!url || url === RPC_PLACEHOLDER) return undefined;
  return url;
}

/** True when a live LLM analysis provider is configured. */
export function llmConfigured(): boolean {
  return Boolean(process.env.ANALYZE_API_KEY?.trim());
}

/**
 * Explicit offline/mock switch. Set `CHAINSIGHT_OFFLINE=1` (or `=mock`) to force
 * synthetic data regardless of any credentials that happen to be present.
 */
export function offlineFlagSet(): boolean {
  const v = (process.env.CHAINSIGHT_OFFLINE ?? process.env.CHAINSIGHT_MOCK ?? "")
    .toString()
    .toLowerCase();
  return v === "1" || v === "true" || v === "mock" || v === "yes";
}

/**
 * Whether the app is running in offline/mock mode overall: the explicit flag is
 * set, OR no live chain data source is configured. In this mode routes serve the
 * embedded synthetic on-chain dataset so the dashboard is always populated.
 */
export function isOffline(): boolean {
  return offlineFlagSet() || mantleRpcUrl() === undefined;
}

/** Data provenance tag attached to responses for transparency (donor pattern). */
export type DataTier = "live" | "cache" | "mock";
