import { Injectable, inject, signal } from '@angular/core';
import type { OnDestroy } from '@angular/core';
import { MARKET_CONFIG, MARKET_SOURCE, MARKET_SNAPSHOT_VALIDATOR } from '@config';
import type { ProducerSession } from '@contracts';
import { ProducerStatus } from '@enums';
import { createInitialProducerState } from '@helpers';
import type { MarketSnapshot, ProducerSettings, ProducerSnapshot } from '@models';
import { SettingsPolicy } from '@policies';
import type { ProducerState } from '@view-models';
import { ProducerService } from './producer.service';

@Injectable({
  providedIn: 'root'
})
export class MarketProducerService implements OnDestroy {
  private readonly config = inject(MARKET_CONFIG);
  private readonly settingsPolicy = inject(SettingsPolicy);
  private readonly source = inject(MARKET_SOURCE);
  private readonly validate = inject(MARKET_SNAPSHOT_VALIDATOR);
  private readonly producer = inject(ProducerService);
  private readonly current = signal<ProducerState>(createInitialProducerState(this.config.defaults, 0));
  public readonly state = this.current.asReadonly();
  private session?: ProducerSession;

  public start(): void {
    if (this.current().runId === 0) {
      this.apply(this.config.defaults);
    }
  }

  public ngOnDestroy(): void {
    this.session?.dispose();
  }

  public retry(): void {
    this.apply(this.current().settings);
  }

  public pause(): void {
    const state = this.current();

    if (state.status !== ProducerStatus.Running) {
      return;
    }

    this.current.set({
      ...state,
      status: ProducerStatus.Pausing,
    });
    this.session?.pause();
  }

  public resume(): void {
    const state = this.current();

    if (state.status !== ProducerStatus.Paused) {
      return;
    }

    this.current.set({
      ...state,
      status: ProducerStatus.Resuming,
    });
    this.session?.resume();
  }

  public apply(settings: ProducerSettings): void {
    if (!this.settingsPolicy.isValid(settings)) {
      throw new Error('Invalid simulation settings.');
    }

    const runId = this.current().runId + 1;
    const appliedSettings = Object.freeze({ ...settings });

    this.session?.dispose();
    this.current.set(createInitialProducerState(appliedSettings, runId));

    this.session = this.producer.listen({
      source: this.source,
      validate: this.validate,
      settings: appliedSettings,
      runId,
      initializationTimeoutMs: this.config.runtime.initializationTimeoutMs,
      onSnapshot: event => this.updateSnapshot(event),
      onError: error => this.fail(error),
    });
  }

  private updateSnapshot(event: ProducerSnapshot<MarketSnapshot>): void {
    const state = this.current();
    let status: ProducerStatus = event.status;

    if (state.status === ProducerStatus.Pausing && event.status === ProducerStatus.Running) {
      status = ProducerStatus.Pausing;
    } else if (state.status === ProducerStatus.Resuming && event.status === ProducerStatus.Paused) {
      status = ProducerStatus.Resuming;
    }

    this.current.set({
      ...state,
      status,
      ...event.snapshot,
    });
  }

  private fail(error: Error): void {
    this.current.set({
      ...this.current(),
      status: ProducerStatus.Error,
      message: error.message,
    });
  }
}
