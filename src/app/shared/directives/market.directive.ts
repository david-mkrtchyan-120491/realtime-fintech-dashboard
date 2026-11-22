import { Directive, TemplateRef, inject, input } from '@angular/core';
import type { OnInit } from '@angular/core';
import { ContextService, MarketContextService } from '@services';
import type { MarketTemplateContext } from '@view-models';

@Directive({
  selector: '[appMarket]',
  providers: [
    ContextService,
    MarketContextService
  ]
})
export class MarketDirective implements OnInit {
  public readonly appMarketOnPending = input.required<TemplateRef<MarketTemplateContext>>();
  public readonly appMarketOnEmpty = input.required<TemplateRef<MarketTemplateContext>>();
  public readonly appMarketOnError = input.required<TemplateRef<MarketTemplateContext>>();
  private readonly template = inject<TemplateRef<MarketTemplateContext>>(TemplateRef);
  private readonly market = inject(MarketContextService);
  private readonly renderer = inject(ContextService);

  public ngOnInit(): void {
    this.renderer.render(this.template, this.market.response, () => ({
      pending: this.appMarketOnPending(),
      empty: this.appMarketOnEmpty(),
      error: this.appMarketOnError(),
    }));
  }

  public static ngTemplateContextGuard(
    _directive: MarketDirective,
    _context: unknown,
  ): _context is MarketTemplateContext {
    return true;
  }
}
