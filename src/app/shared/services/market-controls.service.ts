import { Injectable, computed, inject } from '@angular/core';
import { ProducerStatus } from '@enums';
import { MarketProducerService } from './market-producer.service';

@Injectable({
  providedIn: 'root'
})
export class MarketControlsService {
  private readonly producer = inject(MarketProducerService);

  public readonly controls = computed(() => {
    const { status, settings } = this.producer.state();
    const resumeAction = status === ProducerStatus.Paused || status === ProducerStatus.Resuming;

    return {
      settings,
      resumeAction,
      actionLabel: resumeAction ? 'Resume' : 'Pause',
      canToggle: status === ProducerStatus.Running || status === ProducerStatus.Paused,
      isPending: [ProducerStatus.Loading, ProducerStatus.Pausing, ProducerStatus.Resuming].includes(status),
      isPaused: status === ProducerStatus.Paused,
      isError: status === ProducerStatus.Error,
      statusLabel: {
        [ProducerStatus.Loading]: 'Starting simulation',
        [ProducerStatus.Running]: 'Simulation running',
        [ProducerStatus.Pausing]: 'Pausing simulation…',
        [ProducerStatus.Paused]: 'Simulation paused',
        [ProducerStatus.Resuming]: 'Resuming simulation…',
        [ProducerStatus.Error]: 'Simulation stopped',
      }[status],
    };
  });

  public toggle(): void {
    if (this.producer.state().status === ProducerStatus.Paused) {
      this.producer.resume();
    } else {
      this.producer.pause();
    }
  }
}
