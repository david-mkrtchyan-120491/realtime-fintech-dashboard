import type { StockMetrics } from './stock-metrics';

export interface MarketSnapshot {
  readonly rows: readonly StockMetrics[];
  readonly batchesProcessed: number;
  readonly tradesProcessed: number;
}
