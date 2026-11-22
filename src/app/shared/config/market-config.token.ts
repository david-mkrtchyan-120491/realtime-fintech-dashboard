import { InjectionToken } from '@angular/core';
import type { MarketConfig } from './market-config.interface';

export const MARKET_CONFIG = new InjectionToken<MarketConfig>('Market configuration');
