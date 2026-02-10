/**
 * Runtime Contrast Monitor
 * Real-time contrast validation and monitoring for dynamic content
 */

import {
  type RGB,
  getComputedColor,
  getEffectiveBackgroundColor,
  checkContrast
} from '../contrast.js';

import type { ValidationResult } from '../validators.js';
import { ContrastValidator } from './ContrastValidator.js';
import { ThemeContrastValidator } from './ThemeContrastValidator.js';

export interface MonitorOptions {
  wcagLevel?: 'AA' | 'AAA';
  autoFix?: boolean;
  logViolations?: boolean;
  reportToConsole?: boolean;
  reportToServer?: boolean;
  serverEndpoint?: string;
  throttleMs?: number;
  observeAttributes?: boolean;
  observeChildren?: boolean;
  observeSubtree?: boolean;
}

export interface ViolationReport {
  timestamp: number;
  element: Element;
  selector: string;
  violation: {
    type: string;
    message: string;
    ratio: number;
    required: number;
    foreground: RGB;
    background: RGB;
  };
  context: {
    url: string;
    viewport: { width: number; height: number };
    theme?: string;
    userAgent: string;
  };
  suggested?: {
    foreground?: RGB;
    background?: RGB;
  };
}

export interface MonitorStats {
  startTime: number;
  elementsChecked: number;
  violationsFound: number;
  violationsFixed: number;
  lastCheckTime: number;
  violationsByType: Map<string, number>;
}

/**
 * Monitors contrast violations in real-time
 */
export class RuntimeContrastMonitor {
  private validator: ContrastValidator;
  private themeValidator: ThemeContrastValidator;
  private observer: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private options: Required<MonitorOptions>;
  private stats: MonitorStats;
  private violationCache = new WeakMap<Element, ViolationReport>();
  private checkQueue = new Set<Element>();
  private checkTimer: number | null = null;
  private reportBuffer: ViolationReport[] = [];

  constructor(options: MonitorOptions = {}) {
    this.validator = new ContrastValidator();
    this.themeValidator = new ThemeContrastValidator();
    
    this.options = {
      wcagLevel: 'AA',
      autoFix: false,
      logViolations: true,
      reportToConsole: true,
      reportToServer: false,
      serverEndpoint: '/api/accessibility/violations',
      throttleMs: 100,
      observeAttributes: true,
      observeChildren: true,
      observeSubtree: true,
      ...options
    };

    this.stats = {
      startTime: Date.now(),
      elementsChecked: 0,
      violationsFound: 0,
      violationsFixed: 0,
      lastCheckTime: Date.now(),
      violationsByType: new Map()
    };
  }

