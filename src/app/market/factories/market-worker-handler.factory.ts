import type { MarketGenerator } from '@market';
import { ProducerMessageType, ProducerStatus } from '@enums';
import type { ProducerSettings, WorkerRequest, WorkerResponse } from '@models';
import { createSymbols, isValidSettings } from '@helpers';
import { MarketAccumulator } from '../market-accumulator';

export function createMarketWorkerHandler(
  createGenerator: (wasmUrl: string, onFailure: (error: Error) => void) => Promise<MarketGenerator>,
  respond: (message: WorkerResponse) => void,
): (request: WorkerRequest) => Promise<void> {
  let started = false;
  let ready = false;
  let failed = false;
  let paused = false;
  let runId = 0;
  let settings: ProducerSettings;
  let symbols: readonly string[];
  let interval: ReturnType<typeof setInterval> | undefined;
  let batchesProcessed = 0;
  let tradesProcessed = 0;
  const totals = new MarketAccumulator();
  let generator: MarketGenerator;

  function fail(error: unknown): void {
    if (failed) {
      return;
    }

    failed = true;
    clearInterval(interval);

    respond({
      type: ProducerMessageType.Error,
      runId,
      message: error instanceof Error ? error.message : 'The market worker failed.',
    });
  }

  function publishSnapshot(): void {
    respond({
      type: ProducerMessageType.Snapshot,
      runId,
      status: paused ? ProducerStatus.Paused : ProducerStatus.Running,
      snapshot: {
        rows: totals.snapshot(),
        batchesProcessed,
        tradesProcessed,
      },
    });
  }

  function produceBatch(): void {
    if (failed || paused || !ready) {
      return;
    }

    try {
      const batch = generator.nextBatch(symbols, settings.updatesPerBatch);

      totals.applyBatch(batch);
      batchesProcessed += 1;
      tradesProcessed += batch.length;

      publishSnapshot();
    } catch (error) {
      fail(error);
    }
  }

  function startTimer(): void {
    clearInterval(interval);

    if (!ready || paused || failed) {
      return;
    }

    interval = setInterval(produceBatch, settings.intervalMs);
  }

  return async (data): Promise<void> => {
    if (data.type !== ProducerMessageType.Initialize) {
      if (!started || failed || data.runId !== runId) {
        return;
      }

      if (data.type === ProducerMessageType.Pause) {
        paused = true;
        clearInterval(interval);
      } else {
        if (!paused) {
          return;
        }

        paused = false;
        startTimer();
      }

      if (ready) {
        publishSnapshot();
      }

      return;
    }

    if (started) {
      return;
    }

    started = true;
    runId = data.runId;

    if (!isValidSettings(data.settings, data.limits)) {
      fail(new Error('Invalid simulation settings.'));
      return;
    }

    try {
      settings = data.settings;
      symbols = createSymbols(settings.instrumentCount);
      totals.reset(symbols);
      generator = await createGenerator(data.wasmUrl, fail);

      if (failed) {
        return;
      }

      ready = true;
      publishSnapshot();
      startTimer();
    } catch (error) {
      fail(error);
    }
  };
}
