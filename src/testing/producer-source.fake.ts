import { Subject } from 'rxjs';
import { vi } from 'vitest';
import type { ProducerConnection } from '@contracts';

export class FakeProducerConnection implements ProducerConnection {
  public readonly messages = new Subject<object>();
  public readonly start = vi.fn<() => void>();
  public readonly pause = vi.fn<() => void>();
  public readonly resume = vi.fn<() => void>();
  public readonly dispose = vi.fn<() => void>();
}
