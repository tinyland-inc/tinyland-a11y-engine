






import type {
  AccessibilityConfig,
  StreamMessage,
  EvaluationBatch,
  AccessibilityIssue,
  HeartbeatData,
  ConfigUpdate,
  ErrorData,
  BatchSummary,
  PerformanceMetrics
} from '../types';
import { EventEmitter } from '../engine/events';
import { MessageQueue } from './queue';
import { Compressor } from './compression';
import { ReconnectStrategy } from './reconnect';

export class StreamingProtocol extends EventEmitter {
  private config: AccessibilityConfig;
  private ws?: WebSocket;
  private queue: MessageQueue;
  private compressor: Compressor;
  private reconnectStrategy: ReconnectStrategy;
  private isConnected = false;
  private sequenceNumber = 0;
  private messagesSent = 0;
  private startTime = Date.now();
  private heartbeatInterval?: number;
  private batchBuffer: AccessibilityIssue[] = [];
  private batchTimer?: number;
  
  constructor(config: AccessibilityConfig) {
    super();
    this.config = config;
    this.queue = new MessageQueue(config.performance.batchSize || 50);
    this.compressor = new Compressor(config.performance.compression || 'none');
    this.reconnectStrategy = new ReconnectStrategy();
  }
  
  


  async connect(): Promise<void> {
    if (this.isConnected) return;
    
    try {
      
      const url = this.buildConnectionUrl();
      
      
      this.ws = new WebSocket(url);
      
      
      this.setupWebSocketHandlers();
      
      
      await this.waitForConnection();
      
      
      this.startHeartbeat();
      
      
      this.processQueue();
      
    } catch (error) {
      this.emit('error', {
        code: 'CONNECTION_FAILED',
        message: 'Failed to connect to streaming endpoint',
        error
      });
      
      
      this.scheduleReconnect();
      throw error;
    }
  }
  
  


  private buildConnectionUrl(): string {
    const url = new URL(this.config.endpoint);
    
    
    if (this.config.authToken) {
      url.searchParams.set('token', this.config.authToken);
    }
    
    
    url.searchParams.set('client', 'accessibility-stream');
    url.searchParams.set('version', '1.0.0');
    
    return url.toString();
  }
  
  


