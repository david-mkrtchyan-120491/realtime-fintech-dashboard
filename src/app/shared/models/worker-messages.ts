import type { ProducerMessageType } from '@enums';
import type { ProducerSettings, SettingsLimits } from './producer-settings';
import type { MarketSnapshot } from './market-snapshot';
import type { ProducerMessage, ProducerSnapshot, ProducerFailure, ProducerEvent } from './producer-event';

export interface InitializeWorkerRequest extends ProducerMessage {
  readonly type: ProducerMessageType.Initialize;
  readonly settings: ProducerSettings;
  readonly limits: SettingsLimits;
  readonly wasmUrl: string;
}

export interface PauseWorkerRequest extends ProducerMessage {
  readonly type: ProducerMessageType.Pause;
}

export interface ResumeWorkerRequest extends ProducerMessage {
  readonly type: ProducerMessageType.Resume;
}

export type WorkerRequest = InitializeWorkerRequest | PauseWorkerRequest | ResumeWorkerRequest;

export type SnapshotWorkerResponse = ProducerSnapshot<MarketSnapshot>;
export type ErrorWorkerResponse = ProducerFailure;
export type WorkerResponse = ProducerEvent<MarketSnapshot>;
