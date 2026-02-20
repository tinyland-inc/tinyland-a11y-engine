/**
 * Worker Pool - Stub module for web worker management
 */

export interface WorkerResult {
  passed: boolean;
  violation?: {
    message: string;
    element?: any;
    details?: Record<string, any>;
  };
  elementIndex?: number;
  ruleId?: string;
}

export class WorkerPool {
  private maxWorkers: number;

  constructor(maxWorkers: number = 4) {
    this.maxWorkers = maxWorkers;
  }

  async processBatches<T>(tasks: T[], _batchSize: number): Promise<WorkerResult[]> {
    // Stub implementation - returns empty results
    return [];
  }

  async terminate(): Promise<void> {
    // Cleanup workers
  }

  getWorkerCount(): number {
    return this.maxWorkers;
  }
}
