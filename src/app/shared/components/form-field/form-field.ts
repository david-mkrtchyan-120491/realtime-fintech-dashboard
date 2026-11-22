import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-form-field',
  templateUrl: './form-field.html',
  styleUrl: './form-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule
  ]
})
export class FormField {
  public readonly control = input.required<FormControl<number | null>>();
  public readonly fieldId = input.required<string>();
  public readonly label = input.required<string>();
  public readonly min = input.required<number>();
  public readonly max = input.required<number>();
  public readonly error = input<string | null>(null);
}
