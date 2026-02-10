/**
 * Core Evaluation Engine
 * 
 * This module provides the main evaluation engine that orchestrates
 * accessibility checks across the DOM using a plugin-based architecture.
 */

import type {
  AccessibilityConfig,
  EvaluationContext,
  BatchEvaluationResult,
  AccessibilityIssue,
  PerformanceMetrics,
  CustomRule
} from '../types';
import { RuleRegistry } from './rules/registry';
import { PerformanceMonitor } from './performance';
import { ContextBuilder } from './context';
import { WorkerPool } from './workers';
import { EventEmitter } from './events';

export class EvaluationEngine extends EventEmitter {
  private config: AccessibilityConfig;
  private registry: RuleRegistry;
  private monitor: PerformanceMonitor;
  private contextBuilder: ContextBuilder;
  private workerPool?: WorkerPool;
  private evaluationId = 0;
  
  constructor(config: AccessibilityConfig) {
    super();
    this.config = config;
    this.registry = new RuleRegistry(config.evaluation);
    this.monitor = new PerformanceMonitor(config.performance);
    this.contextBuilder = new ContextBuilder();
    
    // Initialize worker pool if enabled
    if (config.performance.useWorkers) {
      this.workerPool = new WorkerPool(config.performance.maxWorkers || 4);
    }
    
    // Register custom rules if provided
    if (config.evaluation.customRules) {
      config.evaluation.customRules.forEach(rule => {
        this.registry.register(rule);
      });
    }
  }
  
  /**
   * Evaluate accessibility for the current page state
   */
  async evaluate(elements?: Element[]): Promise<BatchEvaluationResult> {
    const startTime = performance.now();
    const id = `eval-${++this.evaluationId}-${Date.now()}`;
    
    try {
      // Start performance monitoring
      this.monitor.start(id);
      
      // Build evaluation context
      const context = await this.contextBuilder.build(this.config, elements);
      
      // Get elements to evaluate
      const targetElements = elements || this.selectElements(context);
      
      // Apply privacy settings
      const sanitizedElements = this.applyPrivacy(targetElements);
      
      // Evaluate rules
      const issues = await this.evaluateRules(sanitizedElements, context);
      
      // Get performance metrics
      const metrics = this.monitor.stop(id);
      
      // Build result
      const result: BatchEvaluationResult = {
        id,
        startTime,
        endTime: performance.now(),
        issues,
        metrics,
        metadata: {
          elementsTotal: targetElements.length,
          elementsEvaluated: sanitizedElements.length,
          rulesApplied: this.registry.getActiveRules().length,
          wcagVersion: this.config.evaluation.wcag,
          wcagLevel: this.config.evaluation.level
        }
      };
      
      // Emit completion event
      this.emit('evaluation:complete', result);
      
      return result;
      
    } catch (error) {
      this.monitor.stop(id);
      this.emit('evaluation:error', { id, error });
      throw error;
    }
  }
  
  /**
   * Select elements based on configuration
   */
  private selectElements(context: EvaluationContext): Element[] {
    const { sampling } = this.config;
    const elements: Element[] = [];
    
    // Focus on specified regions
    if (sampling.regions && sampling.regions.length > 0) {
      sampling.regions.forEach(selector => {
        const regionElements = context.document.querySelectorAll(selector);
        elements.push(...Array.from(regionElements));
      });
    } else {
      // Select all elements in body
      const allElements = context.document.body.querySelectorAll('*');
      elements.push(...Array.from(allElements));
    }
    
    // Apply exclusions
    if (sampling.exclude && sampling.exclude.length > 0) {
      const excludeSelectors = sampling.exclude.join(',');
      return elements.filter(el => !el.matches(excludeSelectors));
    }
    
    // Apply max elements limit
    if (sampling.maxElements && elements.length > sampling.maxElements) {
      // Prioritize visible and interactive elements
      const prioritized = this.prioritizeElements(elements, context);
      return prioritized.slice(0, sampling.maxElements);
    }
    
    return elements;
  }
  
  /**
   * Prioritize elements for evaluation
   */
  private prioritizeElements(elements: Element[], context: EvaluationContext): Element[] {
    return elements.sort((a, b) => {
      const scoreA = this.getElementPriority(a, context);
      const scoreB = this.getElementPriority(b, context);
      return scoreB - scoreA;
    });
  }
  
