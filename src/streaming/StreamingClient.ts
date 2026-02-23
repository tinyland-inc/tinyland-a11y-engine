import type { StreamMessage, EvaluationResult } from '../types';












export class StreamingClient {
  private messageQueue: StreamMessage[] = [];
  private isConnected = false;
  private batchTimer: number | null = null;
  private batchSize = 50;
  private batchInterval = 100; 
  private retryAttempts = 0;
  private maxRetryAttempts = 5;
  private retryDelay = 1000;

  constructor(
    private url: string,
    private onMessage?: (data: any) => void,
    private onError?: (error: Error) => void
  ) {}

  



  connect() {
    try {
      console.log('[A11y Stream] Connecting via HTTP...');

      
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
  
  


  sendEvaluation(results: EvaluationResult[]) {
    const message: StreamMessage = {
      type: 'evaluation',
      timestamp: Date.now(),
      data: results
    };
    
    this.messageQueue.push(message);
    
    
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
    
    
    const batch = this.messageQueue.splice(0, this.batchSize);
    
    
    const payload = JSON.stringify(batch);
    const compressed = payload.length > 10000;
    
    const message: StreamMessage = {
      type: 'evaluation',
      timestamp: Date.now(),
      data: compressed ? this.compress(payload) : batch,
      compressed
    };
    
    this.send(message);
    
    
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
    
    
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    
    messages.forEach(msg => this.send(msg));
  }
  
  private compress(data: string): string {
    
    
    return btoa(data);
  }
  
  


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

  


  getStatus() {
    return {
      connected: this.isConnected,
      queueSize: this.messageQueue.length,
      retryAttempts: this.retryAttempts
    };
  }

  
  private eventListeners = new Map<string, Array<(...args: any[]) => void>>();

  


  emit(event: string, data: any) {
    const message: StreamMessage = {
      type: event as any,
      timestamp: Date.now(),
      data
    };
    this.send(message);
  }

  


  on(event: string, callback: (...args: any[]) => void) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  


  isConnectedMethod() {
    return this.isConnected;
  }
}
