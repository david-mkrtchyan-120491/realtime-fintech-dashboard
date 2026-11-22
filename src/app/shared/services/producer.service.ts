import { Injectable } from '@angular/core';
import type { Subscription } from 'rxjs';
import type { ProducerConnection, ProducerListenOptions, ProducerSession } from '@contracts';
import { ProducerMessageType } from '@enums';
import { isProducerMessage, isProducerEvent, toProducerError } from '@helpers';

@Injectable({
  providedIn: 'root'
})
export class ProducerService {
  public listen<TSettings, TData>(options: ProducerListenOptions<TSettings, TData>): ProducerSession {
    let connection: ProducerConnection | undefined;
    let subscription: Subscription | undefined;
    let initializationTimeout: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let initialized = false;

    const dispose = (): void => {
      if (disposed) {
        return;
      }

      disposed = true;
      clearTimeout(initializationTimeout);
      subscription?.unsubscribe();
      connection?.dispose();
    };

    const fail = (cause: unknown): void => {
      if (disposed) {
        return;
      }

      dispose();
      options.onError(toProducerError(cause));
    };

    const execute = (action: () => void): void => {
      if (disposed) {
        return;
      }

      try {
        action();
      } catch (error) {
        fail(error);
      }
    };

    const receive = (message: unknown): void => {
      if (!isProducerMessage(message)) {
        fail(new Error('The producer returned an invalid message.'));
        return;
      }

      if (message.runId !== options.runId) {
        return;
      }

      if (!isProducerEvent(message, options.validate)) {
        fail(new Error('The producer returned an invalid message.'));
        return;
      }

      if (message.type === ProducerMessageType.Error) {
        fail(new Error(message.message));
        return;
      }

      initialized = true;
      clearTimeout(initializationTimeout);
      options.onSnapshot(message);
    };

    execute(() => {
      connection = options.source(options.settings, options.runId);
      subscription = connection.messages.subscribe({
        next: message => execute(() => receive(message)),
        error: (error: unknown) => fail(error),
        complete: () => fail(new Error('The producer stopped unexpectedly.')),
      });

      if (disposed) {
        return;
      }

      if (!initialized) {
        initializationTimeout = setTimeout(() => {
          fail(new Error('The producer took too long to initialize. Please try again.'));
        }, options.initializationTimeoutMs);
      }

      connection.start();
    });

    return {
      pause: () => execute(() => connection?.pause()),
      resume: () => execute(() => connection?.resume()),
      dispose,
    };
  }
}