  private setupWebSocketHandlers(): void {
    if (!this.ws) return;
    
    this.ws.onopen = () => {
      this.isConnected = true;
      this.reconnectStrategy.reset();
      this.emit('connected');
    };
    
    this.ws.onclose = (event) => {
      this.isConnected = false;
      this.stopHeartbeat();
      this.emit('disconnected', { code: event.code, reason: event.reason });
      
      
      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };
    
    this.ws.onerror = (event) => {
      this.emit('error', {
        code: 'WEBSOCKET_ERROR',
        message: 'WebSocket error occurred',
        event
      });
    };
    
    this.ws.onmessage = async (event) => {
      try {
        const message = await this.parseMessage(event.data);
        this.handleMessage(message);
      } catch (error) {
        this.emit('error', {
          code: 'MESSAGE_PARSE_ERROR',
          message: 'Failed to parse incoming message',
          error
        });
      }
    };
  }
  
  


  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);
      
      const checkConnection = () => {
        if (this.isConnected) {
          clearTimeout(timeout);
          resolve();
        } else if (this.ws?.readyState === WebSocket.CLOSED) {
          clearTimeout(timeout);
          reject(new Error('Connection closed'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      
      checkConnection();
    });
  }
  
  


  private async parseMessage(data: string | ArrayBuffer): Promise<StreamMessage> {
    
    const decompressed = await this.compressor.decompress(data);
    
    
    return JSON.parse(decompressed);
  }
  
  


  private handleMessage(message: StreamMessage): void {
    switch (message.type) {
      case 'config':
        this.handleConfigUpdate(message.payload as ConfigUpdate);
        break;
        
      case 'error':
        this.handleError(message.payload as ErrorData);
        break;
        
      case 'heartbeat':
        
        break;
        
      default:
        this.emit('message', message);
    }
  }
  
  


  private handleConfigUpdate(update: ConfigUpdate): void {
    this.emit('config-changed', update);
    
    if (update.requiresRestart) {
      this.reconnect();
    }
  }
  
  


  private handleError(error: ErrorData): void {
    this.emit('error', error);
    
    if (!error.recoverable) {
      this.disconnect();
    } else if (error.retryAfter) {
      setTimeout(() => this.reconnect(), error.retryAfter * 1000);
    }
  }
  
  


  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      this.sendHeartbeat();
    }, 30000); 
  }
  
  


  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }
  
  


  private sendHeartbeat(): void {
    const heartbeat: HeartbeatData = {
      health: this.getStreamHealth(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      messagesSent: this.messagesSent,
      configHash: this.getConfigHash()
    };
    
    this.sendMessage({
      type: 'heartbeat',
      id: this.generateMessageId(),
      timestamp: Date.now(),
      payload: heartbeat
    });
  }
  
  


  private getStreamHealth(): 'healthy' | 'degraded' | 'unhealthy' {
    if (!this.isConnected) return 'unhealthy';
    if (this.queue.size() > 100) return 'degraded';
    return 'healthy';
  }
  
  


  private getConfigHash(): string {
    
    return btoa(JSON.stringify(this.config)).substring(0, 8);
  }
  
  


  private scheduleReconnect(): void {
    const delay = this.reconnectStrategy.getNextDelay();
    
    if (delay > 0) {
      setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
    }
  }
  
  


  async sendIssues(issues: AccessibilityIssue[]): Promise<void> {
    
    this.batchBuffer.push(...issues);
    
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    
    if (this.batchBuffer.length >= (this.config.performance.batchSize || 50)) {
      await this.flushBatch();
    } else {
      
      this.batchTimer = window.setTimeout(() => {
        this.flushBatch();
      }, 100); 
    }
  }
  
  


  private async flushBatch(): Promise<void> {
    if (this.batchBuffer.length === 0) return;
    
    
    const issues = [...this.batchBuffer];
    this.batchBuffer = [];
    
    
    const batch: EvaluationBatch = {
      sequence: ++this.sequenceNumber,
      issues,
      summary: this.createBatchSummary(issues),
      metrics: this.createBatchMetrics()
    };
    
    
    const message: StreamMessage = {
      type: 'evaluation',
      id: this.generateMessageId(),
      timestamp: Date.now(),
      payload: batch
    };
    
    if (this.isConnected) {
      await this.sendMessage(message);
    } else {
      this.queue.enqueue(message);
    }
  }
  
  


  private createBatchSummary(issues: AccessibilityIssue[]): BatchSummary {
    const bySeverity: any = {};
    const byType: any = {};
    
    issues.forEach(issue => {
      bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
      byType[issue.type] = (byType[issue.type] || 0) + 1;
    });
    
    return {
      totalIssues: issues.length,
      bySeverity,
      byType,
      newIssues: issues.filter(i => i.metadata?.occurrences === 1).length,
      resolvedIssues: 0 
    };
  }
  
  


  private createBatchMetrics(): PerformanceMetrics {
    
    return {
      duration: 0,
      elementsEvaluated: 0,
      rulesExecuted: 0,
      memoryUsed: 0,
      cpuUsage: 0,
      workerUtilization: 0
    };
  }
  
  


  private async sendMessage(message: StreamMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queue.enqueue(message);
      return;
    }
    
    try {
      
      const compressed = await this.compressor.compress(JSON.stringify(message));
      
      
      this.ws.send(compressed);
      this.messagesSent++;
      
      this.emit('message:sent', message);
      
    } catch (error) {
      this.emit('error', {
        code: 'SEND_ERROR',
        message: 'Failed to send message',
        error
      });
      
      
      this.queue.enqueue(message);
    }
  }
  
  


  private async processQueue(): Promise<void> {
    if (!this.isConnected) return;
    
    while (this.queue.size() > 0) {
      const message = this.queue.dequeue();
      if (message) {
        await this.sendMessage(message);
        
        
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }
  
  


  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  


  async reconnect(): Promise<void> {
    this.disconnect();
    await this.connect();
  }
  
  


  disconnect(): void {
    this.isConnected = false;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = undefined;
    }
    
    this.emit('disconnected', { code: 1000, reason: 'Normal closure' });
  }
  
  


  getStatus(): {
    connected: boolean;
    queueSize: number;
    messagesSent: number;
    uptime: number;
  } {
    return {
      connected: this.isConnected,
      queueSize: this.queue.size(),
      messagesSent: this.messagesSent,
      uptime: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }
  
  


  destroy(): void {
    this.disconnect();
    this.queue.clear();
    this.removeAllListeners();
  }
}
