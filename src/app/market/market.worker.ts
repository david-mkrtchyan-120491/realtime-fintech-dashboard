/// <reference lib="webworker" />

import { createMarketGenerator } from '@market';
import type { WorkerRequest } from '@models';
import { createMarketWorkerHandler } from './factories/market-worker-handler.factory';

const receive = createMarketWorkerHandler(createMarketGenerator, message => postMessage(message));

addEventListener('message', ({ data }: MessageEvent<WorkerRequest>) => {
  void receive(data);
});
