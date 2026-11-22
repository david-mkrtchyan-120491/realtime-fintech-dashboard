import { ProducerMessageType, ProducerStatus } from '@enums';
import type { ProducerValidator } from '@contracts';
import type { ProducerEvent, ProducerMessage } from '@models';

export function isProducerMessage(value: unknown): value is ProducerMessage {
  if (typeof value !== 'object' || value === null || !('runId' in value)) {
    return false;
  }

  return Number.isSafeInteger(value.runId);
}

export function isProducerEvent<TData>(
  value: ProducerMessage,
  validate: ProducerValidator<TData>,
): value is ProducerEvent<TData> {
  if (!('type' in value)) {
    return false;
  }

  if (value.type === ProducerMessageType.Error) {
    return 'message' in value && typeof value.message === 'string';
  }

  return value.type === ProducerMessageType.Snapshot
    && 'status' in value
    && (value.status === ProducerStatus.Running || value.status === ProducerStatus.Paused)
    && 'snapshot' in value
    && validate(value.snapshot);
}

export function toProducerError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error('Something went wrong');
}
