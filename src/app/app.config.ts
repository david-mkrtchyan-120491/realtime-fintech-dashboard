import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideMarket } from '@providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideMarket({
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
    }),
  ],
};
