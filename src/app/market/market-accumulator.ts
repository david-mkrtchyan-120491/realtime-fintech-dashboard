import type { StockMetrics, StockUpdate } from '@models';
import { createEmptyStockMetrics } from '@helpers';

interface SymbolTotals {
  latest: StockUpdate | null;
  volume: number;
  notionalCents: number;
}

export class MarketAccumulator {
  private readonly totals = new Map<string, SymbolTotals>();

  public reset(symbols: readonly string[]): void {
    this.totals.clear();

    for (const symbol of symbols) {
      this.totals.set(symbol, {
        latest: null,
        volume: 0,
        notionalCents: 0,
      });
    }
  }

  public applyBatch(trades: readonly StockUpdate[]): void {
    for (const trade of trades) {
      const totals = this.totals.get(trade.symbol);

      if (!totals) {
        throw new Error(`Unexpected market symbol: ${trade.symbol}`);
      }

      const volume = totals.volume + trade.quantity;
      const notionalCents = totals.notionalCents + trade.priceCents * trade.quantity;

      if (!Number.isSafeInteger(volume) || !Number.isSafeInteger(notionalCents)) {
        throw new Error('The simulation reached its exact-integer limit. Start a fresh run.');
      }

      totals.volume = volume;
      totals.notionalCents = notionalCents;
      totals.latest = trade;
    }
  }

  public snapshot(): StockMetrics[] {
    return createEmptyStockMetrics([...this.totals.keys()]).map((empty) => {
      const totals = this.totals.get(empty.symbol)!;
      const trade = totals.latest;

      if (!trade) {
        return empty;
      }

      const bookQuantity = trade.bidQuantity + trade.askQuantity;

      return {
        symbol: empty.symbol,
        lastPriceCents: trade.priceCents,
        spreadCents: trade.askCents - trade.bidCents,
        volume: totals.volume,
        vwapCents: totals.volume === 0 ? null : totals.notionalCents / totals.volume,
        imbalance: bookQuantity === 0 ? null : (trade.bidQuantity - trade.askQuantity) / bookQuantity,
      };
    });
  }
}
