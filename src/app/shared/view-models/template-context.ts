import type { TemplateRef } from '@angular/core';

export interface TemplateContext<TData> {
  $implicit: TData;
}

export interface ContextState<TData> {
  readonly data: TData;
  readonly pending: boolean;
  readonly empty: boolean;
  readonly error: boolean;
}

export interface ContextFallbackTemplates<TData> {
  readonly pending: TemplateRef<TemplateContext<TData>>;
  readonly empty: TemplateRef<TemplateContext<TData>>;
  readonly error: TemplateRef<TemplateContext<TData>>;
}
