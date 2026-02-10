/**
 * Queue Manager for Incremental Processing
 * Manages evaluation queues with priority and scheduling
 */

import type { EvaluationQueue, EvaluationOptions, EvaluationResult } from '../types';
import { EvaluationEngine } from './EvaluationEngine';

export class QueueManager {
  private queues: Map<string, EvaluationQueue> = new Map();
  private engine: EvaluationEngine;
  private processing = false;
  private processTimer: NodeJS.Timeout | null = null;
  private maxConcurrent = 2;
  private currentProcessing = 0;
  private completedCallback?: (queue: EvaluationQueue) => void;
  private errorCallback?: (queue: EvaluationQueue, error: Error) => void;

  constructor(engine: EvaluationEngine) {
    this.engine = engine;
  }

  /**
   * Add elements to evaluation queue
   */
  enqueue(
    elements: Element[], 
    options: EvaluationOptions = {}, 
    priority = 0
  ): string {
    const id = this.generateQueueId();
    const queue: EvaluationQueue = {
      id,
      elements,
      options,
      priority,
      status: 'pending'
    };

    this.queues.set(id, queue);
    this.scheduleProcessing();
    
    return id;
  }

  /**
   * Get queue status
   */
  getQueueStatus(id: string): EvaluationQueue | undefined {
    return this.queues.get(id);
  }

  /**
   * Cancel a queue
   */
  cancelQueue(id: string): boolean {
    const queue = this.queues.get(id);
    if (!queue) return false;

    if (queue.status === 'processing') {
      // Will be cancelled by engine
      return false;
    }

    this.queues.delete(id);
    return true;
  }

  /**
   * Set completion callback
   */
  onComplete(callback: (queue: EvaluationQueue) => void): void {
    this.completedCallback = callback;
  }

  /**
   * Set error callback
   */
  onError(callback: (queue: EvaluationQueue, error: Error) => void): void {
    this.errorCallback = callback;
  }

  /**
   * Schedule processing
   */
  private scheduleProcessing(): void {
    if (this.processing || this.processTimer) return;

    this.processTimer = setTimeout(() => {
      this.processTimer = null;
      this.processQueues();
    }, 100);
  }

  /**
   * Process pending queues
   */
  private async processQueues(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      // Get pending queues sorted by priority
      const pending = Array.from(this.queues.values())
        .filter(q => q.status === 'pending')
        .sort((a, b) => b.priority - a.priority);

      // Process up to maxConcurrent queues
      const toProcess = pending.slice(0, this.maxConcurrent - this.currentProcessing);
      
      await Promise.all(toProcess.map(queue => this.processQueue(queue)));
    } finally {
      this.processing = false;
      
      // Check if more queues need processing
      const hasPending = Array.from(this.queues.values())
        .some(q => q.status === 'pending');
      
      if (hasPending) {
        this.scheduleProcessing();
      }
    }
  }

  /**
   * Process a single queue
   */
  private async processQueue(queue: EvaluationQueue): Promise<void> {
    queue.status = 'processing';
    this.currentProcessing++;

    try {
      // Split into smaller chunks for incremental processing
      const chunkSize = queue.options.chunkSize || 25;
      const chunks = this.splitIntoChunks(queue.elements, chunkSize);
      const results: EvaluationResult[] = [];

      for (let i = 0; i < chunks.length; i++) {
        // Check if queue still exists (not cancelled)
        if (!this.queues.has(queue.id)) break;

        const chunkResults = await this.engine.evaluate(chunks[i] as Element[], queue.options);
        results.push(...chunkResults);

        // Update progress
        const progress = ((i + 1) / chunks.length) * 100;
        this.updateQueueProgress(queue.id, progress);
      }

      // Complete queue
      queue.status = 'complete';
      queue.results = results;
      this.completedCallback?.(queue);

      // Clean up after delay
      setTimeout(() => {
        this.queues.delete(queue.id);
      }, 60000); // Keep for 1 minute
    } catch (error) {
      queue.status = 'error';
      queue.error = error as Error;
      this.errorCallback?.(queue, error as Error);
    } finally {
      this.currentProcessing--;
    }
  }

  /**
   * Split elements into chunks
   */
  private splitIntoChunks<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Update queue progress
   */
  private updateQueueProgress(id: string, progress: number): void {
    const queue = this.queues.get(id);
    if (queue) {
      // Could emit progress events here
    }
  }

  /**
   * Generate unique queue ID
   */
  private generateQueueId(): string {
    return `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    complete: number;
    error: number;
  } {
    const queues = Array.from(this.queues.values());
    
    return {
      total: queues.length,
      pending: queues.filter(q => q.status === 'pending').length,
      processing: queues.filter(q => q.status === 'processing').length,
      complete: queues.filter(q => q.status === 'complete').length,
      error: queues.filter(q => q.status === 'error').length
    };
  }

  /**
   * Clear completed and error queues
   */
  clearCompleted(): void {
    for (const [id, queue] of this.queues) {
      if (queue.status === 'complete' || queue.status === 'error') {
        this.queues.delete(id);
      }
    }
  }

  /**
   * Stop all processing
   */
  stop(): void {
    if (this.processTimer) {
      clearTimeout(this.processTimer);
      this.processTimer = null;
    }
    
    this.processing = false;
    this.engine.cancelAll();
  }
}