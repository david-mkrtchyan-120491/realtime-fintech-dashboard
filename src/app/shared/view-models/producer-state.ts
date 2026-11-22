import type { ProducerStatus } from '@enums';
import type { MarketSnapshot, ProducerSettings } from '@models';

interface ProducerStateBase extends MarketSnapshot {
  readonly runId: number;
  readonly settings: ProducerSettings;
}

interface ActiveProducerState extends ProducerStateBase {
  readonly status: Exclude<ProducerStatus, ProducerStatus.Error>;
}

interface FailedProducerState extends ProducerStateBase {
  readonly status: ProducerStatus.Error;
  readonly message: string;
}

export type ProducerState = ActiveProducerState | FailedProducerState;
