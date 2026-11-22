import { inject, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import type { EnvironmentProviders } from '@angular/core';
import { MARKET_CONFIG, MARKET_SOURCE, MARKET_SNAPSHOT_VALIDATOR } from '@config';
import type { MarketConfig } from '@config';
import { createWorkerMarketSource } from '@factories';
import { isMarketSnapshot } from '@helpers';
import { RangeSettingsPolicyService, SettingsPolicy } from '@policies';
import { MarketProducerService } from '@services';

export function provideMarket(config: MarketConfig): EnvironmentProviders {
  const value: MarketConfig = Object.freeze({
    defaults: Object.freeze({ ...config.defaults }),
    limits: Object.freeze({
      instrumentCount: Object.freeze({ ...config.limits.instrumentCount }),
      updatesPerBatch: Object.freeze({ ...config.limits.updatesPerBatch }),
      intervalMs: Object.freeze({ ...config.limits.intervalMs }),
    }),
    runtime: Object.freeze({ ...config.runtime }),
  });

  return makeEnvironmentProviders([
    {
      provide: MARKET_CONFIG,
      useValue: value,
    },
    {
      provide: SettingsPolicy,
      useExisting: RangeSettingsPolicyService,
    },
    {
      provide: MARKET_SOURCE,
      useFactory: createWorkerMarketSource,
    },
    {
      provide: MARKET_SNAPSHOT_VALIDATOR,
      useValue: isMarketSnapshot,
    },
    provideAppInitializer(() => inject(MarketProducerService).start()),
  ]);
}
