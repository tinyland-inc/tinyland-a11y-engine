/**
 * Performance Monitor - Stub module for performance tracking
 */

import type { PerformanceMetrics } from '../types';

export class PerformanceMonitor {
  private metrics: Map<string, { start: number; end?: number }> = new Map();

  constructor(_options?: Record<string, any>) {}

  start(id: string): void {
    this.metrics.set(id, { start: performance.now() });
  }

  stop(id: string): PerformanceMetrics {
    const record = this.metrics.get(id);
    const end = performance.now();
    const duration = record ? end - record.start : 0;

    return {
      duration,
      elementsEvaluated: 0,
      rulesExecuted: 0,
      memoryUsed: 0,
      cpuUsage: 0,
      workerUtilization: 0
    };
  }

  getMetrics(id: string): PerformanceMetrics | undefined {
    const record = this.metrics.get(id);
    if (!record) return undefined;

    return {
      duration: record.end ? record.end - record.start : performance.now() - record.start,
      elementsEvaluated: 0,
      rulesExecuted: 0,
      memoryUsed: 0,
      cpuUsage: 0,
      workerUtilization: 0
    };
  }
}
