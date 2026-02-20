/**
 * DOM Sampler
 * 
 * Efficient DOM sampling strategies that minimize performance impact
 * while ensuring comprehensive accessibility coverage.
 */

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
    
    // Set up sampling based on strategy
    this.initializeSampling();
  }
  
  /**
   * Initialize sampling based on configured strategy
   */
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
    
    // Set up common observers
    this.setupObservers();
  }
  
  /**
   * Set up fixed interval sampling
   */
  private setupFixedSampling(): void {
    this.startSamplingTimer(this.config.interval);
  }
  
  /**
   * Set up adaptive sampling that adjusts based on system resources
   */
  private setupAdaptiveSampling(): void {
    // Start with base interval
    this.startSamplingTimer(this.adaptiveInterval);
    
    // Monitor CPU usage and adjust
    this.cpuMonitor.on('usage', (usage: number) => {
      this.adjustSamplingRate(usage);
    });
    
    // Monitor memory pressure
    if ('memory' in performance) {
      this.monitorMemoryPressure();
    }
  }
  
  /**
   * Set up event-driven sampling
   */
  private setupEventDrivenSampling(): void {
    if (!this.config.triggers || this.config.triggers.length === 0) {
      console.warn('Event-driven sampling configured but no triggers specified');
      return;
    }
    
    this.config.triggers.forEach(trigger => {
      this.setupTrigger(trigger);
    });
  }
  
  /**
   * Set up hybrid sampling (combines interval and event-driven)
   */
  private setupHybridSampling(): void {
    // Use a longer interval for hybrid mode
    const hybridInterval = this.config.interval * 2;
    this.startSamplingTimer(hybridInterval);
    
    // Also set up event triggers
    if (this.config.triggers) {
      this.config.triggers.forEach(trigger => {
        this.setupTrigger(trigger);
      });
    }
  }
  
  /**
   * Set up a specific trigger
   */
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
  
  /**
   * Create trigger handler with debounce/throttle
   */
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
  
  /**
   * Set up scroll trigger
   */
  private setupScrollTrigger(handler: Function, trigger: EvaluationTrigger): void {
    const scrollHandler = () => {
      // Only trigger if scroll is significant
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
  
  /**
   * Set up resize trigger
   */
  private setupResizeTrigger(handler: Function, trigger: EvaluationTrigger): void {
    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        handler();
      });
      
      // Observe body for overall page resizes
      this.resizeObserver.observe(document.body);
    }
  }
  
  /**
   * Set up mutation trigger
   */
  private setupMutationTrigger(handler: Function, trigger: EvaluationTrigger): void {
    const mutationHandler = throttle((mutations: MutationRecord[]) => {
      // Filter out insignificant mutations
      const significantMutations = mutations.filter(mutation => {
        // Skip attribute changes to data-* attributes
        if (mutation.type === 'attributes' && 
            mutation.attributeName?.startsWith('data-')) {
          return false;
        }
        
        // Skip text changes in script/style elements
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
    
    // Set up mutation observers for each region
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
  
  /**
   * Set up focus trigger
   */
  private setupFocusTrigger(handler: Function, trigger: EvaluationTrigger): void {
    const focusHandler = (event: FocusEvent) => {
      // Only trigger for interactive elements
      const target = event.target as Element;
      if (target && this.isInteractiveElement(target)) {
        handler();
      }
    };
    
    document.addEventListener('focusin', focusHandler, true);
    document.addEventListener('focusout', focusHandler, true);
    
    this.eventHandlers.set('focus', focusHandler);
  }
  
  /**
   * Set up theme change trigger
   */
  private setupThemeChangeTrigger(handler: Function, trigger: EvaluationTrigger): void {
    // Watch for class changes on root elements
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
    
    // Observe html and body for theme changes
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });
    
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });
    
    this.observers.set('theme', themeObserver);
    
    // Also listen for media query changes
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeQuery.addEventListener('change', () => handler());
  }
  
  /**
   * Set up route change trigger
   */
  private setupRouteChangeTrigger(handler: Function, trigger: EvaluationTrigger): void {
    // Listen for popstate (browser navigation)
    window.addEventListener('popstate', () => handler());
    
    // Override pushState and replaceState
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
  
  /**
   * Set up common observers
   */
  private setupObservers(): void {
    // Intersection observer for viewport visibility
    if (this.config.strategy === 'adaptive' || this.config.strategy === 'hybrid') {
      this.setupIntersectionObserver();
    }
    
    // Performance observer for monitoring
    this.setupPerformanceObserver();
  }
  
  /**
   * Set up intersection observer for viewport tracking
   */
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
        
        // Increase sampling rate when more elements are visible
        if (this.config.strategy === 'adaptive') {
          const visibilityRatio = visibleElements.length / entries.length;
          this.adjustSamplingForVisibility(visibilityRatio);
        }
      }
    }, options);
    
    // Observe key elements
    const keyElements = document.querySelectorAll(
      'main, section, article, nav, header, footer, [role="main"], [role="navigation"]'
    );
    
    keyElements.forEach(element => {
      this.intersectionObserver!.observe(element);
    });
  }
  
  /**
   * Set up performance observer
   */
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
  
  /**
   * Start sampling timer
   */
  private startSamplingTimer(interval: number): void {
    this.stopSamplingTimer();
    
    this.samplingTimer = window.setInterval(() => {
      this.performSample('interval');
    }, interval);
  }
  
  /**
   * Stop sampling timer
   */
  private stopSamplingTimer(): void {
    if (this.samplingTimer) {
      clearInterval(this.samplingTimer);
      this.samplingTimer = undefined;
    }
  }
  
  /**
   * Perform a sample
   */
  private performSample(source: string, detail?: string): void {
    const now = Date.now();
    const timeSinceLastSample = now - this.lastSampleTime;
    
    // Prevent too frequent sampling
    if (timeSinceLastSample < 100) {
      return;
    }
    
    this.lastSampleTime = now;
    this.sampleCount++;
    
    // Get elements to sample
    const elements = this.selectElements();
    
    // Emit sample event
    this.emit('sample', {
      source,
      detail,
      timestamp: now,
      elements,
      sampleNumber: this.sampleCount
    });
  }
  
  /**
   * Select elements for sampling
   */
  private selectElements(): Element[] {
    const elements: Element[] = [];
    const { regions, exclude, maxElements } = this.config;
    
    // Get elements from specified regions
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
      // Default to all elements in body
      const allElements = document.body.querySelectorAll('*');
      elements.push(...Array.from(allElements));
    }
    
    // Apply exclusions
    let filtered = elements;
    if (exclude && exclude.length > 0) {
      const excludeSelector = exclude.join(',');
      filtered = elements.filter(el => !el.matches(excludeSelector));
    }
    
    // Prioritize elements if we have a limit
    if (maxElements && filtered.length > maxElements) {
      filtered = this.prioritizeElements(filtered).slice(0, maxElements);
    }
    
    return filtered;
  }
  
  /**
   * Prioritize elements for sampling
   */
  private prioritizeElements(elements: Element[]): Element[] {
    return elements.sort((a, b) => {
      const scoreA = this.calculatePriority(a);
      const scoreB = this.calculatePriority(b);
      return scoreB - scoreA;
    });
  }
  
  /**
   * Calculate element priority
   */
  private calculatePriority(element: Element): number {
    let score = 0;
    
    // Visible elements
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      score += 20;
    }
    
    // In viewport
    if (this.isInViewport(element)) {
      score += 30;
    }
    
    // Interactive elements
    if (this.isInteractiveElement(element)) {
      score += 25;
    }
    
    // Semantic elements
    if (this.isSemanticElement(element)) {
      score += 15;
    }
    
    // Has ARIA attributes
    if (this.hasAriaAttributes(element)) {
      score += 10;
    }
    
    return score;
  }
  
  /**
   * Check if element is in viewport
   */
  private isInViewport(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    );
  }
  
  /**
   * Check if element is interactive
   */
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
  
  /**
   * Check if element is semantic
   */
  private isSemanticElement(element: Element): boolean {
    const semanticTags = [
      'HEADER', 'NAV', 'MAIN', 'ARTICLE', 'SECTION',
      'ASIDE', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'
    ];
    
    return semanticTags.includes(element.tagName);
  }
  
  /**
   * Check if element has ARIA attributes
   */
  private hasAriaAttributes(element: Element): boolean {
    const attributes = Array.from(element.attributes);
    return attributes.some(attr => 
      attr.name.startsWith('aria-') || attr.name === 'role'
    );
  }
  
  /**
   * Adjust sampling rate based on CPU usage
   */
  private adjustSamplingRate(cpuUsage: number): void {
    const baseInterval = this.config.interval;
    
    if (cpuUsage > 0.8) {
      // High CPU usage - slow down sampling
      this.adaptiveInterval = baseInterval * 3;
    } else if (cpuUsage > 0.5) {
      // Moderate CPU usage
      this.adaptiveInterval = baseInterval * 1.5;
    } else {
      // Low CPU usage - normal rate
      this.adaptiveInterval = baseInterval;
    }
    
    // Restart timer with new interval
    if (this.samplingTimer) {
      this.startSamplingTimer(this.adaptiveInterval);
    }
    
    this.emit('sampling:adjusted', {
      cpuUsage,
      oldInterval: baseInterval,
      newInterval: this.adaptiveInterval
    });
  }
  
  /**
   * Adjust sampling based on visibility
   */
  private adjustSamplingForVisibility(visibilityRatio: number): void {
    const baseInterval = this.config.interval;
    
    if (visibilityRatio > 0.7) {
      // Many elements visible - increase sampling
      this.adaptiveInterval = baseInterval * 0.8;
    } else if (visibilityRatio < 0.3) {
      // Few elements visible - decrease sampling
      this.adaptiveInterval = baseInterval * 1.2;
    }
    
    if (this.samplingTimer) {
      this.startSamplingTimer(this.adaptiveInterval);
    }
  }
  
  /**
   * Monitor memory pressure
   */
  private monitorMemoryPressure(): void {
    setInterval(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        
        if (usageRatio > 0.9) {
          // High memory pressure - reduce sampling
          this.emit('memory:pressure', { high: true, ratio: usageRatio });
          this.adaptiveInterval = this.config.interval * 2;
          
          if (this.samplingTimer) {
            this.startSamplingTimer(this.adaptiveInterval);
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }
  
  /**
   * Get sampling statistics
   */
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
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<SamplingConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart with new configuration
    this.destroy();
    this.initializeSampling();
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    // Stop timers
    this.stopSamplingTimer();
    
    // Disconnect observers
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
    
    // Remove event listeners
    this.eventHandlers.forEach((handler, event) => {
      if (event === 'scroll') {
        window.removeEventListener('scroll', handler as EventListener);
      } else if (event === 'focus') {
        document.removeEventListener('focusin', handler as EventListener, true);
        document.removeEventListener('focusout', handler as EventListener, true);
      }
    });
    
    this.eventHandlers.clear();
    
    // Clean up CPU monitor
    this.cpuMonitor.destroy();
    
    this.removeAllListeners();
  }
}

/**
 * CPU usage monitor
 */
class CPUMonitor extends EventEmitter {
  private interval?: number;
  private lastIdleTime = 0;
  private lastTotalTime = 0;
  
  constructor() {
    super();
    this.startMonitoring();
  }
  
  private startMonitoring(): void {
    // Simple CPU monitoring using setTimeout delays
    let lastCheck = performance.now();
    
    this.interval = window.setInterval(() => {
      const now = performance.now();
      const actualDelay = now - lastCheck;
      const expectedDelay = 1000;
      
      // If actual delay is much higher than expected, CPU is busy
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