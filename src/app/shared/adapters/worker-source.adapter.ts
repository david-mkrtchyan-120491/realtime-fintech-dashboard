import { Subject } from 'rxjs';
import type { ProducerCommands, ProducerConnection } from '@contracts';

export function connectWorker<TCommand>(
  createWorker: () => Worker,
  commands: ProducerCommands<TCommand>,
): ProducerConnection {
  const worker = createWorker();
  const messages = new Subject<unknown>();
  let disposed = false;

  worker.onmessage = ({ data }: MessageEvent<unknown>) => {
    messages.next(data);
  };

  worker.onerror = (event) => {
    event.preventDefault();
    messages.error(new Error(event.message || 'The worker could not start.'));
  };

  worker.onmessageerror = () => {
    messages.error(new Error('The worker returned an unreadable message.'));
  };

  const send = (command: TCommand): void => {
    if (disposed) {
      return;
    }

    worker.postMessage(command);
  };

  return {
    messages: messages.asObservable(),
    start: () => send(commands.start),
    pause: () => send(commands.pause),
    resume: () => send(commands.resume),
    dispose: () => {
      if (disposed) {
        return;
      }

      disposed = true;
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      messages.complete();
    },
  };
}
