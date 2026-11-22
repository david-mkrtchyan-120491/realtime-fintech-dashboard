import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProducerMessageType, ProducerStatus } from '@enums';
import type { MarketGenerator } from '@market';
import type { InitializeWorkerRequest, WorkerResponse } from '@models';
import { marketTestConfig, stockUpdate } from '../../../testing/market.fixtures';
import { createMarketWorkerHandler } from './market-worker-handler.factory';

describe('Market worker message handler', () => {
  const runId = 7;
  const respond = vi.fn<(message: WorkerResponse) => void>();
  const nextBatch = vi.fn<MarketGenerator['nextBatch']>();
  const createGenerator = vi.fn<Parameters<typeof createMarketWorkerHandler>[0]>();
  let receive: ReturnType<typeof createMarketWorkerHandler>;
  let initialize: InitializeWorkerRequest;

  beforeEach(() => {
    vi.useFakeTimers();
    respond.mockReset();
    nextBatch.mockReset().mockImplementation((symbols, size) => Array.from({ length: size }, (_, index) =>
      stockUpdate({ symbol: symbols[index % symbols.length] }),
    ));
    createGenerator.mockReset().mockResolvedValue({ nextBatch });
    receive = createMarketWorkerHandler(createGenerator, respond);
    initialize = {
      type: ProducerMessageType.Initialize,
      runId,
      settings: marketTestConfig.defaults,
      limits: marketTestConfig.limits,
      wasmUrl: '/wasm/market.wasm',
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('publishes five empty rows before requesting exactly 100 updates after 500 ms', async () => {
    await receive(initialize);

    expect(createGenerator).toHaveBeenCalledWith('/wasm/market.wasm', expect.any(Function));
    expect(respond).toHaveBeenLastCalledWith({
      type: ProducerMessageType.Snapshot,
      runId,
      status: ProducerStatus.Running,
      snapshot: {
        rows: ['SIM01', 'SIM02', 'SIM03', 'SIM04', 'SIM05'].map(symbol => ({
          symbol,
          lastPriceCents: null,
          spreadCents: null,
          volume: 0,
          vwapCents: null,
          imbalance: null,
        })),
        batchesProcessed: 0,
        tradesProcessed: 0,
      },
    });

    vi.advanceTimersByTime(499);
    expect(nextBatch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(nextBatch).toHaveBeenCalledExactlyOnceWith(['SIM01', 'SIM02', 'SIM03', 'SIM04', 'SIM05'], 100);
    expect(respond).toHaveBeenLastCalledWith(expect.objectContaining({
      snapshot: expect.objectContaining({
        rows: expect.arrayContaining([expect.objectContaining({ symbol: 'SIM01', volume: 200 })]),
        batchesProcessed: 1,
        tradesProcessed: 100,
      }),
    }));
  });

  it('includes every generated trade on pause, then resumes the same generator after a fresh interval', async () => {
    nextBatch.mockReturnValueOnce([
      stockUpdate({ symbol: 'SIM01' }),
      stockUpdate({ symbol: 'SIM01', priceCents: 10_200, quantity: 30, bidCents: 10_196, askCents: 10_200 }),
    ]).mockReturnValueOnce([
      stockUpdate({ symbol: 'SIM01', priceCents: 10_300, quantity: 2, bidCents: 10_296, askCents: 10_300 }),
      stockUpdate({ symbol: 'SIM01', priceCents: 10_300, quantity: 3, bidCents: 10_296, askCents: 10_300 }),
    ]);
    await receive({ ...initialize, settings: { ...initialize.settings, updatesPerBatch: 2 } });
    vi.advanceTimersByTime(750);
    await receive({ type: ProducerMessageType.Pause, runId });

    const pausedSnapshot = respond.mock.lastCall?.[0];

    expect(pausedSnapshot).toMatchObject({
      status: ProducerStatus.Paused,
      snapshot: {
        rows: expect.arrayContaining([expect.objectContaining({
          symbol: 'SIM01',
          volume: 40,
          vwapCents: 10_150,
          lastPriceCents: 10_200,
        })]),
        batchesProcessed: 1,
        tradesProcessed: 2,
      },
    });
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(60_000);

    expect(nextBatch).toHaveBeenCalledTimes(1);
    expect(respond.mock.lastCall?.[0]).toBe(pausedSnapshot);

    await receive({ type: ProducerMessageType.Resume, runId });

    expect(respond.mock.lastCall?.[0]).toMatchObject({
      status: ProducerStatus.Running,
      snapshot: expect.objectContaining({ tradesProcessed: 2 }),
    });
    vi.advanceTimersByTime(499);
    expect(nextBatch).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);

    expect(createGenerator).toHaveBeenCalledTimes(1);
    expect(nextBatch).toHaveBeenCalledTimes(2);
    expect(respond.mock.lastCall?.[0]).toMatchObject({
      snapshot: {
        rows: expect.arrayContaining([expect.objectContaining({
          symbol: 'SIM01',
          volume: 45,
          vwapCents: 457_500 / 45,
          lastPriceCents: 10_300,
        })]),
        batchesProcessed: 2,
        tradesProcessed: 4,
      },
    });
  });

  it('ignores controls for old runs and does not create timers for repeated initialize or resume', async () => {
    await receive(initialize);
    await receive(initialize);
    await receive({ type: ProducerMessageType.Resume, runId });
    await receive({ type: ProducerMessageType.Pause, runId: runId - 1 });
    vi.advanceTimersByTime(500);

    expect(nextBatch).toHaveBeenCalledTimes(1);
    expect(createGenerator).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    await receive({ type: ProducerMessageType.Pause, runId });
    await receive({ type: ProducerMessageType.Resume, runId: runId - 1 });
    vi.advanceTimersByTime(5_000);

    expect(nextBatch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('remembers a pause received while Wasm is still initializing', async () => {
    let finishLoading!: (generator: MarketGenerator) => void;
    createGenerator.mockReturnValue(new Promise(resolve => {
      finishLoading = resolve;
    }));

    const initializing = receive(initialize);
    await receive({ type: ProducerMessageType.Pause, runId });
    finishLoading({ nextBatch });
    await initializing;
    vi.advanceTimersByTime(5_000);

    expect(nextBatch).not.toHaveBeenCalled();
    expect(respond.mock.lastCall?.[0]).toMatchObject({ status: ProducerStatus.Paused });

    await receive({ type: ProducerMessageType.Resume, runId });
    vi.advanceTimersByTime(500);

    expect(nextBatch).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid settings without loading Wasm or starting a timer', async () => {
    await receive({ ...initialize, settings: { ...initialize.settings, updatesPerBatch: 1.5 } });

    expect(createGenerator).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(respond).toHaveBeenCalledExactlyOnceWith({
      type: ProducerMessageType.Error,
      runId,
      message: 'Invalid simulation settings.',
    });
  });

  it('reports Wasm initialization failures without starting generation', async () => {
    createGenerator.mockRejectedValue(new Error('Could not load market.wasm (HTTP 404).'));
    await receive(initialize);

    expect(respond).toHaveBeenCalledExactlyOnceWith({
      type: ProducerMessageType.Error,
      runId,
      message: 'Could not load market.wasm (HTTP 404).',
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops its timer after a generation failure and ignores subsequent controls', async () => {
    nextBatch.mockImplementation(() => {
      throw new Error('Generator failed');
    });
    await receive(initialize);
    vi.advanceTimersByTime(500);
    await receive({ type: ProducerMessageType.Pause, runId });
    await receive({ type: ProducerMessageType.Resume, runId });
    vi.advanceTimersByTime(5_000);

    expect(nextBatch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(respond.mock.lastCall?.[0]).toEqual({
      type: ProducerMessageType.Error,
      runId,
      message: 'Generator failed',
    });
  });
});
