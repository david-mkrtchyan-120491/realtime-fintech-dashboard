import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { FormField } from '@components/form-field/form-field';
import { MARKET_CONFIG } from '@config';
import { isInteger } from '@helpers';
import { SettingsPolicy } from '@policies';
import type { SettingsField } from '@models';
import { MarketProducerService } from '@services';

const wholeNumber: ValidatorFn = control =>
  control.value === null || isInteger(control.value) ? null : { wholeNumber: true };

@Component({
  selector: 'app-settings',
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FormField
  ]
})
export class Settings {
  private readonly producer = inject(MarketProducerService);
  private readonly settingsPolicy = inject(SettingsPolicy);
  private readonly router = inject(Router);
  protected readonly fields: readonly SettingsField[] = ['instrumentCount', 'updatesPerBatch', 'intervalMs'];
  protected readonly limits = inject(MARKET_CONFIG).limits;
  protected readonly form = new FormGroup({
    instrumentCount: this.createControl('instrumentCount'),
    updatesPerBatch: this.createControl('updatesPerBatch'),
    intervalMs: this.createControl('intervalMs'),
  });
  private readonly draft = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  private readonly formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  protected readonly canApply = computed(() => this.formStatus() === 'VALID');
  protected readonly errors = computed(() => {
    this.draft();

    return {
      instrumentCount: this.fieldError('instrumentCount'),
      updatesPerBatch: this.fieldError('updatesPerBatch'),
      intervalMs: this.fieldError('intervalMs'),
    };
  });

  protected apply(): void {
    const settings = this.form.getRawValue();

    if (this.form.invalid || !this.settingsPolicy.isValid(settings)) {
      return;
    }

    this.producer.apply(settings);
    void this.router.navigate(['/']);
  }

  private createControl(field: SettingsField): FormControl<number | null> {
    const { min, max } = this.limits[field];

    return new FormControl(this.producer.state().settings[field], [
      Validators.required,
      wholeNumber,
      Validators.min(min),
      Validators.max(max),
    ]);
  }

  private fieldError(field: SettingsField): string | null {
    const control = this.form.controls[field];
    const { label, min, max } = this.limits[field];

    if (control.hasError('required')) {
      return `${label} is required.`;
    }

    if (control.hasError('wholeNumber')) {
      return `${label} must be a whole number.`;
    }

    if (control.hasError('min') || control.hasError('max')) {
      return `${label} must be between ${min} and ${max}, inclusive.`;
    }

    return null;
  }
}
