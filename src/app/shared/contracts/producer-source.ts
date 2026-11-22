import type { Observable } from 'rxjs';
import type { ProducerSnapshot } from '@models';

export interface ProducerSession {
  pause(): void;
  resume(): void;
  dispose(): void;
}

export interface ProducerConnection extends ProducerSession {
  readonly messages: Observable<unknown>;
  start(): void;
}

export type ProducerSource<TSettings> = (settings: TSettings, runId: number) => ProducerConnection;

export type ProducerValidator<TData> = (value: unknown) => value is TData;

export interface ProducerListenOptions<TSettings, TData> {
  readonly source: ProducerSource<TSettings>;
  readonly validate: ProducerValidator<TData>;
  readonly settings: TSettings;
  readonly runId: number;
  readonly initializationTimeoutMs: number;
  readonly onSnapshot: (event: ProducerSnapshot<TData>) => void;
  readonly onError: (error: Error) => void;
}

export interface ProducerCommands<TCommand> {
  readonly start: TCommand;
  readonly pause: TCommand;
  readonly resume: TCommand;
}
