import type { StockUpdate } from '@models';

export interface MarketGenerator {
  nextBatch(symbols: readonly string[], size: number): readonly StockUpdate[];
}