  /**
   * Start monitoring
   */
  start(root: Element = document.body): void {
    if (this.observer) {
      this.stop();
    }

    // Initial scan
    this.scanElement(root);

    // Set up mutation observer
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          const target = mutation.target as Element;
          if (this.shouldCheckElement(target)) {
            this.queueCheck(target);
          }
        } else if (mutation.type === 'childList') {
          // Check added nodes
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.scanElement(node as Element);
            }
          });
        }
      }
    });

    this.observer.observe(root, {
      attributes: this.options.observeAttributes,
      attributeFilter: ['style', 'class', 'data-theme'],
      childList: this.options.observeChildren,
      subtree: this.options.observeSubtree
    });

    // Set up resize observer for responsive changes
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (this.shouldCheckElement(entry.target as Element)) {
          this.queueCheck(entry.target as Element);
        }
      }
    });

    // Set up intersection observer for lazy-loaded content
    this.intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && this.shouldCheckElement(entry.target as Element)) {
          this.queueCheck(entry.target as Element);
        }
      }
    }, {
      rootMargin: '50px'
    });

    // Observe all text-containing elements
    const textElements = this.themeValidator.findAllTextElements(root);
    textElements.forEach(el => {
      this.resizeObserver?.observe(el);
      this.intersectionObserver?.observe(el);
    });

    // Listen for theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        this.scanElement(root);
      });
      
      window.matchMedia('(prefers-contrast: high)').addEventListener('change', () => {
        this.scanElement(root);
      });
    }

    // Report stats periodically
    setInterval(() => {
      this.reportStats();
    }, 60000); // Every minute
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;

    if (this.checkTimer) {
      cancelAnimationFrame(this.checkTimer);
      this.checkTimer = null;
    }

    // Send any remaining reports
    if (this.reportBuffer.length > 0) {
      this.flushReports();
    }
  }

  /**
   * Scan element and its children for violations
   */
  private scanElement(element: Element): void {
    const textElements = this.themeValidator.findAllTextElements(element);
    
    for (const el of textElements) {
      this.checkElement(el);
    }

    // Also check the element itself if it contains text
    if (this.shouldCheckElement(element)) {
      this.checkElement(element);
    }
  }

  /**
   * Queue element for checking (throttled)
   */
  private queueCheck(element: Element): void {
    this.checkQueue.add(element);
    
    if (!this.checkTimer) {
      this.checkTimer = requestAnimationFrame(() => {
        this.processQueue();
      });
    }
  }

  /**
   * Process queued checks
   */
  private processQueue(): void {
    const startTime = performance.now();
    const maxTime = 16; // Stay under frame budget
    
    for (const element of this.checkQueue) {
      if (performance.now() - startTime > maxTime) {
        // Continue in next frame
        this.checkTimer = requestAnimationFrame(() => {
          this.processQueue();
        });
        return;
      }
      
      this.checkElement(element);
      this.checkQueue.delete(element);
    }
    
    this.checkTimer = null;
  }

  /**
   * Check individual element for contrast violations
   */
  private checkElement(element: Element): void {
    // Skip if recently checked
    const cached = this.violationCache.get(element);
    if (cached && Date.now() - cached.timestamp < this.options.throttleMs) {
      return;
    }

    this.stats.elementsChecked++;
    this.stats.lastCheckTime = Date.now();

    const foreground = getComputedColor(element, 'color');
    const background = getEffectiveBackgroundColor(element);

    if (!foreground || !background) {
      return;
    }

    const result = checkContrast(foreground, background);
    const required = this.getRequiredRatio(element);
    
    if (result.ratio < required) {
      const violation = this.createViolationReport(
        element,
        result.ratio,
        required,
        foreground,
        background
      );
      
      this.violationCache.set(element, violation);
      this.stats.violationsFound++;
      
      // Update stats by type
      const componentType = this.getComponentType(element);
      this.stats.violationsByType.set(
        componentType,
        (this.stats.violationsByType.get(componentType) || 0) + 1
      );

      // Handle violation
      if (this.options.autoFix) {
        this.attemptAutoFix(element, violation);
      }

      if (this.options.logViolations) {
        this.logViolation(violation);
      }

      if (this.options.reportToServer) {
        this.reportBuffer.push(violation);
        
        if (this.reportBuffer.length >= 10) {
          this.flushReports();
        }
      }
    }
  }

  /**
   * Create violation report
   */
  private createViolationReport(
    element: Element,
    ratio: number,
    required: number,
    foreground: RGB,
    background: RGB
  ): ViolationReport {
    const selector = this.getElementSelector(element);
    const theme = document.documentElement.getAttribute('data-theme') || 'default';
    
    return {
      timestamp: Date.now(),
      element,
      selector,
      violation: {
        type: this.getComponentType(element),
        message: `Contrast ratio ${ratio.toFixed(2)}:1 below required ${required}:1`,
        ratio,
        required,
        foreground,
        background
      },
      context: {
        url: window.location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        theme,
        userAgent: navigator.userAgent
      },
      suggested: this.getSuggestedColors(foreground, background, required)
    };
  }

  /**
   * Attempt to automatically fix contrast issues
   */
  private attemptAutoFix(element: Element, violation: ViolationReport): void {
    if (!violation.suggested) return;

    try {
      if (element instanceof HTMLElement) {
        // Apply inline styles temporarily
        const originalColor = element.style.color;
        const originalBg = element.style.backgroundColor;
        
        if (violation.suggested.foreground) {
          const { r, g, b } = violation.suggested.foreground;
          element.style.color = `rgb(${r}, ${g}, ${b})`;
        }
        
        if (violation.suggested.background) {
          const { r, g, b } = violation.suggested.background;
          element.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
        }

        // Mark as fixed
        element.setAttribute('data-contrast-fixed', 'true');
        this.stats.violationsFixed++;

        // Log the fix
        if (this.options.reportToConsole) {
          console.log('Contrast auto-fixed:', {
            element: violation.selector,
            original: { color: originalColor, background: originalBg },
            fixed: { 
              color: element.style.color, 
              background: element.style.backgroundColor 
            }
          });
        }
      }
    } catch (error) {
      console.error('Failed to auto-fix contrast:', error);
    }
  }

  /**
   * Get suggested colors that meet contrast requirements
   */
  private getSuggestedColors(
    foreground: RGB,
    background: RGB,
    requiredRatio: number
  ): { foreground?: RGB; background?: RGB } | undefined {
    const currentRatio = checkContrast(foreground, background).ratio;
    
    if (currentRatio >= requiredRatio) {
      return undefined;
    }

    // Try darkening foreground
    const darkerFg = this.adjustBrightness(foreground, 0.8);
    if (checkContrast(darkerFg, background).ratio >= requiredRatio) {
      return { foreground: darkerFg };
    }

    // Try lightening background
    const lighterBg = this.adjustBrightness(background, 1.2);
    if (checkContrast(foreground, lighterBg).ratio >= requiredRatio) {
      return { background: lighterBg };
    }

    // Try both
    if (checkContrast(darkerFg, lighterBg).ratio >= requiredRatio) {
      return { foreground: darkerFg, background: lighterBg };
    }

    return undefined;
  }

  /**
   * Adjust color brightness
   */
  private adjustBrightness(color: RGB, factor: number): RGB {
    return {
      r: Math.min(255, Math.max(0, Math.round(color.r * factor))),
      g: Math.min(255, Math.max(0, Math.round(color.g * factor))),
      b: Math.min(255, Math.max(0, Math.round(color.b * factor))),
      a: color.a
    };
  }

  /**
   * Log violation to console
   */
  private logViolation(violation: ViolationReport): void {
    if (!this.options.reportToConsole) return;

    console.warn(
      `%cContrast Violation: ${violation.violation.message}`,
      'color: #ff6b6b; font-weight: bold',
      {
        element: violation.element,
        selector: violation.selector,
        ratio: violation.violation.ratio.toFixed(2),
        required: violation.violation.required,
        foreground: violation.violation.foreground,
        background: violation.violation.background,
        suggested: violation.suggested
      }
    );
  }

  /**
   * Send violation reports to server
   */
  private async flushReports(): Promise<void> {
    if (!this.options.reportToServer || this.reportBuffer.length === 0) {
      return;
    }

    const reports = [...this.reportBuffer];
    this.reportBuffer = [];

    try {
      const response = await fetch(this.options.serverEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reports: reports.map(r => ({
            ...r,
            element: undefined // Don't send DOM references
          }))
        })
      });

      if (!response.ok) {
        console.error('Failed to report violations:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to report violations:', error);
    }
  }

  /**
   * Get current statistics
   */
  getStats(): MonitorStats {
    return { ...this.stats };
  }

  /**
   * Report statistics
   */
  private reportStats(): void {
    const runtime = Date.now() - this.stats.startTime;
    const minutes = Math.floor(runtime / 60000);
    
    if (this.options.reportToConsole) {
      console.log(
        `%cContrast Monitor Stats (${minutes}m)`,
        'color: #4ecdc4; font-weight: bold',
        {
          elementsChecked: this.stats.elementsChecked,
          violationsFound: this.stats.violationsFound,
          violationsFixed: this.stats.violationsFixed,
          violationsByType: Object.fromEntries(this.stats.violationsByType),
          checksPerMinute: Math.round(this.stats.elementsChecked / minutes)
        }
      );
    }
  }

  /**
   * Determine if element should be checked
   */
  private shouldCheckElement(element: Element): boolean {
    // Skip hidden elements
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    // Skip elements with no text content
    const hasText = element.textContent?.trim() || 
      style.content !== 'none' ||
      element.getAttribute('aria-label');
      
    return !!hasText;
  }

  /**
   * Get element selector
   */
  private getElementSelector(element: Element): string {
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classes = element.className ? 
      `.${element.className.split(' ').filter(c => c).join('.')}` : '';
    
    return `${tag}${id}${classes}`;
  }

  /**
   * Get component type
   */
  private getComponentType(element: Element): string {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    
    if (role) return role;
    
    switch (tag) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return 'heading';
      case 'button':
        return 'button';
      case 'a':
        return 'link';
      case 'input':
      case 'textarea':
      case 'select':
        return 'form-control';
      default:
        return 'text';
    }
  }

  /**
   * Get required contrast ratio
   */
  private getRequiredRatio(element: Element): number {
    const componentType = this.getComponentType(element);
    const fontSize = parseFloat(window.getComputedStyle(element).fontSize);
    const fontWeight = window.getComputedStyle(element).fontWeight;
    
    // Large text
    if (fontSize >= 18 || (fontSize >= 14 && parseInt(fontWeight) >= 700)) {
      return this.options.wcagLevel === 'AAA' ? 4.5 : 3;
    }
    
    // UI components
    if (['button', 'link', 'form-control'].includes(componentType)) {
      return 3;
    }
    
    // Regular text
    return this.options.wcagLevel === 'AAA' ? 7 : 4.5;
  }
}

/**
 * Factory function with auto-start
 */
export function createContrastMonitor(
  options?: MonitorOptions,
  autoStart = true
): RuntimeContrastMonitor {
  const monitor = new RuntimeContrastMonitor(options);
  
  if (autoStart && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        monitor.start();
      });
    } else {
      monitor.start();
    }
  }
  
  return monitor;
}