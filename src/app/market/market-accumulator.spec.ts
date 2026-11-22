import { beforeEach, describe, expect, it } from 'vitest';
import { stockUpdate } from '../../testing/market.fixtures';
import { MarketAccumulator } from './market-accumulator';

describe('MarketAccumulator', () => {
  let accumulator: MarketAccumulator;

  beforeEach(() => {
    accumulator = new MarketAccumulator();
    accumulator.reset(['ALFA', 'BETA']);
  });

  it('creates stable rows with zero volume and unavailable metrics before trades arrive', () => {
    expect(accumulator.snapshot()).toEqual(['ALFA', 'BETA'].map(symbol => ({
      symbol,
      lastPriceCents: null,
      spreadCents: null,
      volume: 0,
      vwapCents: null,
      imbalance: null,
    })));
  });

  it('calculates all five metrics from the assignment worked example', () => {
    accumulator.applyBatch([
      stockUpdate(),
      stockUpdate({
        priceCents: 10_200,
        quantity: 30,
        bidCents: 10_196,
        askCents: 10_200,
      }),
    ]);

    expect(accumulator.snapshot()[0]).toEqual({
      symbol: 'ALFA',
      lastPriceCents: 10_200,
      spreadCents: 4,
      volume: 40,
      vwapCents: 10_150,
      imbalance: 0.2,
    });
  });

  it('counts every repeated-symbol trade across batches and keeps instruments separate', () => {
    accumulator.applyBatch([
      stockUpdate({ quantity: 1 }),
      stockUpdate({ symbol: 'BETA', priceCents: 5_000, quantity: 2, bidCents: 4_999, askCents: 5_000 }),
      stockUpdate({ priceCents: 10_200, quantity: 3, bidCents: 10_198, askCents: 10_200 }),
    ]);
    accumulator.applyBatch([
      stockUpdate({ priceCents: 10_200, quantity: 3, bidCents: 10_198, askCents: 10_200 }),
    ]);

    const [alfa, beta] = accumulator.snapshot();

    expect(alfa.volume).toBe(7);
    expect(alfa.vwapCents).toBe(71_200 / 7);
    expect(alfa.lastPriceCents).toBe(10_200);
    expect(beta.volume).toBe(2);
    expect(beta.vwapCents).toBe(5_000);
    expect(accumulator.snapshot().map(row => row.symbol)).toEqual(['ALFA', 'BETA']);
  });

  it('uses only the latest quote for spread and imbalance without adding book sizes to volume', () => {
    accumulator.applyBatch([stockUpdate()]);
    accumulator.applyBatch([stockUpdate({
      bidCents: 9_995,
      askCents: 10_000,
      quantity: 1,
      bidQuantity: 100,
      askQuantity: 900,
    })]);

    expect(accumulator.snapshot()[0]).toMatchObject({
      spreadCents: 5,
      imbalance: -0.8,
      volume: 11,
      vwapCents: 10_000,
    });
  });

  it('returns unavailable imbalance for an empty book while retaining valid trade totals', () => {
    accumulator.applyBatch([stockUpdate({ bidQuantity: 0, askQuantity: 0 })]);

    expect(accumulator.snapshot()[0]).toMatchObject({
      volume: 10,
      vwapCents: 10_000,
      imbalance: null,
    });
    expect(accumulator.snapshot()[1].vwapCents).toBeNull();
  });

  it.each([
    { bidQuantity: 600, askQuantity: 0, imbalance: 1 },
    { bidQuantity: 0, askQuantity: 400, imbalance: -1 },
    { bidQuantity: 400, askQuantity: 400, imbalance: 0 },
  ])('supports imbalance $imbalance', ({ bidQuantity, askQuantity, imbalance }) => {
    accumulator.applyBatch([stockUpdate({ bidQuantity, askQuantity })]);

    expect(accumulator.snapshot()[0].imbalance).toBe(imbalance);
  });

  it('keeps fractional cents until display and does not mutate previously published snapshots', () => {
    accumulator.applyBatch([stockUpdate({ priceCents: 100, quantity: 1, bidCents: 99, askCents: 100 })]);
    const previous = accumulator.snapshot();

    accumulator.applyBatch([stockUpdate({ priceCents: 101, quantity: 2, bidCents: 100, askCents: 101 })]);

    expect(accumulator.snapshot()[0].vwapCents).toBe(302 / 3);
    expect(previous[0].volume).toBe(1);
    expect(previous[0].vwapCents).toBe(100);
    expect(accumulator.snapshot()[0].volume).toBe(3);
  });

  it('clears all old totals and symbols on reset', () => {
    accumulator.applyBatch([stockUpdate()]);
    accumulator.reset(['BETA']);

    expect(accumulator.snapshot()).toEqual([{
      symbol: 'BETA',
      lastPriceCents: null,
      spreadCents: null,
      volume: 0,
      vwapCents: null,
      imbalance: null,
    }]);
  });

  it('rejects an unexpected symbol rather than mixing its trades into another instrument', () => {
    expect(() => accumulator.applyBatch([stockUpdate({ symbol: 'GAMMA' })]))
      .toThrow('Unexpected market symbol: GAMMA');
  });

  it('rejects totals beyond exact integer precision', () => {
    expect(() => accumulator.applyBatch([stockUpdate({ quantity: Number.MAX_SAFE_INTEGER })]))
      .toThrow('exact-integer limit');
    expect(accumulator.snapshot()[0].volume).toBe(0);
  });
});
