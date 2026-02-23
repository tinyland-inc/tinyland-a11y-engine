




import type {
  EvaluationRule,
  EvaluationResult,
  EvaluationOptions,
  ElementReference,
  EvaluationContext,
  EvaluationPlugin,
  RuleResult
} from '../types';

export class EvaluationEngine {
  private rules: Map<string, EvaluationRule> = new Map();
  private plugins: Map<string, EvaluationPlugin> = new Map();
  private activeEvaluations: Set<AbortController> = new Set();
  private memoryLimit: number;
  private elementCache: WeakMap<Element, ElementReference> = new WeakMap();
  
  constructor(options: Partial<EvaluationOptions> = {}) {
    this.memoryLimit = options.memoryLimit || 50 * 1024 * 1024; 
    this.initializeDefaultPlugins();
  }

  


  registerPlugin(plugin: EvaluationPlugin): void {
    this.plugins.set(plugin.id, plugin);
    
    
    if (plugin.rules) {
      plugin.rules.forEach(rule => {
        this.registerRule(rule);
      });
    }

    
    if (plugin.initialize) {
      plugin.initialize(this);
    }
  }

  


  registerRule(rule: EvaluationRule): void {
    this.rules.set(rule.id, rule);
  }

  


  async evaluate(
    elements: Element[], 
    options: EvaluationOptions = {}
  ): Promise<EvaluationResult[]> {
    const abortController = new AbortController();
    this.activeEvaluations.add(abortController);

    try {
      const context = this.createContext(options, abortController.signal);
      const results: EvaluationResult[] = [];

      
      const sampled = await this.applySampling(elements, options);

      
      const chunkSize = options.chunkSize || 50;
      for (let i = 0; i < sampled.length; i += chunkSize) {
        if (abortController.signal.aborted) break;

        const chunk = sampled.slice(i, i + chunkSize);
        const chunkResults = await this.evaluateChunk(chunk, context);
        results.push(...chunkResults);

        
        if (this.isMemoryExceeded()) {
          console.warn('Memory limit exceeded, stopping evaluation');
          break;
        }

        
        await this.yieldToMain();
      }

      return results;
    } finally {
      this.activeEvaluations.delete(abortController);
    }
  }

  


  cancelAll(): void {
    this.activeEvaluations.forEach(controller => controller.abort());
    this.activeEvaluations.clear();
  }

  


  private async applySampling(
    elements: Element[],
    options: EvaluationOptions
  ): Promise<Element[]> {
    if (!options.sampling) return elements;

    
    const strategy = options.sampling.type || options.sampling.strategy || 'viewport';
    const rate = options.sampling.rate || 1.0;

    switch (strategy) {
      case 'viewport':
        return this.viewportSampling(elements, rate);
      case 'random':
        return this.randomSampling(elements, rate);
      case 'priority':
        return this.prioritySampling(elements, rate);
      case 'adaptive':
        return this.viewportSampling(elements, rate); 
      default:
        return elements;
    }
  }

  


  private viewportSampling(elements: Element[], rate: number): Element[] {
    const viewport = {
      top: window.scrollY,
      bottom: window.scrollY + window.innerHeight,
      left: window.scrollX,
      right: window.scrollX + window.innerWidth
    };

    const scored = elements.map(el => {
      const rect = el.getBoundingClientRect();
      const inViewport = 
        rect.top < viewport.bottom &&
        rect.bottom > viewport.top &&
        rect.left < viewport.right &&
        rect.right > viewport.left;

      const score = inViewport ? 1 : 0.1;
      return { element: el, score };
    });

    
    scored.sort((a, b) => b.score - a.score);
    const sampleSize = Math.ceil(elements.length * rate);
    return scored.slice(0, sampleSize).map(s => s.element);
  }

  


