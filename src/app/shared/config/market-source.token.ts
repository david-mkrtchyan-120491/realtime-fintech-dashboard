import { InjectionToken } from '@angular/core';
import type { ProducerSource, ProducerValidator } from '@contracts';
import type { MarketSnapshot, ProducerSettings } from '@models';

export const MARKET_SOURCE = new InjectionToken<ProducerSource<ProducerSettings>>('Market source');

export const MARKET_SNAPSHOT_VALIDATOR = new InjectionToken<ProducerValidator<MarketSnapshot>>('Market snapshot validator');
