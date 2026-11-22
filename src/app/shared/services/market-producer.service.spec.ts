import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MARKET_CONFIG, MARKET_SOURCE, MARKET_SNAPSHOT_VALIDATOR } from '@config';
import type { ProducerSource } from '@contracts';
import { ProducerMessageType, ProducerStatus } from '@enums';
import { isMarketSnapshot } from '@helpers';
import type { ProducerSettings } from '@models';
import { RangeSettingsPolicyService, SettingsPolicy } from '@policies';
import { marketSnapshot, marketTestConfig } from '../../../testing/market.fixtures';
import { FakeProducerConnection } from '../../../testing/producer-source.fake';
import { MarketProducerService } from './market-producer.service';

describe('MarketProducerService', () => {
  const source = vi.fn<ProducerSource<ProducerSettings>>();
  let connections: FakeProducerConnection[];
  let producer: MarketProducerService;

  beforeEach(() => {
    vi.useFakeTimers();
    connections = [];
    source.mockReset().mockImplementation(() => {
      const connection = new FakeProducerConnection();
      connections.push(connection);

      return connection;
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: MARKET_CONFIG, useValue: marketTestConfig },
        { provide: MARKET_SOURCE, useValue: source },
        { provide: MARKET_SNAPSHOT_VALIDATOR, useValue: isMarketSnapshot },
        { provide: SettingsPolicy, useExisting: RangeSettingsPolicyService },
      ],
    });
    producer = TestBed.inject(MarketProducerService);
    producer.start();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('starts one shared producer with defaults and five empty rows', () => {
    producer.start();

    expect(TestBed.inject(MarketProducerService)).toBe(producer);
    expect(source).toHaveBeenCalledExactlyOnceWith({ instrumentCount: 5, updatesPerBatch: 100, intervalMs: 500 }, 1);
    expect(connections[0].start).toHaveBeenCalledTimes(1);
    expect(producer.state()).toMatchObject({
      status: ProducerStatus.Loading,
      batchesProcessed: 0,
      tradesProcessed: 0,
    });
    expect(producer.state().rows).toEqual(['SIM01', 'SIM02', 'SIM03', 'SIM04', 'SIM05'].map(symbol => ({
      symbol,
      lastPriceCents: null,
      spreadCents: null,
      volume: 0,
      vwapCents: null,
      imbalance: null,
    })));
  });

  it('replaces cumulative snapshots without adding their totals a second time', () => {
    const snapshot = marketSnapshot(1);
    connections[0].messages.next(snapshot);
    connections[0].messages.next(snapshot);

    expect(producer.state().rows[0].volume).toBe(40);
    expect(producer.state().tradesProcessed).toBe(2);

    connections[0].messages.next(marketSnapshot(1, {
      rows: [{ ...snapshot.snapshot.rows[0], volume: 45 }],
      batchesProcessed: 2,
      tradesProcessed: 4,
    }));

    expect(producer.state().rows[0].volume).toBe(45);
    expect(producer.state().tradesProcessed).toBe(4);
  });

  it.each([ProducerStatus.Running, ProducerStatus.Paused] as const)(
    'Apply with identical settings replaces a %s run and clears all totals immediately',
    status => {
      connections[0].messages.next(marketSnapshot(1, {}, status));
      producer.apply({ ...marketTestConfig.defaults });

      expect(connections[0].dispose).toHaveBeenCalledTimes(1);
      expect(connections[0].messages.observed).toBe(false);
      expect(connections[1].start).toHaveBeenCalledTimes(1);
      expect(producer.state().runId).toBe(2);
      expect(producer.state().status).toBe(ProducerStatus.Loading);
      expect(producer.state().tradesProcessed).toBe(0);
      expect(producer.state().batchesProcessed).toBe(0);
      expect(producer.state().rows).toHaveLength(5);
      expect(producer.state().rows.every(row => row.volume === 0 && row.vwapCents === null && row.lastPriceCents === null)).toBe(true);

      connections[1].messages.next(marketSnapshot(2));

      expect(producer.state().status).toBe(ProducerStatus.Running);
    },
  );

  it('applies a new instrument count and copies the settings instead of retaining the draft', () => {
    connections[0].messages.next(marketSnapshot(1, {}, ProducerStatus.Paused));
    const draft = { instrumentCount: 2, updatesPerBatch: 1, intervalMs: 50 };
    producer.apply(draft);
    draft.instrumentCount = 3;

    expect(producer.state().settings).toEqual({ instrumentCount: 2, updatesPerBatch: 1, intervalMs: 50 });
    expect(producer.state().rows.map(row => row.symbol)).toEqual(['SIM01', 'SIM02']);
    expect(producer.state().rows.every(row => row.volume === 0 && row.imbalance === null && row.spreadCents === null)).toBe(true);
    expect(connections[1].start).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid Apply without replacing the current run', () => {
    connections[0].messages.next(marketSnapshot(1));
    const previous = producer.state();

    expect(() => producer.apply({ ...marketTestConfig.defaults, instrumentCount: 0 }))
      .toThrow('Invalid simulation settings.');
    expect(producer.state()).toBe(previous);
    expect(connections[0].dispose).not.toHaveBeenCalled();
    expect(source).toHaveBeenCalledTimes(1);
  });

  it('ignores delayed old snapshots and errors after Apply, including on the new connection', () => {
    connections[0].messages.next(marketSnapshot(1));
    producer.apply(marketTestConfig.defaults);
    const fresh = producer.state();
    const oldError = { type: ProducerMessageType.Error, runId: 1, message: 'Delayed failure' };

    connections[0].messages.next(marketSnapshot(1));
    connections[0].messages.next(oldError);
    connections[1].messages.next(marketSnapshot(1));
    connections[1].messages.next(oldError);

    expect(producer.state()).toBe(fresh);
    expect(connections[1].dispose).not.toHaveBeenCalled();

    connections[1].messages.next(marketSnapshot(2));

    expect(producer.state().status).toBe(ProducerStatus.Running);
    expect(producer.state().runId).toBe(2);
  });

  it('waits for pause acknowledgement and retains trades generated before it', () => {
    connections[0].messages.next(marketSnapshot(1));
    producer.pause();
    producer.pause();

    expect(connections[0].pause).toHaveBeenCalledTimes(1);
    expect(producer.state().status).toBe(ProducerStatus.Pausing);

    const latest = {
      rows: [{ ...marketSnapshot(1).snapshot.rows[0], volume: 60 }],
      batchesProcessed: 2,
      tradesProcessed: 3,
    };
    connections[0].messages.next(marketSnapshot(1, latest));

    expect(producer.state().status).toBe(ProducerStatus.Pausing);
    expect(producer.state().rows[0].volume).toBe(60);

    connections[0].messages.next(marketSnapshot(1, latest, ProducerStatus.Paused));
    vi.advanceTimersByTime(60_000);

    expect(producer.state().status).toBe(ProducerStatus.Paused);
    expect(producer.state().rows[0].volume).toBe(60);
  });

  it('resumes the existing session without resetting prices or totals', () => {
    connections[0].messages.next(marketSnapshot(1, {}, ProducerStatus.Paused));
    const rows = producer.state().rows;
    producer.resume();
    producer.resume();

    expect(connections[0].resume).toHaveBeenCalledTimes(1);
    expect(producer.state().status).toBe(ProducerStatus.Resuming);
    expect(producer.state().rows).toBe(rows);

    connections[0].messages.next(marketSnapshot(1, {}, ProducerStatus.Paused));
    expect(producer.state().status).toBe(ProducerStatus.Resuming);

    connections[0].messages.next(marketSnapshot(1));

    expect(producer.state().status).toBe(ProducerStatus.Running);
    expect(producer.state().rows[0].volume).toBe(40);
    expect(source).toHaveBeenCalledTimes(1);
    expect(producer.state().runId).toBe(1);
  });

  it('shows initialization failure and allows retry to create a fresh run', () => {
    vi.advanceTimersByTime(15_000);

    expect(producer.state()).toMatchObject({
      status: ProducerStatus.Error,
      message: 'The producer took too long to initialize. Please try again.',
    });
    expect(connections[0].dispose).toHaveBeenCalledTimes(1);

    producer.retry();
    connections[1].messages.next(marketSnapshot(2));

    expect(producer.state().status).toBe(ProducerStatus.Running);
    expect(source).toHaveBeenCalledTimes(2);
  });

  it('disposes the active connection when its root injector is destroyed', () => {
    TestBed.resetTestingModule();

    expect(connections[0].dispose).toHaveBeenCalledTimes(1);
    expect(connections[0].messages.observed).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
