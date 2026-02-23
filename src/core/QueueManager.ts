




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

  


  getQueueStatus(id: string): EvaluationQueue | undefined {
    return this.queues.get(id);
  }

  


  cancelQueue(id: string): boolean {
    const queue = this.queues.get(id);
    if (!queue) return false;

    if (queue.status === 'processing') {
      
      return false;
    }

    this.queues.delete(id);
    return true;
  }

  


  onComplete(callback: (queue: EvaluationQueue) => void): void {
    this.completedCallback = callback;
  }

  


  onError(callback: (queue: EvaluationQueue, error: Error) => void): void {
    this.errorCallback = callback;
  }

  


  private scheduleProcessing(): void {
    if (this.processing || this.processTimer) return;

    this.processTimer = setTimeout(() => {
      this.processTimer = null;
      this.processQueues();
    }, 100);
  }

  


  private async processQueues(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      
      const pending = Array.from(this.queues.values())
        .filter(q => q.status === 'pending')
        .sort((a, b) => b.priority - a.priority);

      
      const toProcess = pending.slice(0, this.maxConcurrent - this.currentProcessing);
      
      await Promise.all(toProcess.map(queue => this.processQueue(queue)));
    } finally {
      this.processing = false;
      
      
      const hasPending = Array.from(this.queues.values())
        .some(q => q.status === 'pending');
      
      if (hasPending) {
        this.scheduleProcessing();
      }
    }
  }

  


  private async processQueue(queue: EvaluationQueue): Promise<void> {
    queue.status = 'processing';
    this.currentProcessing++;

    try {
      
      const chunkSize = queue.options.chunkSize || 25;
      const chunks = this.splitIntoChunks(queue.elements, chunkSize);
      const results: EvaluationResult[] = [];

      for (let i = 0; i < chunks.length; i++) {
        
        if (!this.queues.has(queue.id)) break;

        const chunkResults = await this.engine.evaluate(chunks[i] as Element[], queue.options);
        results.push(...chunkResults);

        
        const progress = ((i + 1) / chunks.length) * 100;
        this.updateQueueProgress(queue.id, progress);
      }

      
      queue.status = 'complete';
      queue.results = results;
      this.completedCallback?.(queue);

      
      setTimeout(() => {
        this.queues.delete(queue.id);
      }, 60000); 
    } catch (error) {
      queue.status = 'error';
      queue.error = error as Error;
      this.errorCallback?.(queue, error as Error);
    } finally {
      this.currentProcessing--;
    }
  }

  


  private splitIntoChunks<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  


  private updateQueueProgress(id: string, progress: number): void {
    const queue = this.queues.get(id);
    if (queue) {
      
    }
  }

  


  private generateQueueId(): string {
    return `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  


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

  


  clearCompleted(): void {
    for (const [id, queue] of this.queues) {
      if (queue.status === 'complete' || queue.status === 'error') {
        this.queues.delete(id);
      }
    }
  }

  


  stop(): void {
    if (this.processTimer) {
      clearTimeout(this.processTimer);
      this.processTimer = null;
    }
    
    this.processing = false;
    this.engine.cancelAll();
  }
}
