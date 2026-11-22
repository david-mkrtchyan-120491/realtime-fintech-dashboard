import type { ProducerStatus } from '@enums';
import type { MarketSnapshot, ProducerSettings } from '@models';
import type { StockDisplay } from './stock-display';
import type { TemplateContext } from './template-context';

export interface MarketView extends MarketSnapshot {
  readonly runId: number;
  readonly status: ProducerStatus;
  readonly settings: ProducerSettings;
  readonly rows: readonly StockDisplay[];
  readonly errorMessage: string | null;
  readonly retry: () => void;
}

export type MarketTemplateContext = TemplateContext<MarketView>;
