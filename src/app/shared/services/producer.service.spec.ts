import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProducerSession, ProducerSource } from '@contracts';
import { ProducerMessageType } from '@enums';
import { isMarketSnapshot } from '@helpers';
import type { MarketSnapshot, ProducerSettings, ProducerSnapshot } from '@models';
import { marketSnapshot, marketTestConfig } from '../../../testing/market.fixtures';
import { FakeProducerConnection } from '../../../testing/producer-source.fake';
import { ProducerService } from './producer.service';

describe('ProducerService', () => {
  const runId = 2;
  const onSnapshot = vi.fn<(event: ProducerSnapshot<MarketSnapshot>) => void>();
  const onError = vi.fn<(error: Error) => void>();
  const source = vi.fn<ProducerSource<ProducerSettings>>();
  let connection: FakeProducerConnection;
  let producer: ProducerService;
  let sessions: ProducerSession[];

  function listen(): ProducerSession {
    const session = producer.listen({
      source,
      validate: isMarketSnapshot,
      settings: marketTestConfig.defaults,
      runId,
      initializationTimeoutMs: 15_000,
      onSnapshot,
      onError,
    });
    sessions.push(session);

    return session;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    onSnapshot.mockReset();
    onError.mockReset();
    connection = new FakeProducerConnection();
    source.mockReset().mockReturnValue(connection);
    producer = TestBed.inject(ProducerService);
    sessions = [];
  });

  afterEach(() => {
    for (const session of sessions) {
      session.dispose();
    }

    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('subscribes before starting so even a synchronous first snapshot is delivered', () => {
    const snapshot = marketSnapshot(runId);
    connection.start.mockImplementation(() => connection.messages.next(snapshot));

    listen();

    expect(source).toHaveBeenCalledExactlyOnceWith(marketTestConfig.defaults, runId);
    expect(onSnapshot).toHaveBeenCalledExactlyOnceWith(snapshot);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('forwards controls and disposes its connection and listener only once', () => {
    const session = listen();
    session.pause();
    session.resume();

    expect(connection.start).toHaveBeenCalledTimes(1);
    expect(connection.pause).toHaveBeenCalledTimes(1);
    expect(connection.resume).toHaveBeenCalledTimes(1);
    expect(connection.messages.observed).toBe(true);

    session.dispose();
    session.dispose();
    session.pause();
    session.resume();
    connection.messages.next(marketSnapshot(runId));

    expect(connection.dispose).toHaveBeenCalledTimes(1);
    expect(connection.pause).toHaveBeenCalledTimes(1);
    expect(connection.resume).toHaveBeenCalledTimes(1);
    expect(connection.messages.observed).toBe(false);
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores snapshots, errors, and invalid payloads belonging to an older run', () => {
    listen();
    connection.messages.next(marketSnapshot(runId - 1));
    connection.messages.next({ type: ProducerMessageType.Error, runId: runId - 1, message: 'Old error' });
    connection.messages.next({ type: ProducerMessageType.Snapshot, runId: runId - 1, snapshot: {} });

    expect(onSnapshot).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(connection.dispose).not.toHaveBeenCalled();

    connection.messages.next(marketSnapshot(runId));

    expect(onSnapshot).toHaveBeenCalledExactlyOnceWith(marketSnapshot(runId));
  });

  it.each([
    { name: 'missing run ID', message: {} },
    { name: 'fractional run ID', message: { runId: 2.5 } },
    { name: 'invalid event type', message: { runId, type: 'unexpected' } },
    { name: 'invalid snapshot', message: { ...marketSnapshot(runId), snapshot: { rows: null } } },
    { name: 'invalid status', message: { ...marketSnapshot(runId), status: 'unexpected' } },
  ])('rejects $name and releases the connection', ({ message }) => {
    listen();
    connection.messages.next(message);

    expect(onSnapshot).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledExactlyOnceWith(new Error('The producer returned an invalid message.'));
    expect(connection.dispose).toHaveBeenCalledTimes(1);
    expect(connection.messages.observed).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out only an uninitialized run, including when only stale messages arrive', () => {
    listen();
    connection.messages.next(marketSnapshot(runId - 1));
    vi.advanceTimersByTime(14_999);

    expect(onError).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(onError).toHaveBeenCalledExactlyOnceWith(
      new Error('The producer took too long to initialize. Please try again.'),
    );
    expect(connection.dispose).toHaveBeenCalledTimes(1);
  });

  it('cancels the initialization timeout after a valid snapshot', () => {
    listen();
    connection.messages.next(marketSnapshot(runId));
    vi.advanceTimersByTime(60_000);

    expect(onError).not.toHaveBeenCalled();
    expect(connection.dispose).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports a producer failure once and rejects later snapshots', () => {
    listen();
    connection.messages.next({ type: ProducerMessageType.Error, runId, message: 'Wasm failed' });
    connection.messages.next(marketSnapshot(runId));

    expect(onError).toHaveBeenCalledExactlyOnceWith(new Error('Wasm failed'));
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(connection.dispose).toHaveBeenCalledTimes(1);
  });

  it('handles failures while opening the source', () => {
    source.mockImplementation(() => {
      throw new Error('Worker creation failed');
    });

    const session = listen();
    session.pause();
    session.resume();
    session.dispose();

    expect(onError).toHaveBeenCalledExactlyOnceWith(new Error('Worker creation failed'));
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['start', 'pause', 'resume'] as const)('cleans up when %s throws', action => {
    connection[action].mockImplementation(() => {
      throw new Error('Connection failed');
    });
    const session = listen();

    if (action !== 'start') {
      session[action]();
    }

    expect(onError).toHaveBeenCalledExactlyOnceWith(new Error('Connection failed'));
    expect(connection.dispose).toHaveBeenCalledTimes(1);
    expect(connection.messages.observed).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('handles stream errors and unexpected completion', () => {
    listen();
    connection.messages.error(new Error('Worker crashed'));

    expect(onError).toHaveBeenCalledExactlyOnceWith(new Error('Worker crashed'));
    expect(connection.dispose).toHaveBeenCalledTimes(1);

    connection = new FakeProducerConnection();
    source.mockReturnValue(connection);
    onError.mockClear();
    listen();
    connection.messages.complete();

    expect(onError).toHaveBeenCalledExactlyOnceWith(new Error('The producer stopped unexpectedly.'));
    expect(connection.dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps multiple source connections independent', () => {
    const firstSession = listen();
    const firstConnection = connection;
    connection = new FakeProducerConnection();
    source.mockReturnValue(connection);
    listen();
    firstSession.dispose();

    connection.messages.next(marketSnapshot(runId));
    firstConnection.messages.next(marketSnapshot(runId));

    expect(firstConnection.dispose).toHaveBeenCalledTimes(1);
    expect(connection.dispose).not.toHaveBeenCalled();
    expect(connection.messages.observed).toBe(true);
    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });
});
