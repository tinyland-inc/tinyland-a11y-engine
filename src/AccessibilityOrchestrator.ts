import { DOMSampler } from './sampler/DOMSampler';
import { StreamingClient } from './streaming/StreamingClient';

import { ContrastAnalyzer } from './engine/ContrastAnalyzer';
import type { EvaluationConfig, EvaluationResult, EvaluationStats } from './types';

export class AccessibilityOrchestrator {
  private sampler: DOMSampler;
  private streamingClient: StreamingClient | null = null;
  private contrastAnalyzer: ContrastAnalyzer;

  
  get client() { return this.streamingClient; }

  
  private evaluationTimer: number | null = null;
  private heartbeatInterval: number | null = null;
  private isEvaluating = false;
  private disconnectedSince: number | null = null;
  private readonly maxDisconnectedTime = 60000; 
  private domChangeDebounceTimer: number | null = null;
  private readonly domChangeDebounceDelay = 3000; 
  private evaluationQueued = false; 
  private lastEvaluationTime = 0;
  private readonly minEvaluationInterval = 5000; 
  
  
  get isRunning() {
    return this.evaluationTimer !== null || this.config.enabled;
  }
  private abortController: AbortController | null = null;
  private stats: EvaluationStats = {
    totalElements: 0,
    evaluatedElements: 0,
    issues: 0,
    criticalIssues: 0,
    evaluationTimeMs: 0,
    memoryUsageMB: 0
  };
  
  constructor(
    private config: EvaluationConfig,
    private onResults?: (results: EvaluationResult[], stats: EvaluationStats) => void
  ) {
    this.sampler = new DOMSampler(config.samplingStrategy);
    this.contrastAnalyzer = new ContrastAnalyzer();
    
    
    if (config.streamingEnabled) {
      const endpoint = config.streamingEndpoint || window.location.origin;

      this.streamingClient = new StreamingClient(
        endpoint,
        (data: any) => {
          console.log('[A11y] Stream message:', data);
        },
        (error: Error) => {
          console.error('[A11y] Stream error:', error);
        }
      );
    }
  }
  
  


  start() {
    if (!this.config.enabled) {
      console.warn('[A11y] Orchestrator start() called but config.enabled is false');
      return;
    }
    
    console.log('[A11y] Starting orchestrator - manual evaluation only');
    
    
    
    
    
    
    if (this.streamingClient) {
      console.log('[AccessibilityOrchestrator] Connecting streaming client...');
      this.streamingClient.connect();
    }
    
    
  }
  
  


  async evaluate() {
    if (this.isEvaluating) {
      console.log('[A11y] Evaluation already in progress');
      return;
    }
    
    
    const now = Date.now();
    const timeSinceLastEvaluation = now - this.lastEvaluationTime;
    if (timeSinceLastEvaluation < this.minEvaluationInterval) {
      console.log(`[A11y] Rate limiting: ${timeSinceLastEvaluation}ms since last evaluation, minimum is ${this.minEvaluationInterval}ms`);
      return;
    }
    
    
    if (this.streamingClient && !this.streamingClient.getStatus().connected) {
      console.warn('[A11y] Not connected - skipping evaluation to prevent memory overflow');
      
      
      if (this.disconnectedSince && (Date.now() - this.disconnectedSince) > this.maxDisconnectedTime) {
        console.error('[A11y] Circuit breaker triggered - disconnected for too long, stopping evaluations');
        this.stop(); 
      }
      
      return;
    }
    
    this.isEvaluating = true;
    const startTime = performance.now();
    const results: EvaluationResult[] = [];
    
    
    this.abortController = new AbortController();
    
    try {
      
      this.stats.totalElements = 0;
      this.stats.evaluatedElements = 0;
      this.stats.issues = 0;
      this.stats.criticalIssues = 0;
      
      
      const memoryUsage = this.getMemoryUsage();
      if (memoryUsage > this.config.maxMemoryMB) {
        console.warn(`[A11y] Memory usage (${memoryUsage}MB) exceeds limit`);
        return;
      }
      
      
      await this.evaluateContrast(results);
      
      
      
      
      
      
      
      
      this.stats.evaluationTimeMs = performance.now() - startTime;
      this.stats.memoryUsageMB = this.getMemoryUsage();
      
      
      if (results.length > 0) {
        this.onResults?.(results, this.stats);
        
        
        if (this.streamingClient && this.streamingClient.getStatus().connected) {
          try {
            
            this.streamingClient.sendEvaluation(results);
          } catch (error) {
            console.error('[A11y] Failed to send results:', error);
            
          }
        }
      }
      
    } catch (error) {
      console.error('[A11y] Evaluation error:', error);
    } finally {
      this.isEvaluating = false;
      this.abortController = null;
    }
  }
  
  


