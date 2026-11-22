import { Injectable } from '@angular/core';
import type { ProducerState, StockDisplay } from '@view-models';
import { comparePrices } from '@helpers';

@Injectable({
  providedIn: 'root'
})
export class DisplayedPricesService {
  private runId = -1;
  private batch = -1;
  private readonly prices = new Map<string, number | null>();
  private rows: readonly StockDisplay[] = [];

  public project(state: ProducerState): readonly StockDisplay[] {
    if (state.runId !== this.runId) {
      this.runId = state.runId;
      this.batch = -1;
      this.prices.clear();
    }

    if (state.batchesProcessed === this.batch) {
      return this.rows;
    }

    this.batch = state.batchesProcessed;
    this.rows = state.rows.map(row => {
      const previous = this.prices.get(row.symbol);
      const price = row.lastPriceCents;
      const priceDirection = comparePrices(previous, price);

      this.prices.set(row.symbol, price);

      return {
        ...row,
        priceDirection,
      };
    });

    return this.rows;
  }
}
