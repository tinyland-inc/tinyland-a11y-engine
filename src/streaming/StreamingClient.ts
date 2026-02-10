import type { StreamMessage, EvaluationResult } from '../types';

/**
 * StreamingClient for A11y Observability
 *
 * Streams accessibility evaluation results to the backend observability stack.
 * Uses HTTP POST with fallback to batching for reliability.
 *
 * Architecture:
 * - Primary: HTTP POST to /api/a11y/stream (reliable, works everywhere)
 * - Batching: Collects multiple evaluations before sending
 * - Retry: Exponential backoff on failures
 */
export class StreamingClient {
  private messageQueue: StreamMessage[] = [];
  private isConnected = false;
  private batchTimer: number | null = null;
  private batchSize = 50;
  private batchInterval = 100; // ms
  private retryAttempts = 0;
  private maxRetryAttempts = 5;
  private retryDelay = 1000;

  constructor(
    private url: string,
    private onMessage?: (data: any) => void,
    private onError?: (error: Error) => void
  ) {}

  /**
   * Connect using HTTP fallback (always available)
   * No WebSocket connection needed - uses fetch API
   */
  connect() {
    try {
      console.log('[A11y Stream] Connecting via HTTP...');

      // Test connection with a heartbeat
      fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'heartbeat',
          timestamp: Date.now(),
          data: null
        })
      })
      .then(response => {
        if (response.ok) {
          console.log('[A11y Stream] Connected via HTTP');
          this.isConnected = true;
          this.retryAttempts = 0;

          // Flush queued messages
          this.flushQueue();
        } else {
          console.warn('[A11y Stream] Connection failed:', response.status);
          this.scheduleReconnect();
        }
      })
      .catch(error => {
        console.error('[A11y Stream] Connection error:', error);
        this.scheduleReconnect();
      });

    } catch (error) {
      console.error('[A11y Stream] Connection error:', error);
      this.scheduleReconnect();
    }
  }
  
  private scheduleReconnect() {
    if (this.retryAttempts >= this.maxRetryAttempts) {
      console.error('[A11y Stream] Max retry attempts reached');
      this.isConnected = false;
      this.onError?.(new Error('Max retry attempts reached'));
      return;
    }

    const delay = this.retryDelay * Math.pow(2, this.retryAttempts);
    this.retryAttempts++;

    console.log(`[A11y Stream] Reconnecting in ${delay}ms (attempt ${this.retryAttempts})...`);
    setTimeout(() => this.connect(), delay);
  }
  
  /**
   * Send evaluation results with batching
   */
  sendEvaluation(results: EvaluationResult[]) {
    const message: StreamMessage = {
      type: 'evaluation',
      timestamp: Date.now(),
      data: results
    };
    
    this.messageQueue.push(message);
    
    // Start batch timer if not already running
    if (!this.batchTimer) {
      this.batchTimer = window.setTimeout(() => {
        this.flushBatch();
      }, this.batchInterval);
    }
  }
  
  private flushBatch() {
    if (this.messageQueue.length === 0) {
      this.batchTimer = null;
      return;
    }
    
    // Get batch of messages
    const batch = this.messageQueue.splice(0, this.batchSize);
    
    // Compress if large
    const payload = JSON.stringify(batch);
    const compressed = payload.length > 10000;
    
    const message: StreamMessage = {
      type: 'evaluation',
      timestamp: Date.now(),
      data: compressed ? this.compress(payload) : batch,
      compressed
    };
    
    this.send(message);
    
    // Continue batching if more messages
    if (this.messageQueue.length > 0) {
      this.batchTimer = window.setTimeout(() => {
        this.flushBatch();
      }, this.batchInterval);
    } else {
      this.batchTimer = null;
    }
  }
  
  private async send(message: StreamMessage) {
    if (!this.isConnected) {
      // Queue for later
      this.messageQueue.unshift(message);
      return;
    }

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        console.warn('[A11y Stream] Send failed:', response.status);
        // Queue for retry
        this.messageQueue.unshift(message);
        this.scheduleReconnect();
      } else {
        const result = await response.json();
        this.onMessage?.(result);
      }
    } catch (error) {
      console.error('[A11y Stream] Send error:', error);
      this.messageQueue.unshift(message);
      this.scheduleReconnect();
    }
  }
  
  private flushQueue() {
    if (!this.isConnected || this.messageQueue.length === 0) return;
    
    // Send all queued messages
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    
    messages.forEach(msg => this.send(msg));
  }
  
  private compress(data: string): string {
    // Simple compression placeholder
    // In production, use a proper compression library like pako
    return btoa(data);
  }
  
  /**
   * Send heartbeat to keep connection alive
   */
  sendHeartbeat() {
    const message: StreamMessage = {
      type: 'heartbeat',
      timestamp: Date.now(),
      data: null
    };
    
    this.send(message);
  }
  
  disconnect() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    this.isConnected = false;
    console.log('[A11y Stream] Disconnected');
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      queueSize: this.messageQueue.length,
      retryAttempts: this.retryAttempts
    };
  }

  // Socket.IO compatibility methods for globalAccessibility store
  private eventListeners = new Map<string, Array<(...args: any[]) => void>>();

  /**
   * Socket.IO-style emit (sends via HTTP POST)
   */
  emit(event: string, data: any) {
    const message: StreamMessage = {
      type: event as any,
      timestamp: Date.now(),
      data
    };
    this.send(message);
  }

  /**
   * Socket.IO-style event listener
   */
  on(event: string, callback: (...args: any[]) => void) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Check if connected (method form for optional chaining)
   */
  isConnectedMethod() {
    return this.isConnected;
  }
}