import { Injectable, Injector, ViewContainerRef, effect, inject } from '@angular/core';
import type { EmbeddedViewRef, TemplateRef } from '@angular/core';
import type { ContextFallbackTemplates, ContextState, TemplateContext } from '@view-models';

@Injectable()
export class ContextService {
  private readonly container = inject(ViewContainerRef);
  private readonly injector = inject(Injector);

  public render<TData>(
    content: TemplateRef<TemplateContext<TData>>,
    response: () => ContextState<TData>,
    templates: () => ContextFallbackTemplates<TData>,
  ): void {
    let activeTemplate: TemplateRef<TemplateContext<TData>> | undefined;
    let view: EmbeddedViewRef<TemplateContext<TData>> | undefined;

    effect(() => {
      const { data, pending, empty, error } = response();
      const views = templates();
      let template = content;

      if (error) {
        template = views.error;
      } else if (pending) {
        template = views.pending;
      } else if (empty) {
        template = views.empty;
      }

      if (template !== activeTemplate) {
        this.container.clear();
        view = this.container.createEmbeddedView(template, { $implicit: data });
        activeTemplate = template;
      } else if (view) {
        view.context.$implicit = data;
        view.markForCheck();
      }
    }, { injector: this.injector });
  }
}
