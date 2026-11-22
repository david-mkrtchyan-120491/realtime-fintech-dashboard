import type { ProducerSettings } from '@models';

export abstract class SettingsPolicy {
  public abstract isValid(value: unknown): value is ProducerSettings;
}
