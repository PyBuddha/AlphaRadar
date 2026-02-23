import { createKiwoomCollector } from "./kiwoom/index.js";
import type { Collector, CollectorConfig } from "./types.js";

export function createCollector(config: CollectorConfig): Collector {
  if (config.provider === "kiwoom") {
    return createKiwoomCollector(config);
  }

  const provider = (config as { provider?: string }).provider ?? "unknown";
  throw new Error(`Unsupported collector provider: ${provider}`);
}

