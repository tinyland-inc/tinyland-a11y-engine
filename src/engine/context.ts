



import type { AccessibilityConfig, EvaluationContext, EvaluationOptions, ViewportInfo } from '../types';

export class ContextBuilder {
  async build(config: AccessibilityConfig, _elements?: Element[]): Promise<EvaluationContext> {
    const viewport: ViewportInfo = {
      width: typeof window !== 'undefined' ? window.innerWidth : 1024,
      height: typeof window !== 'undefined' ? window.innerHeight : 768,
      scrollX: typeof window !== 'undefined' ? window.scrollX : 0,
      scrollY: typeof window !== 'undefined' ? window.scrollY : 0
    };

    const options: EvaluationOptions = {
      timeout: 30000,
      ruleFilter: []
    };

    return {
      options,
      signal: new AbortController().signal,
      viewport,
      timestamp: Date.now(),
      document: typeof document !== 'undefined' ? document : {} as Document,
      window: typeof window !== 'undefined' ? window : {} as Window
    };
  }
}
