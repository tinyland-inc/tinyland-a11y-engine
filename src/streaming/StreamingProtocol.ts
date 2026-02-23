



import type { StreamMessage, EvaluationResult } from '../types';

export class StreamingProtocol {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageQueue: StreamMessage[] = [];
  private sessionId: string;
  private url: string;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private compressionThreshold = 1024; 
  private isReconnecting = false;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(url: string, sessionId?: string) {
    this.url = url;
    this.sessionId = sessionId || this.generateSessionId();
  }

  


  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isReconnecting = false;
          this.reconnectDelay = 1000;
          this.flushQueue();
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.ws = null;
          
          if (!event.wasClean && !this.isReconnecting) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (!this.isReconnecting) {
            reject(error);
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  


  disconnect(): void {
    this.isReconnecting = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  


  sendResult(result: EvaluationResult): void {
    const message: StreamMessage = {
      type: 'result',
      data: result,
      timestamp: Date.now(),
      sessionId: this.sessionId
    };

    this.send(message);
  }

  


  sendProgress(progress: {
    processed: number;
    total: number;
    percentage: number;
  }): void {
    const message: StreamMessage = {
      type: 'progress',
      data: progress,
      timestamp: Date.now(),
      sessionId: this.sessionId
    };

    this.send(message);
  }

  


  sendError(error: Error): void {
    const message: StreamMessage = {
      type: 'error',
      data: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      timestamp: Date.now(),
      sessionId: this.sessionId
    };

    this.send(message);
  }

  


  sendComplete(summary: any): void {
    const message: StreamMessage = {
      type: 'complete',
      data: summary,
      timestamp: Date.now(),
      sessionId: this.sessionId
    };

    this.send(message);
  }

  


  on(type: string, callback: (data: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
  }

  


  off(type: string, callback: (data: any) => void): void {
    this.listeners.get(type)?.delete(callback);
  }

  


  private send(message: StreamMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(message);
      return;
    }

    try {
      const data = JSON.stringify(message);
      
      if (data.length > this.compressionThreshold) {
        
        this.sendCompressed(message);
      } else {
        this.ws.send(data);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      this.messageQueue.push(message);
    }
  }

  


  private async sendCompressed(message: StreamMessage): Promise<void> {
    if (!this.ws || !window.CompressionStream) {
      
      this.ws?.send(JSON.stringify(message));
      return;
    }

    try {
      const data = JSON.stringify(message);
      const encoder = new TextEncoder();
      const input = encoder.encode(data);

      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      writer.write(input);
      writer.close();

      const chunks: Uint8Array[] = [];
      const reader = cs.readable.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const compressed = new Blob(chunks as BlobPart[]);
      const arrayBuffer = await compressed.arrayBuffer();

      
      this.ws.send(JSON.stringify({
        ...message,
        _compressed: true,
        _data: btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
      }));
    } catch (error) {
      
      this.ws?.send(JSON.stringify(message));
    }
  }

  


  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      const listeners = this.listeners.get(message.type);
      
      if (listeners) {
        listeners.forEach(callback => {
          try {
            callback(message.data);
          } catch (error) {
            console.error('Message handler error:', error);
          }
        });
      }
    } catch (error) {
      console.error('Failed to handle message:', error);
    }
  }

  


  private scheduleReconnect(): void {
    if (this.isReconnecting || this.reconnectTimer) return;

    this.isReconnecting = true;
    console.log(`Reconnecting in ${this.reconnectDelay}ms...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {
        
        this.reconnectDelay = Math.min(
          this.reconnectDelay * 2,
          this.maxReconnectDelay
        );
        this.isReconnecting = false;
        this.scheduleReconnect();
      });
    }, this.reconnectDelay);
  }

  


  private flushQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  


  private generateSessionId(): string {
    return `a11y-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  


  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  


  get queueSize(): number {
    return this.messageQueue.length;
  }
}
