






import type {
  SamplingConfig,
  EvaluationTrigger,
  AccessibilityConfig
} from '../types';
import { EventEmitter } from '../engine/events';
import { throttle, debounce } from '../utils/timing';

export class DOMSampler extends EventEmitter {
  private config: SamplingConfig;
  private observers: Map<string, MutationObserver> = new Map();
  private intersectionObserver?: IntersectionObserver;
  private resizeObserver?: ResizeObserver;
  private performanceObserver?: PerformanceObserver;
  private samplingTimer?: number;
  private lastSampleTime = 0;
  private sampleCount = 0;
  private adaptiveInterval: number;
  private cpuMonitor: CPUMonitor;
  private eventHandlers: Map<string, Function | number> = new Map();
  
  constructor(config: SamplingConfig) {
    super();
    this.config = config;
    this.adaptiveInterval = config.interval;
    this.cpuMonitor = new CPUMonitor();
    
    
    this.initializeSampling();
  }
  
  


  private initializeSampling(): void {
    switch (this.config.strategy) {
      case 'fixed':
        this.setupFixedSampling();
        break;
        
      case 'adaptive':
        this.setupAdaptiveSampling();
        break;
        
      case 'event-driven':
        this.setupEventDrivenSampling();
        break;
        
      case 'hybrid':
        this.setupHybridSampling();
        break;
    }
    
    
    this.setupObservers();
  }
  
  


  private setupFixedSampling(): void {
    this.startSamplingTimer(this.config.interval);
  }
  
  


  private setupAdaptiveSampling(): void {
    
    this.startSamplingTimer(this.adaptiveInterval);
    
    
    this.cpuMonitor.on('usage', (usage: number) => {
      this.adjustSamplingRate(usage);
    });
    
    
    if ('memory' in performance) {
      this.monitorMemoryPressure();
    }
  }
  
  


  private setupEventDrivenSampling(): void {
    if (!this.config.triggers || this.config.triggers.length === 0) {
      console.warn('Event-driven sampling configured but no triggers specified');
      return;
    }
    
    this.config.triggers.forEach(trigger => {
      this.setupTrigger(trigger);
    });
  }
  
  


  private setupHybridSampling(): void {
    
    const hybridInterval = this.config.interval * 2;
    this.startSamplingTimer(hybridInterval);
    
    
    if (this.config.triggers) {
      this.config.triggers.forEach(trigger => {
        this.setupTrigger(trigger);
      });
    }
  }
  
  


  private setupTrigger(trigger: EvaluationTrigger): void {
    const handler = this.createTriggerHandler(trigger);
    
    switch (trigger.type) {
      case 'scroll':
        this.setupScrollTrigger(handler, trigger);
        break;
        
      case 'resize':
        this.setupResizeTrigger(handler, trigger);
        break;
        
      case 'mutation':
        this.setupMutationTrigger(handler, trigger);
        break;
        
      case 'focus':
        this.setupFocusTrigger(handler, trigger);
        break;
        
      case 'theme-change':
        this.setupThemeChangeTrigger(handler, trigger);
        break;
        
      case 'route-change':
        this.setupRouteChangeTrigger(handler, trigger);
        break;
    }
  }
  
  


  private createTriggerHandler(trigger: EvaluationTrigger): Function {
    const baseHandler = () => {
      this.emit('sample:triggered', { trigger: trigger.type });
      this.performSample('trigger', trigger.type);
    };
    
    if (trigger.debounce) {
      return debounce(baseHandler, trigger.debounce);
    } else if (trigger.throttle) {
      return throttle(baseHandler, trigger.throttle);
    }
    
    return baseHandler;
  }
  
  


  private setupScrollTrigger(handler: Function, trigger: EvaluationTrigger): void {
    const scrollHandler = () => {
      
      const scrollThreshold = trigger.options?.threshold || 100;
      const currentScroll = window.scrollY;
      const lastScroll = this.eventHandlers.get('lastScroll') as number || 0;
      
      if (Math.abs(currentScroll - lastScroll) > scrollThreshold) {
        this.eventHandlers.set('lastScroll', currentScroll);
        handler();
      }
    };
    
    window.addEventListener('scroll', scrollHandler, { passive: true });
    this.eventHandlers.set('scroll', scrollHandler);
  }
  
  


