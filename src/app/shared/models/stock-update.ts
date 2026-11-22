export interface StockUpdate {
  readonly symbol: string;
  readonly priceCents: number;
  readonly quantity: number;
  readonly bidCents: number;
  readonly askCents: number;
  readonly bidQuantity: number;
  readonly askQuantity: number;
}

