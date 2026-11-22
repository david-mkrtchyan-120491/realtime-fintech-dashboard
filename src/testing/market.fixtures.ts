import type { MarketConfig } from '@config';
import { ProducerMessageType, ProducerStatus } from '@enums';
import type { MarketSnapshot, ProducerSnapshot, StockUpdate } from '@models';

export const marketTestConfig: MarketConfig = {
  defaults: {
    instrumentCount: 5,
    updatesPerBatch: 100,
    intervalMs: 500,
  },
  limits: {
    instrumentCount: {
      label: 'Instrument count',
      min: 1,
      max: 50,
    },
    updatesPerBatch: {
      label: 'Updates per batch',
      min: 1,
      max: 1_000,
    },
    intervalMs: {
      label: 'Batch interval (ms)',
      min: 50,
      max: 2_000,
    },
  },
  runtime: {
    wasmAssetPath: 'wasm/market.wasm',
    initializationTimeoutMs: 15_000,
  },
};

export function stockUpdate(overrides: Partial<StockUpdate> = {}): StockUpdate {
  return {
    symbol: 'ALFA',
    priceCents: 10_000,
    quantity: 10,
    bidCents: 9_996,
    askCents: 10_000,
    bidQuantity: 600,
    askQuantity: 400,
    ...overrides,
  };
}

export function marketSnapshot(
  runId: number,
  overrides: Partial<MarketSnapshot> = {},
  status: ProducerStatus.Running | ProducerStatus.Paused = ProducerStatus.Running,
): ProducerSnapshot<MarketSnapshot> {
  return {
    type: ProducerMessageType.Snapshot,
    runId,
    status,
    snapshot: {
      rows: [{
        symbol: 'SIM01',
        lastPriceCents: 10_200,
        spreadCents: 4,
        volume: 40,
        vwapCents: 10_150,
        imbalance: 0.2,
      }],
      batchesProcessed: 1,
      tradesProcessed: 2,
      ...overrides,
    },
  };
}
