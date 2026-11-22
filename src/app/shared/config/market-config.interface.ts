import type { ProducerSettings, SettingsLimits } from '@models';

export interface MarketConfig {
  readonly defaults: ProducerSettings;
  readonly limits: SettingsLimits;
  readonly runtime: {
    readonly wasmAssetPath: string;
    readonly initializationTimeoutMs: number;
  };
}
