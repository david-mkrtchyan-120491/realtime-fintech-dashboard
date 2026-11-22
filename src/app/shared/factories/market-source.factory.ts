import { inject } from '@angular/core';
import { connectWorker } from '@adapters';
import { MARKET_CONFIG } from '@config';
import type { ProducerSource } from '@contracts';
import { ProducerMessageType } from '@enums';
import type { ProducerSettings, WorkerRequest } from '@models';
import { MarketWorkerFactory } from './market-worker.factory';

export function createWorkerMarketSource(): ProducerSource<ProducerSettings> {
  const workerFactory = inject(MarketWorkerFactory);
  const config = inject(MARKET_CONFIG);

  return (settings, runId) => connectWorker<WorkerRequest>(() => workerFactory.create(), {
    start: {
      type: ProducerMessageType.Initialize,
      runId,
      settings,
      limits: config.limits,
      wasmUrl: new URL(config.runtime.wasmAssetPath, document.baseURI).href,
    },
    pause: {
      type: ProducerMessageType.Pause,
      runId,
    },
    resume: {
      type: ProducerMessageType.Resume,
      runId,
    },
  });
}
