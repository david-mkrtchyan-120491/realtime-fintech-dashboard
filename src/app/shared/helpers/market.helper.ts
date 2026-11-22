import { PriceDirection, ProducerStatus } from '@enums';
import type { MarketSnapshot, StockMetrics, ProducerSettings, StockUpdate, SettingsField, SettingsLimits } from '@models';
import type { ProducerState } from '@view-models';

const settingsFields: readonly SettingsField[] = ['instrumentCount', 'updatesPerBatch', 'intervalMs'];

export function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

export function isValidSettings(value: unknown, limits: SettingsLimits): value is ProducerSettings {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const settings = value as Record<string, unknown>;

  return settingsFields.every(field => {
    const value = settings[field];
    const { min, max } = limits[field];

    return isInteger(value) && value >= min && value <= max;
  });
}

export function isStockUpdate(value: unknown): value is StockUpdate {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const {
    symbol,
    priceCents,
    quantity,
    bidCents,
    askCents,
    bidQuantity,
    askQuantity,
  } = value as Record<string, unknown>;

  const hasValidTrade = typeof symbol === 'string'
    && isInteger(priceCents) && priceCents > 0
    && isInteger(quantity) && quantity > 0
    && (priceCents === bidCents || priceCents === askCents);

  const hasValidQuote = isInteger(bidCents) && bidCents > 0
    && isInteger(askCents) && askCents > bidCents;

  const hasValidBookQuantities = isInteger(bidQuantity) && bidQuantity >= 0
    && isInteger(askQuantity) && askQuantity >= 0;

  return hasValidTrade && hasValidQuote && hasValidBookQuantities;
}

export function isMarketSnapshot(value: unknown): value is MarketSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const { rows, batchesProcessed, tradesProcessed } = value as Record<string, unknown>;

  return Array.isArray(rows)
    && rows.every(isStockMetrics)
    && isNonnegativeInteger(batchesProcessed)
    && isNonnegativeInteger(tradesProcessed);
}

function isStockMetrics(value: unknown): value is StockMetrics {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const {
    symbol,
    lastPriceCents,
    spreadCents,
    volume,
    vwapCents,
    imbalance,
  } = value as Record<string, unknown>;

  const hasValidPrices = (lastPriceCents === null || (isInteger(lastPriceCents) && lastPriceCents > 0))
    && (spreadCents === null || (isInteger(spreadCents) && spreadCents > 0));

  const hasValidMetrics = isNonnegativeInteger(volume)
    && (vwapCents === null || (isFiniteNumber(vwapCents) && vwapCents > 0))
    && (imbalance === null || (isFiniteNumber(imbalance) && imbalance >= -1 && imbalance <= 1));

  return typeof symbol === 'string' && hasValidPrices && hasValidMetrics;
}

function isNonnegativeInteger(value: unknown): value is number {
  return isInteger(value) && Number.isSafeInteger(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return Number.isFinite(value);
}

export function createSymbols(instrumentCount: number): string[] {
  return Array.from({ length: instrumentCount }, (_, index) => `SIM${String(index + 1).padStart(2, '0')}`);
}

export function createEmptyStockMetrics(symbols: readonly string[]): StockMetrics[] {
  return symbols.map(symbol => ({
    symbol,
    lastPriceCents: null,
    spreadCents: null,
    volume: 0,
    vwapCents: null,
    imbalance: null,
  }));
}

export function createInitialProducerState(settings: ProducerSettings, runId: number): ProducerState {
  return {
    status: ProducerStatus.Loading,
    settings,
    runId,
    rows: createEmptyStockMetrics(createSymbols(settings.instrumentCount)),
    batchesProcessed: 0,
    tradesProcessed: 0,
  };
}

export function comparePrices(previous: number | null | undefined, current: number | null): PriceDirection {
  if (previous == null || current == null || previous === current) {
    return PriceDirection.Neutral;
  }

  return current > previous ? PriceDirection.Up : PriceDirection.Down;
}
