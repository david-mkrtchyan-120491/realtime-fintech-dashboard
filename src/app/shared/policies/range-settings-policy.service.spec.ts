import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { MARKET_CONFIG } from '@config';
import { marketTestConfig } from '../../../testing/market.fixtures';
import { RangeSettingsPolicyService } from './range-settings-policy.service';

describe('RangeSettingsPolicyService', () => {
  let policy: RangeSettingsPolicyService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{
        provide: MARKET_CONFIG,
        useValue: marketTestConfig,
      }],
    });
    policy = TestBed.inject(RangeSettingsPolicyService);
  });

  it('accepts the assignment defaults', () => {
    expect(policy.isValid({ instrumentCount: 5, updatesPerBatch: 100, intervalMs: 500 })).toBe(true);
  });

  describe.each([
    { field: 'instrumentCount', min: 1, max: 50 },
    { field: 'updatesPerBatch', min: 1, max: 1_000 },
    { field: 'intervalMs', min: 50, max: 2_000 },
  ])('$field', ({ field, min, max }) => {
    it.each([min, max])('accepts the inclusive boundary %s', value => {
      expect(policy.isValid({ ...marketTestConfig.defaults, [field]: value })).toBe(true);
    });

    it.each([
      { name: 'missing', value: undefined },
      { name: 'empty', value: null },
      { name: 'empty string', value: '' },
      { name: 'numeric string', value: String(min) },
      { name: 'boolean', value: true },
      { name: 'fraction', value: min + 0.5 },
      { name: 'below minimum', value: min - 1 },
      { name: 'above maximum', value: max + 1 },
      { name: 'NaN', value: Number.NaN },
      { name: 'infinity', value: Number.POSITIVE_INFINITY },
      { name: 'negative infinity', value: Number.NEGATIVE_INFINITY },
    ])('rejects $name', ({ value }) => {
      expect(policy.isValid({ ...marketTestConfig.defaults, [field]: value })).toBe(false);
    });
  });

  it.each([null, undefined, {}, [], 'settings', 5])('rejects malformed settings: %s', value => {
    expect(policy.isValid(value)).toBe(false);
  });

  it('uses the limits supplied through DI', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{
        provide: MARKET_CONFIG,
        useValue: {
          ...marketTestConfig,
          limits: {
            ...marketTestConfig.limits,
            instrumentCount: {
              label: 'Instrument count',
              min: 1,
              max: 2,
            },
          },
        },
      }],
    });

    const customPolicy = TestBed.inject(RangeSettingsPolicyService);

    expect(customPolicy.isValid(marketTestConfig.defaults)).toBe(false);
    expect(customPolicy.isValid({ ...marketTestConfig.defaults, instrumentCount: 2 })).toBe(true);
  });
});