  private async evaluateContrast(results: EvaluationResult[]) {
    
    
    const selector = 'p, span, h1, h2, h3, h4, h5, h6, a, button, label, td, th, li, .badge, .chip, [class*="badge"], [class*="chip"], [class*="variant-filled-"]';
    const elements = this.sampler.sampleElements(selector, 100); 
    
    this.stats.totalElements += elements.length;
    
    for (const element of elements) {
      
      if (this.abortController?.signal.aborted) break;
      
      
      const computed = window.getComputedStyle(element);
      if (computed.display === 'none' || computed.visibility === 'hidden') {
        continue;
      }
      
      
      const text = element.textContent?.trim();
      if (!text) continue;
      
      
      const result = this.contrastAnalyzer.analyzeElement(element);
      if (result) {
        
        const rect = element.getBoundingClientRect();
        result.element = {
          tagName: element.tagName.toLowerCase(),
          className: element.className || undefined,
          id: element.id || undefined,
          text: element.textContent?.trim(),
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        };
        
        results.push(result);
        this.stats.evaluatedElements++;
        
        if (result.severity === 'error') {
          this.stats.issues++;
          if (result.wcagLevel === 'A') {
            this.stats.criticalIssues++;
          }
        }

        
      }
      
      
      if (this.stats.evaluatedElements % 10 === 0) {
        await new Promise(resolve => requestIdleCallback(resolve));
      }
    }
  }
  
  


  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024);
    }
    return 0;
  }
  
  


  private getSessionAnalytics() {
    const nav = navigator as any;
    const screen = window.screen;
    
    return {
      
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      vendor: navigator.vendor,
      
      
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio || 1,
        orientation: screen.orientation?.type || 'unknown'
      },
      
      
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      },
      
      
      performance: {
        memory: nav.memory ? {
          usedJSHeapSize: nav.memory.usedJSHeapSize,
          totalJSHeapSize: nav.memory.totalJSHeapSize,
          jsHeapSizeLimit: nav.memory.jsHeapSizeLimit
        } : null,
        navigation: {
          type: nav.performance?.navigation?.type,
          redirectCount: nav.performance?.navigation?.redirectCount
        }
      },
      
      
      connection: nav.connection ? {
        effectiveType: nav.connection.effectiveType,
        downlink: nav.connection.downlink,
        rtt: nav.connection.rtt,
        saveData: nav.connection.saveData
      } : null,
      
      
      session: {
        referrer: document.referrer,
        url: window.location.href,
        hostname: window.location.hostname,
        pathname: window.location.pathname,
        timestamp: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset()
      },
      
      
      preferences: {
        theme: this.detectTheme(),
        prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        prefersContrast: window.matchMedia('(prefers-contrast: high)').matches,
        forcedColors: window.matchMedia('(forced-colors: active)').matches
      }
    };
  }

  


  private detectTheme(): 'light' | 'dark' | 'system' {
    
    const bodyClasses = document.body.classList;
    const htmlClasses = document.documentElement.classList;
    
    if (bodyClasses.contains('dark') || htmlClasses.contains('dark')) {
      return 'dark';
    }
    
    if (bodyClasses.contains('light') || htmlClasses.contains('light')) {
      return 'light';
    }
    
    
    const theme = document.documentElement.getAttribute('data-theme') || 
                 document.body.getAttribute('data-theme');
    if (theme === 'dark' || theme === 'light') {
      return theme as 'light' | 'dark';
    }
    
    
    const cssTheme = getComputedStyle(document.documentElement)
      .getPropertyValue('--theme-mode')
      .trim();
    if (cssTheme === 'dark' || cssTheme === 'light') {
      return cssTheme as 'light' | 'dark';
    }
    
    
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    
    return 'light'; 
  }

  


  stop() {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.domChangeDebounceTimer) {
      clearTimeout(this.domChangeDebounceTimer);
      this.domChangeDebounceTimer = null;
    }
    
    this.abortController?.abort();
    this.sampler.destroy();
    this.contrastAnalyzer.destroy();
    this.streamingClient?.disconnect();
  }
  
  


  updateConfig(config: Partial<EvaluationConfig>) {
    this.config = { ...this.config, ...config };
    
    
    this.stop();
    this.start();
  }
  
  


  getStats(): EvaluationStats {
    return { ...this.stats };
  }
}
