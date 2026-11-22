import { Injectable, inject } from '@angular/core';
import { SettingsPolicy } from './settings-policy';
import { MARKET_CONFIG } from '@config';
import { isValidSettings } from '@helpers';
import type { ProducerSettings } from '@models';

@Injectable({
  providedIn: 'root'
})
export class RangeSettingsPolicyService extends SettingsPolicy {
  private readonly limits = inject(MARKET_CONFIG).limits;

  public override isValid(value: unknown): value is ProducerSettings {
    return isValidSettings(value, this.limits);
  }
}
