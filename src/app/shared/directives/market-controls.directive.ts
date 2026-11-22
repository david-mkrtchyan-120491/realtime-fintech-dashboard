import { Directive, inject } from '@angular/core';
import { MarketControlsService } from '@services';

@Directive({
  selector: '[appMarketControls]',
  exportAs: 'marketControls'
})
export class MarketControlsDirective {
  private readonly service = inject(MarketControlsService);
  public readonly controls = this.service.controls;

  public toggle(): void {
    this.service.toggle();
  }
}
