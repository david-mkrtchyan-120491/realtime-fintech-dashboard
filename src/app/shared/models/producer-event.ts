import type { ProducerMessageType, ProducerStatus } from '@enums';

export interface ProducerMessage {
  readonly runId: number;
}

export interface ProducerSnapshot<TData> extends ProducerMessage {
  readonly type: ProducerMessageType.Snapshot;
  readonly status: ProducerStatus.Running | ProducerStatus.Paused;
  readonly snapshot: TData;
}

export interface ProducerFailure extends ProducerMessage {
  readonly type: ProducerMessageType.Error;
  readonly message: string;
}

export type ProducerEvent<TData> = ProducerSnapshot<TData> | ProducerFailure;
