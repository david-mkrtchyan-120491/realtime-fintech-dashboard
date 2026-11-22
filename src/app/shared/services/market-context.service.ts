import { Injectable, computed, inject } from '@angular/core';
import { ProducerStatus } from '@enums';
import type { ContextState, MarketView } from '@view-models';
import { DisplayedPricesService } from './displayed-prices.service';
import { MarketProducerService } from './market-producer.service';

@Injectable()
export class MarketContextService {
  private readonly producer = inject(MarketProducerService);
  private readonly displayedPrices = inject(DisplayedPricesService);
  private readonly retry = () => this.producer.retry();

  public readonly response = computed<ContextState<MarketView>>(() => {
    const state = this.producer.state();
    const rows = this.displayedPrices.project(state);

    return {
      data: {
        ...state,
        rows,
        errorMessage: state.status === ProducerStatus.Error ? state.message : null,
        retry: this.retry,
      },
      pending: state.status === ProducerStatus.Loading,
      empty: rows.length === 0,
      error: state.status === ProducerStatus.Error,
    };
  });
}