  private randomSampling(elements: Element[], rate: number): Element[] {
    const sampleSize = Math.ceil(elements.length * rate);
    const shuffled = [...elements].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, sampleSize);
  }

  


  private prioritySampling(elements: Element[], rate: number): Element[] {
    const scored = elements.map(el => {
      let score = 0;
      
      
      if (el.matches('a, button, input, select, textarea')) score += 3;
      
      
      if (el.hasAttribute('role') || el.hasAttribute('aria-label')) score += 2;
      
      
      if (el.matches('h1, h2, h3, h4, h5, h6')) score += 2;
      
      
      if (el.matches('form, label')) score += 1;

      return { element: el, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const sampleSize = Math.ceil(elements.length * rate);
    return scored.slice(0, sampleSize).map(s => s.element);
  }

  


  private async evaluateChunk(
    elements: Element[], 
    context: EvaluationContext
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];

    for (const element of elements) {
      if (context.signal.aborted) break;

      const elementRef = this.createElementReference(element);
      const elementResults = await this.evaluateElement(element, elementRef, context);
      results.push(...elementResults);
    }

    return results;
  }

  


  private async evaluateElement(
    element: Element,
    elementRef: ElementReference,
    context: EvaluationContext
  ): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];
    const applicableRules = this.getApplicableRules(element, context);

    for (const rule of applicableRules) {
      if (context.signal.aborted) break;

      try {
        const result = await rule.evaluate(element, context);
        if (result) {
          
          const isFullResult = 'id' in result && 'type' in result && 'wcagLevel' in result && 'selector' in result;

          if (isFullResult) {
            
            results.push({
              ...result as EvaluationResult,
              ruleId: rule.id,
              element: elementRef,
              timestamp: Date.now()
            });
          } else {
            
            const ruleResult = result as RuleResult;
            const wcagCriteria = Array.isArray(ruleResult.wcagCriteria)
              ? ruleResult.wcagCriteria[0] || ''
              : ruleResult.wcagCriteria || '';

            results.push({
              id: `${rule.id}-${Date.now()}`,
              type: ruleResult.category === 'contrast' ? 'contrast' :
                    ruleResult.category === 'aria' ? 'aria' :
                    ruleResult.category === 'keyboard' ? 'keyboard' :
                    ruleResult.severity === 'error' ? 'error' : 'warning',
              severity: ruleResult.severity,
              wcagLevel: 'AA',
              wcagCriteria,
              selector: elementRef.selector,
              message: ruleResult.message,
              ruleId: rule.id,
              element: elementRef,
              timestamp: Date.now(),
              details: ruleResult.details
            });
          }
        }
      } catch (error) {
        console.error(`Rule ${rule.id} failed:`, error);
      }
    }

    return results;
  }

  


  private getApplicableRules(
    element: Element, 
    context: EvaluationContext
  ): EvaluationRule[] {
    const rules: EvaluationRule[] = [];

    for (const rule of this.rules.values()) {
      if (context.ruleFilter && !context.ruleFilter.includes(rule.id)) {
        continue;
      }

      if (rule.selector && !element.matches(rule.selector)) {
        continue;
      }

      if (rule.condition && !rule.condition(element, context)) {
        continue;
      }

      rules.push(rule);
    }

    return rules;
  }

  


  private createElementReference(element: Element): ElementReference {
    
    const cached = this.elementCache.get(element);
    if (cached) return cached;

    
    const selector = this.generateSelector(element);
    
    
    const ref: ElementReference = {
      selector,
      tagName: element.tagName.toLowerCase(),
      attributes: this.getRelevantAttributes(element),
      text: this.getVisibleText(element).slice(0, 100),
      bounds: element.getBoundingClientRect()
    };

    
    this.elementCache.set(element, ref);
    
    return ref;
  }

  


  private generateSelector(element: Element): string {
    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector = `#${current.id}`;
        path.unshift(selector);
        break;
      }

      if (current.className) {
        const classes = Array.from(current.classList)
          .filter(c => !c.startsWith('a11y-'))
          .join('.');
        if (classes) selector += `.${classes}`;
      }

      const siblings = current.parentElement?.children;
      if (siblings && siblings.length > 1) {
        const index = Array.from(siblings).indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  


  private getRelevantAttributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    const relevant = [
      'role', 'aria-label', 'aria-labelledby', 'aria-describedby',
      'alt', 'title', 'placeholder', 'name', 'type', 'href'
    ];

    for (const attr of relevant) {
      const value = element.getAttribute(attr);
      if (value) attrs[attr] = value;
    }

    return attrs;
  }

  


  private getVisibleText(element: Element): string {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const texts: string[] = [];
    let node: Node | null;

    while ((node = walker.nextNode()) && texts.join(' ').length < 200) {
      const text = node.textContent?.trim();
      if (text) texts.push(text);
    }

    return texts.join(' ');
  }

  


  private createContext(
    options: EvaluationOptions,
    signal: AbortSignal
  ): EvaluationContext {
    return {
      options,
      signal,
      ruleFilter: options.ruleFilter,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      },
      timestamp: Date.now(),
      document: document,
      window: window
    };
  }

  


  private isMemoryExceeded(): boolean {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize > this.memoryLimit;
    }
    return false;
  }

  


  private yieldToMain(): Promise<void> {
    return new Promise(resolve => {
      if ('scheduler' in window && 'yield' in (window as any).scheduler) {
        (window as any).scheduler.yield().then(resolve);
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  


  private initializeDefaultPlugins(): void {
    
  }
}