  private setupResizeTrigger(handler: Function, trigger: EvaluationTrigger): void {
    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        handler();
      });
      
      
      this.resizeObserver.observe(document.body);
    }
  }
  
  


  private setupMutationTrigger(handler: Function, trigger: EvaluationTrigger): void {
    const mutationHandler = throttle((mutations: MutationRecord[]) => {
      
      const significantMutations = mutations.filter(mutation => {
        
        if (mutation.type === 'attributes' && 
            mutation.attributeName?.startsWith('data-')) {
          return false;
        }
        
        
        if (mutation.type === 'characterData') {
          const parent = mutation.target.parentElement;
          if (parent?.tagName === 'SCRIPT' || parent?.tagName === 'STYLE') {
            return false;
          }
        }
        
        return true;
      });
      
      if (significantMutations.length > 0) {
        handler();
      }
    }, trigger.throttle || 500);
    
    
    const regions = this.config.regions || ['body'];
    regions.forEach((selector, index) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element, elementIndex) => {
        const observer = new MutationObserver(mutationHandler);
        observer.observe(element, {
          childList: true,
          attributes: true,
          characterData: true,
          subtree: true,
          attributeOldValue: true
        });
        
        this.observers.set(`mutation-${index}-${elementIndex}`, observer);
      });
    });
  }
  
  


  private setupFocusTrigger(handler: Function, trigger: EvaluationTrigger): void {
    const focusHandler = (event: FocusEvent) => {
      
      const target = event.target as Element;
      if (target && this.isInteractiveElement(target)) {
        handler();
      }
    };
    
    document.addEventListener('focusin', focusHandler, true);
    document.addEventListener('focusout', focusHandler, true);
    
    this.eventHandlers.set('focus', focusHandler);
  }
  
  


  private setupThemeChangeTrigger(handler: Function, trigger: EvaluationTrigger): void {
    
    const themeObserver = new MutationObserver((mutations) => {
      const hasThemeChange = mutations.some(mutation => {
        return mutation.type === 'attributes' && 
               (mutation.attributeName === 'class' || 
                mutation.attributeName === 'data-theme');
      });
      
      if (hasThemeChange) {
        handler();
      }
    });
    
    
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });
    
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });
    
    this.observers.set('theme', themeObserver);
    
    
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeQuery.addEventListener('change', () => handler());
  }
  
  


  private setupRouteChangeTrigger(handler: Function, trigger: EvaluationTrigger): void {
    
    window.addEventListener('popstate', () => handler());
    
    
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      handler();
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      handler();
    };
    
    this.eventHandlers.set('route', handler);
  }
  
  


  private setupObservers(): void {
    
    if (this.config.strategy === 'adaptive' || this.config.strategy === 'hybrid') {
      this.setupIntersectionObserver();
    }
    
    
    this.setupPerformanceObserver();
  }
  
  


  private setupIntersectionObserver(): void {
    const options = {
      root: null,
      rootMargin: '50px',
      threshold: [0, 0.25, 0.5, 0.75, 1]
    };
    
    this.intersectionObserver = new IntersectionObserver((entries) => {
      const visibleElements = entries.filter(entry => entry.isIntersecting);
      
      if (visibleElements.length > 0) {
        this.emit('viewport:changed', {
          visible: visibleElements.length,
          total: entries.length
        });
        
        
        if (this.config.strategy === 'adaptive') {
          const visibilityRatio = visibleElements.length / entries.length;
          this.adjustSamplingForVisibility(visibilityRatio);
        }
      }
    }, options);
    
    
    const keyElements = document.querySelectorAll(
      'main, section, article, nav, header, footer, [role="main"], [role="navigation"]'
    );
    
    keyElements.forEach(element => {
      this.intersectionObserver!.observe(element);
    });
  }
  
  


  private setupPerformanceObserver(): void {
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure' && entry.name.startsWith('a11y-')) {
            this.emit('performance:measure', {
              name: entry.name,
              duration: entry.duration
            });
          }
        }
      });
      
      this.performanceObserver.observe({ entryTypes: ['measure'] });
    }
  }
  
  


  private startSamplingTimer(interval: number): void {
    this.stopSamplingTimer();
    
    this.samplingTimer = window.setInterval(() => {
      this.performSample('interval');
    }, interval);
  }
  
  


  private stopSamplingTimer(): void {
    if (this.samplingTimer) {
      clearInterval(this.samplingTimer);
      this.samplingTimer = undefined;
    }
  }
  
  


  private performSample(source: string, detail?: string): void {
    const now = Date.now();
    const timeSinceLastSample = now - this.lastSampleTime;
    
    
    if (timeSinceLastSample < 100) {
      return;
    }
    
    this.lastSampleTime = now;
    this.sampleCount++;
    
    
    const elements = this.selectElements();
    
    
    this.emit('sample', {
      source,
      detail,
      timestamp: now,
      elements,
      sampleNumber: this.sampleCount
    });
  }
  
  


  private selectElements(): Element[] {
    const elements: Element[] = [];
    const { regions, exclude, maxElements } = this.config;
    
    
    if (regions && regions.length > 0) {
      regions.forEach(selector => {
        try {
          const regionElements = document.querySelectorAll(selector);
          elements.push(...Array.from(regionElements));
        } catch (error) {
          console.warn(`Invalid selector: ${selector}`, error);
        }
      });
    } else {
      
      const allElements = document.body.querySelectorAll('*');
      elements.push(...Array.from(allElements));
    }
    
    
    let filtered = elements;
    if (exclude && exclude.length > 0) {
      const excludeSelector = exclude.join(',');
      filtered = elements.filter(el => !el.matches(excludeSelector));
    }
    
    
    if (maxElements && filtered.length > maxElements) {
      filtered = this.prioritizeElements(filtered).slice(0, maxElements);
    }
    
    return filtered;
  }
  
  


  private prioritizeElements(elements: Element[]): Element[] {
    return elements.sort((a, b) => {
      const scoreA = this.calculatePriority(a);
      const scoreB = this.calculatePriority(b);
      return scoreB - scoreA;
    });
  }
  
  


  private calculatePriority(element: Element): number {
    let score = 0;
    
    
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      score += 20;
    }
    
    
    if (this.isInViewport(element)) {
      score += 30;
    }
    
    
    if (this.isInteractiveElement(element)) {
      score += 25;
    }
    
    
    if (this.isSemanticElement(element)) {
      score += 15;
    }
    
    
    if (this.hasAriaAttributes(element)) {
      score += 10;
    }
    
    return score;
  }
  
  


  private isInViewport(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    );
  }
  
  


  private isInteractiveElement(element: Element): boolean {
    const interactiveSelectors = [
      'a[href]',
      'button',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ];
    
    return element.matches(interactiveSelectors.join(','));
  }
  
  


  private isSemanticElement(element: Element): boolean {
    const semanticTags = [
      'HEADER', 'NAV', 'MAIN', 'ARTICLE', 'SECTION',
      'ASIDE', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'
    ];
    
    return semanticTags.includes(element.tagName);
  }
  
  


  private hasAriaAttributes(element: Element): boolean {
    const attributes = Array.from(element.attributes);
    return attributes.some(attr => 
      attr.name.startsWith('aria-') || attr.name === 'role'
    );
  }
  
  


  private adjustSamplingRate(cpuUsage: number): void {
    const baseInterval = this.config.interval;
    
    if (cpuUsage > 0.8) {
      
      this.adaptiveInterval = baseInterval * 3;
    } else if (cpuUsage > 0.5) {
      
      this.adaptiveInterval = baseInterval * 1.5;
    } else {
      
      this.adaptiveInterval = baseInterval;
    }
    
    
    if (this.samplingTimer) {
      this.startSamplingTimer(this.adaptiveInterval);
    }
    
    this.emit('sampling:adjusted', {
      cpuUsage,
      oldInterval: baseInterval,
      newInterval: this.adaptiveInterval
    });
  }
  
  


  private adjustSamplingForVisibility(visibilityRatio: number): void {
    const baseInterval = this.config.interval;
    
    if (visibilityRatio > 0.7) {
      
      this.adaptiveInterval = baseInterval * 0.8;
    } else if (visibilityRatio < 0.3) {
      
      this.adaptiveInterval = baseInterval * 1.2;
    }
    
    if (this.samplingTimer) {
      this.startSamplingTimer(this.adaptiveInterval);
    }
  }
  
  


  private monitorMemoryPressure(): void {
    setInterval(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        
        if (usageRatio > 0.9) {
          
          this.emit('memory:pressure', { high: true, ratio: usageRatio });
          this.adaptiveInterval = this.config.interval * 2;
          
          if (this.samplingTimer) {
            this.startSamplingTimer(this.adaptiveInterval);
          }
        }
      }
    }, 30000); 
  }
  
  


  getStats(): {
    sampleCount: number;
    currentInterval: number;
    lastSampleTime: number;
    strategy: string;
  } {
    return {
      sampleCount: this.sampleCount,
      currentInterval: this.adaptiveInterval,
      lastSampleTime: this.lastSampleTime,
      strategy: this.config.strategy
    };
  }
  
  


  updateConfig(config: Partial<SamplingConfig>): void {
    this.config = { ...this.config, ...config };
    
    
    this.destroy();
    this.initializeSampling();
  }
  
  


  destroy(): void {
    
    this.stopSamplingTimer();
    
    
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    
    this.eventHandlers.forEach((handler, event) => {
      if (event === 'scroll') {
        window.removeEventListener('scroll', handler as EventListener);
      } else if (event === 'focus') {
        document.removeEventListener('focusin', handler as EventListener, true);
        document.removeEventListener('focusout', handler as EventListener, true);
      }
    });
    
    this.eventHandlers.clear();
    
    
    this.cpuMonitor.destroy();
    
    this.removeAllListeners();
  }
}




class CPUMonitor extends EventEmitter {
  private interval?: number;
  private lastIdleTime = 0;
  private lastTotalTime = 0;
  
  constructor() {
    super();
    this.startMonitoring();
  }
  
  private startMonitoring(): void {
    
    let lastCheck = performance.now();
    
    this.interval = window.setInterval(() => {
      const now = performance.now();
      const actualDelay = now - lastCheck;
      const expectedDelay = 1000;
      
      
      const cpuLoad = Math.min(1, (actualDelay - expectedDelay) / expectedDelay);
      
      this.emit('usage', cpuLoad);
      lastCheck = now;
    }, 1000);
  }
  
  destroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.removeAllListeners();
  }
}
