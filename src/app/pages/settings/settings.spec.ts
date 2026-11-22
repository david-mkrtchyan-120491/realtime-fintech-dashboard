import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MARKET_CONFIG, MARKET_SOURCE } from '@config';
import type { ProducerSource } from '@contracts';
import { ProducerStatus } from '@enums';
import type { ProducerSettings, SettingsField } from '@models';
import { MarketProducerService } from '@services';
import { appConfig } from '../../app.config';
import { marketSnapshot } from '../../../testing/market.fixtures';
import { FakeProducerConnection } from '../../../testing/producer-source.fake';
import { Settings } from './settings';

describe('Settings', () => {
  const source = vi.fn<ProducerSource<ProducerSettings>>();
  let connections: FakeProducerConnection[];
  let fixture: ComponentFixture<Settings>;
  let element: HTMLElement;
  let producer: MarketProducerService;
  let router: Router;

  function renderSettings(): void {
    fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();
    element = fixture.nativeElement;
  }

  function input(field: SettingsField): HTMLInputElement {
    const control = element.querySelector<HTMLInputElement>(`#settings-${field}`);

    if (!control) {
      throw new Error(`Missing settings input: ${field}`);
    }

    return control;
  }

  function edit(field: SettingsField, value: string): void {
    const control = input(field);
    control.value = value;
    control.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function applyButton(): HTMLButtonElement {
    const button = element.querySelector<HTMLButtonElement>('button[type="submit"]');

    if (!button) {
      throw new Error('Missing Apply button');
    }

    return button;
  }

  function submit(): void {
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  beforeEach(() => {
    connections = [];
    source.mockReset().mockImplementation(() => {
      const connection = new FakeProducerConnection();
      connections.push(connection);

      return connection;
    });
    TestBed.configureTestingModule({
      providers: [
        appConfig.providers,
        { provide: MARKET_SOURCE, useValue: source },
      ],
      imports: [Settings],
    });
    producer = TestBed.inject(MarketProducerService);
    producer.start();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    connections[0].messages.next(marketSnapshot(producer.state().runId));
    renderSettings();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('opens with the actual application defaults and inclusive input limits', () => {
    expect(input('instrumentCount').value).toBe('5');
    expect(input('updatesPerBatch').value).toBe('100');
    expect(input('intervalMs').value).toBe('500');
    expect(TestBed.inject(MARKET_CONFIG).defaults).toEqual({
      instrumentCount: 5,
      updatesPerBatch: 100,
      intervalMs: 500,
    });

    for (const [field, min, max] of [
      ['instrumentCount', '1', '50'],
      ['updatesPerBatch', '1', '1000'],
      ['intervalMs', '50', '2000'],
    ] as const) {
      expect(input(field).type).toBe('number');
      expect(input(field).required).toBe(true);
      expect(input(field).step).toBe('1');
      expect(input(field).min).toBe(min);
      expect(input(field).max).toBe(max);
    }

    expect(applyButton().disabled).toBe(false);
  });

  describe.each([
    { field: 'instrumentCount' as const, label: 'Instrument count', min: 1, max: 50 },
    { field: 'updatesPerBatch' as const, label: 'Updates per batch', min: 1, max: 1_000 },
    { field: 'intervalMs' as const, label: 'Batch interval (ms)', min: 50, max: 2_000 },
  ])('$field validation', ({ field, label, min, max }) => {
    it.each([
      { name: 'empty', value: '', error: `${label} is required.` },
      { name: 'fractional', value: String(min + 0.5), error: `${label} must be a whole number.` },
      { name: 'too small', value: String(min - 1), error: `${label} must be between ${min} and ${max}, inclusive.` },
      { name: 'too large', value: String(max + 1), error: `${label} must be between ${min} and ${max}, inclusive.` },
    ])('shows a clear error for $name input and prevents Apply', ({ value, error }) => {
      const previous = producer.state();
      edit(field, value);

      expect(input(field).getAttribute('aria-invalid')).toBe('true');
      expect(element.querySelector(`#settings-${field}-error`)?.textContent?.trim()).toBe(error);
      expect(applyButton().disabled).toBe(true);

      submit();

      expect(producer.state()).toBe(previous);
      expect(source).toHaveBeenCalledTimes(1);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it.each([min, max])('accepts the inclusive boundary %s', value => {
      edit(field, String(value));

      expect(input(field).getAttribute('aria-invalid')).toBe('false');
      expect(element.querySelector(`#settings-${field}-error`)).toBeNull();
      expect(applyButton().disabled).toBe(false);
    });
  });

  it.each([ProducerStatus.Running, ProducerStatus.Paused] as const)(
    'keeps a %s run untouched while editing and destroying the page',
    status => {
      connections[0].messages.next(marketSnapshot(1, {}, status));
      const previous = producer.state();

      edit('instrumentCount', '12');
      edit('updatesPerBatch', '25');
      edit('intervalMs', '200');
      fixture.destroy();

      expect(producer.state()).toBe(previous);
      expect(source).toHaveBeenCalledTimes(1);
      expect(connections[0].pause).not.toHaveBeenCalled();
      expect(connections[0].resume).not.toHaveBeenCalled();
      expect(connections[0].dispose).not.toHaveBeenCalled();

      renderSettings();

      expect(input('instrumentCount').value).toBe('5');
      expect(input('updatesPerBatch').value).toBe('100');
      expect(input('intervalMs').value).toBe('500');
      expect(producer.state().status).toBe(status);
      expect(producer.state().rows[0].volume).toBe(40);
      expect(TestBed.inject(MarketProducerService)).toBe(producer);
    },
  );

  it('applies valid changes from a paused run, clears totals, starts a new source, and navigates home', () => {
    connections[0].messages.next(marketSnapshot(1, {}, ProducerStatus.Paused));
    edit('instrumentCount', '2');
    edit('updatesPerBatch', '1');
    edit('intervalMs', '50');
    submit();

    expect(producer.state().settings).toEqual({ instrumentCount: 2, updatesPerBatch: 1, intervalMs: 50 });
    expect(producer.state().rows.map(row => row.symbol)).toEqual(['SIM01', 'SIM02']);
    expect(producer.state().rows.every(row => row.volume === 0 && row.lastPriceCents === null)).toBe(true);
    expect(producer.state().tradesProcessed).toBe(0);
    expect(producer.state().runId).toBe(2);
    expect(connections[0].dispose).toHaveBeenCalledTimes(1);
    expect(connections[1].start).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledExactlyOnceWith(['/']);

    connections[1].messages.next(marketSnapshot(2));
    fixture.destroy();
    renderSettings();

    expect(input('instrumentCount').value).toBe('2');
    expect(input('updatesPerBatch').value).toBe('1');
    expect(input('intervalMs').value).toBe('50');
    expect(producer.state().status).toBe(ProducerStatus.Running);
  });

  it('allows Apply with unchanged settings to start a fresh run', () => {
    submit();

    expect(producer.state().runId).toBe(2);
    expect(producer.state().tradesProcessed).toBe(0);
    expect(producer.state().rows.every(row => row.volume === 0)).toBe(true);
    expect(connections[1].start).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledExactlyOnceWith(['/']);
  });
});
