import type { PriceDirection } from '@enums';
import type { StockMetrics } from '@models';

export interface StockDisplay extends StockMetrics {
  readonly priceDirection: PriceDirection;
}
