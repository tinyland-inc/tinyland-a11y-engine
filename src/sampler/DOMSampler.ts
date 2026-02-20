import type { SamplingStrategy } from '../types';

export class DOMSampler {
  private intersectionObserver: IntersectionObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private visibleElements = new WeakSet<Element>();
  private elementPriorities = new WeakMap<Element, number>();
  
  constructor(private strategy: SamplingStrategy) {}
  
  /**
   * Initialize viewport-based sampling using IntersectionObserver
   */
  initViewportSampling(callback: (entries: IntersectionObserverEntry[]) => void) {
    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.visibleElements.add(entry.target);
        } else {
          this.visibleElements.delete(entry.target);
        }
      });
      callback(entries);
    }, {
      rootMargin: '50px', // Slightly ahead of viewport
      threshold: [0, 0.25, 0.5, 0.75, 1]
    });
  }
  
  /**
   * Sample elements based on current strategy
   */
  sampleElements(selector: string, limit: number = 100): Element[] {
    // Exclude accessibility UI itself
    const elements = Array.from(
      document.querySelectorAll(`${selector}:not(.accessibility-monitor *)`)
    );
    
    switch (this.strategy.type) {
      case 'viewport':
        return this.viewportSample(elements, limit);
      case 'random':
        return this.randomSample(elements, limit);
      case 'priority':
        return this.prioritySample(elements, limit);
      case 'adaptive':
        return this.adaptiveSample(elements, limit);
      default:
        return elements.slice(0, limit);
    }
  }
  
  private viewportSample(elements: Element[], limit: number): Element[] {
    const visible = elements.filter(el => this.isInViewport(el));
    const invisible = elements.filter(el => !this.isInViewport(el));
    
    // Prioritize visible elements
    return [...visible.slice(0, limit), ...invisible.slice(0, limit - visible.length)];
  }
  
  private randomSample(elements: Element[], limit: number): Element[] {
    const shuffled = [...elements].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  }
  
  private prioritySample(elements: Element[], limit: number): Element[] {
    // Priority based on element type and position
    const prioritized = elements.sort((a, b) => {
      const aPriority = this.getElementPriority(a);
      const bPriority = this.getElementPriority(b);
      return bPriority - aPriority;
    });
    
    return prioritized.slice(0, limit);
  }
  
  private adaptiveSample(elements: Element[], limit: number): Element[] {
    // Adaptive sampling based on previous issues found
    const threshold = this.strategy.adaptiveThreshold || 0.1;
    const sampleSize = Math.min(
      limit,
      Math.max(10, Math.floor(elements.length * threshold))
    );
    
    return this.prioritySample(elements, sampleSize);
  }
  
  private isInViewport(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
  }
  
  private getElementPriority(element: Element): number {
    // Cache priority calculations
    if (this.elementPriorities.has(element)) {
      return this.elementPriorities.get(element)!;
    }
    
    let priority = 0;
    
    // Interactive elements get higher priority
    if (element.matches('button, a, input, select, textarea')) {
      priority += 10;
    }
    
    // Headings are important for structure
    if (element.matches('h1, h2, h3, h4, h5, h6')) {
      priority += 8;
    }
    
    // Visible elements
    if (this.isInViewport(element)) {
      priority += 5;
    }
    
    // Elements with text content
    if (element.textContent?.trim()) {
      priority += 3;
    }
    
    // Elements with Skeleton variant classes get higher priority
    if (element.className && element.className.includes('variant-')) {
      priority += 7;
      
      // Surface variants are especially problematic
      if (element.className.includes('variant-filled-surface') || 
          element.className.includes('variant-soft-surface')) {
        priority += 5;
      }
    }
    
    // Badges and chips with surface variants are highest priority
    if ((element.classList.contains('badge') || element.classList.contains('chip')) &&
        element.className.includes('variant-') && element.className.includes('surface')) {
      priority += 10;
    }
    
    this.elementPriorities.set(element, priority);
    return priority;
  }
  
  /**
   * Setup mutation observer for DOM changes
   */
  observeChanges(callback: (mutations: MutationRecord[]) => void) {
    this.mutationObserver = new MutationObserver((mutations) => {
      // Debounce mutations
      requestIdleCallback(() => callback(mutations));
    });
    
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden', 'aria-hidden']
    });
  }
  
  /**
   * Cleanup observers
   */
  destroy() {
    this.intersectionObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.visibleElements = new WeakSet();
    this.elementPriorities = new WeakMap();
  }
}