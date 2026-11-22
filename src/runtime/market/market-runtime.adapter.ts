import './generated/wasm_exec.js';
import type { MarketGenerator } from './market-generator.interface';
import type { StockUpdate } from '@models';
import { isStockUpdate } from '@helpers';

interface GoRuntime {
  readonly importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

interface GoBindings {
  Go: new () => GoRuntime;
  marketReady?: () => void;
  marketNextBatch?: (symbols: readonly string[], size: number) => unknown;
}

export class MarketRuntimeAdapter implements MarketGenerator {
  private readonly bindings = globalThis as typeof globalThis & GoBindings;
  private ready = false;

  public async initialize(wasmUrl: string, onFailure: (error: Error) => void): Promise<void> {
    const go = new this.bindings.Go();
    const response = await fetch(wasmUrl);

    if (!response.ok) {
      throw new Error(`Could not load market.wasm (HTTP ${response.status}).`);
    }

    const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), go.importObject);

    try {
      await new Promise<void>((resolve, reject) => {
        this.bindings.marketReady = resolve;

        const fail = (cause: unknown) => {
          const error = cause instanceof Error ? cause : new Error('The Go market runtime failed.');

          this.ready = false;
          reject(error);
          onFailure(error);
        };

        void go.run(instance).then(
          () => fail(new Error('The Go market runtime stopped unexpectedly.')),
          fail,
        );
      });
    } finally {
      delete this.bindings.marketReady;
    }

    if (!this.bindings.marketNextBatch) {
      throw new Error('Go did not register its batch generator.');
    }

    this.ready = true;
  }

  public nextBatch(symbols: readonly string[], size: number): readonly StockUpdate[] {
    if (!this.ready || !this.bindings.marketNextBatch) {
      throw new Error('The Go market runtime is not ready.');
    }

    const batch = this.bindings.marketNextBatch(symbols, size);

    if (!Array.isArray(batch)) {
      if (
        typeof batch === 'object'
        && batch !== null
        && 'error' in batch
        && typeof batch.error === 'string'
      ) {
        throw new Error(batch.error);
      }

      throw new Error('Go returned an unreadable trade batch.');
    }

    if (batch.length !== size) {
      throw new Error(`Expected ${size} trades, received ${batch.length}.`);
    }

    if (!batch.every(isStockUpdate)) {
      throw new Error('Go returned an invalid trade or quote.');
    }

    return batch;
  }
}
