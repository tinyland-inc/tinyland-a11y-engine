



import type { StreamMessage } from '../types';

export class MessageQueue {
  private queue: StreamMessage[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  enqueue(message: StreamMessage): void {
    if (this.queue.length >= this.maxSize) {
      this.queue.shift(); 
    }
    this.queue.push(message);
  }

  dequeue(): StreamMessage | undefined {
    return this.queue.shift();
  }

  peek(): StreamMessage | undefined {
    return this.queue[0];
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }
}
