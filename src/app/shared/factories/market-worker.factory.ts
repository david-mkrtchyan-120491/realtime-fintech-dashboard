import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MarketWorkerFactory {
  public create(): Worker {
    if (typeof Worker === 'undefined') {
      throw new Error('Something went wrong');
    }

    return new Worker(new URL('../../market/market.worker', import.meta.url), {
      type: 'module',
    });
  }
}