  /**
   * Calculate element priority score
   */
  private getElementPriority(element: Element, context: EvaluationContext): number {
    let score = 0;
    
    // Visible elements get higher priority
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) score += 10;
    
    // Interactive elements
    if (element.matches('a, button, input, select, textarea, [role="button"], [tabindex]')) {
      score += 20;
    }
    
    // Headings and landmarks
    if (element.matches('h1, h2, h3, h4, h5, h6, main, nav, header, footer, article, section')) {
      score += 15;
    }
    
    // Elements with ARIA
    if (element.hasAttribute('role') || element.hasAttribute('aria-label')) {
      score += 10;
    }
    
    // In viewport
    if (this.isInViewport(element, context.window)) {
      score += 25;
    }
    
    return score;
  }
  
  /**
   * Check if element is in viewport
   */
  private isInViewport(element: Element, window: Window): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
  }
  
  /**
   * Apply privacy settings to elements
   */
  private applyPrivacy(elements: Element[]): Element[] {
    const { privacy } = this.config;
    
    if (!privacy.redactText && !privacy.excludeAttributes?.length) {
      return elements;
    }
    
    // Clone elements for privacy
    return elements.map(el => {
      const clone = el.cloneNode(true) as Element;
      
      // Redact text content if needed
      if (privacy.redactText) {
        this.redactTextContent(clone);
      }
      
      // Remove excluded attributes
      if (privacy.excludeAttributes) {
        privacy.excludeAttributes.forEach(attr => {
          clone.removeAttribute(attr);
        });
      }
      
      return clone;
    });
  }
  
  /**
   * Redact text content while preserving structure
   */
  private redactTextContent(element: Element): void {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent && node.textContent.trim()) {
        node.textContent = '[REDACTED]';
      }
    }
  }
  
  /**
   * Evaluate rules against elements
   */
  private async evaluateRules(
    elements: Element[],
    context: EvaluationContext
  ): Promise<AccessibilityIssue[]> {
    const issues: AccessibilityIssue[] = [];
    const rules = this.registry.getActiveRules();
    
    // Use worker pool if available
    if (this.workerPool && this.config.performance.useWorkers) {
      return this.evaluateWithWorkers(elements, rules, context);
    }
    
    // Evaluate synchronously
    for (const element of elements) {
      for (const rule of rules) {
        try {
          const result = await rule.evaluate(element, context);
          
          if (!result.passed && result.violation) {
            issues.push(this.createIssue(element, rule, result.violation));
          }
        } catch (error) {
          this.emit('rule:error', { rule: rule.id, element, error });
        }
      }
    }
    
    return issues;
  }
  
  /**
   * Evaluate using worker pool
   */
  private async evaluateWithWorkers(
    elements: Element[],
    rules: CustomRule[],
    context: EvaluationContext
  ): Promise<AccessibilityIssue[]> {
    // Serialize elements and context for workers
    const tasks = elements.flatMap(element =>
      rules.map(rule => ({
        element: this.serializeElement(element),
        ruleId: rule.id,
        context: this.serializeContext(context)
      }))
    );
    
    // Process in batches
    const batchSize = this.config.performance.batchSize || 100;
    const results = await this.workerPool!.processBatches(tasks, batchSize);
    
    // Convert results to issues
    return results
      .filter(r => !r.passed && r.violation)
      .map(r => this.createIssueFromWorkerResult(r));
  }
  
  /**
   * Serialize element for worker
   */
  private serializeElement(element: Element): any {
    return {
      tagName: element.tagName,
      attributes: Array.from(element.attributes).map(attr => ({
        name: attr.name,
        value: attr.value
      })),
      textContent: element.textContent,
      innerHTML: element.innerHTML,
      computedStyle: window.getComputedStyle(element)
    };
  }
  
  /**
   * Serialize context for worker
   */
  private serializeContext(context: EvaluationContext): any {
    return {
      // Only serialize what workers need
      wcagVersion: this.config.evaluation.wcag,
      wcagLevel: this.config.evaluation.level
    };
  }
  
  /**
   * Create issue from element and rule
   */
  private createIssue(
    element: Element,
    rule: CustomRule,
    violation: any
  ): AccessibilityIssue {
    const id = `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const issueType = this.inferIssueType(rule);

    // Map rule severity to AccessibilityIssue severity
    const severityMap: Record<string, 'error' | 'warning' | 'info'> = {
      critical: 'error',
      serious: 'error',
      moderate: 'warning',
      minor: 'info'
    };
    const severity = severityMap[rule.severity] || 'warning';

    const elementRef = this.getElementReference(element);

    return {
      id,
      timestamp: Date.now(),
      type: issueType,
      severity,
      wcagLevel: 'AA' as const,
      wcagCriteria: Array.isArray(rule.wcagCriteria) ? rule.wcagCriteria.join(', ') : (rule.wcagCriteria || ''),
      selector: elementRef.selector,
      message: violation?.message || `${rule.id}: accessibility violation`,
      rule: rule.id,
      element: elementRef,
      metadata: {
        violation,
        fixes: this.generateFixes(element, rule, violation),
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        occurrences: 1,
        impactScore: this.calculateImpactScore(element, rule, violation),
        related: []
      }
    };
  }

  /**
   * Get element reference for issue reporting
   */
  private getElementReference(element: Element): { selector: string; tagName: string; attributes: Record<string, string>; text: string; bounds: DOMRect } {
    return {
      selector: this.generateSelector(element) || element.tagName.toLowerCase(),
      tagName: element.tagName.toLowerCase(),
      attributes: Object.fromEntries(
        Array.from(element.attributes).map(attr => [attr.name, attr.value])
      ),
      text: element.textContent?.trim().slice(0, 100) || '',
      bounds: element.getBoundingClientRect()
    };
  }
  
  /**
   * Create issue from worker result
   */
  private createIssueFromWorkerResult(result: any): AccessibilityIssue {
    // Implementation depends on worker result format
    return {} as AccessibilityIssue;
  }
  
  /**
   * Infer issue type from rule
   */
  private inferIssueType(rule: CustomRule): any {
    // Simple inference based on rule ID or criteria
    if (rule.id.includes('contrast')) return 'contrast';
    if (rule.id.includes('keyboard')) return 'keyboard';
    if (rule.id.includes('aria')) return 'aria';
    return 'structure';
  }
  
  /**
   * Get element information
   */
  private getElementInfo(element: Element): any {
    const rect = element.getBoundingClientRect();
    
    return {
      selector: this.generateSelector(element),
      tagName: element.tagName.toLowerCase(),
      role: element.getAttribute('role') || undefined,
      bounds: rect,
      visibility: this.getVisibility(element),
      interactive: this.isInteractive(element),
      focusable: this.isFocusable(element)
    };
  }
  
  /**
   * Generate unique selector for element
   */
  private generateSelector(element: Element): string {
    // Implementation of CSS selector generation
    return '';
  }
  
  /**
   * Get element visibility state
   */
  private getVisibility(element: Element): any {
    const style = window.getComputedStyle(element);
    
    if (style.display === 'none' || style.visibility === 'hidden') {
      return 'hidden';
    }
    
    if (style.opacity === '0') {
      return 'transparent';
    }
    
    const rect = element.getBoundingClientRect();
    if (rect.top > window.innerHeight || rect.bottom < 0 ||
        rect.left > window.innerWidth || rect.right < 0) {
      return 'offscreen';
    }
    
    return 'visible';
  }
  
  /**
   * Check if element is interactive
   */
  private isInteractive(element: Element): boolean {
    return element.matches('a, button, input, select, textarea, [role="button"], [onclick]');
  }
  
  /**
   * Check if element is focusable
   */
  private isFocusable(element: Element): boolean {
    const tabindex = element.getAttribute('tabindex');
    return this.isInteractive(element) || (tabindex !== null && parseInt(tabindex) >= 0);
  }
  
  /**
   * Generate suggested fixes
   */
  private generateFixes(element: Element, rule: CustomRule, violation: any): any[] {
    // Rule-specific fix generation
    return [];
  }
  
  /**
   * Calculate impact score
   */
  private calculateImpactScore(element: Element, rule: CustomRule, violation: any): number {
    let score = 0;
    
    // Base score from severity
    switch (rule.severity) {
      case 'critical': score = 80; break;
      case 'serious': score = 60; break;
      case 'moderate': score = 40; break;
      case 'minor': score = 20; break;
    }
    
    // Adjust based on element importance
    if (this.isInViewport(element, window)) score += 10;
    if (this.isInteractive(element)) score += 10;
    
    return Math.min(100, score);
  }
  
  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.workerPool) {
      await this.workerPool.terminate();
    }
    
    this.removeAllListeners();
  }
}