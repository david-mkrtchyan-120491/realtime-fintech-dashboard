import type { MarketGenerator } from './market-generator.interface';
import { MarketRuntimeAdapter } from './market-runtime.adapter';

export async function createMarketGenerator(wasmUrl: string, onFailure: (error: Error) => void): Promise<MarketGenerator> {
  const market = new MarketRuntimeAdapter();

  await market.initialize(wasmUrl, onFailure);

  return market;
}
