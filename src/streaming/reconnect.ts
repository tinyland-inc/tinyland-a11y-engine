



export interface ReconnectOptions {
  
  initialDelay?: number;
  
  maxDelay?: number;
  
  multiplier?: number;
  
  maxAttempts?: number;
}

export class ReconnectStrategy {
  private initialDelay: number;
  private maxDelay: number;
  private multiplier: number;
  private maxAttempts: number;
  private attempts: number = 0;
  private currentDelay: number;

  constructor(options: ReconnectOptions = {}) {
    this.initialDelay = options.initialDelay ?? 1000;
    this.maxDelay = options.maxDelay ?? 30000;
    this.multiplier = options.multiplier ?? 2;
    this.maxAttempts = options.maxAttempts ?? 10;
    this.currentDelay = this.initialDelay;
  }

  getNextDelay(): number {
    if (this.attempts >= this.maxAttempts) {
      return -1; 
    }

    const delay = this.currentDelay;
    this.currentDelay = Math.min(this.currentDelay * this.multiplier, this.maxDelay);
    this.attempts++;
    return delay;
  }

  reset(): void {
    this.attempts = 0;
    this.currentDelay = this.initialDelay;
  }

  getAttempts(): number {
    return this.attempts;
  }

  shouldReconnect(): boolean {
    return this.attempts < this.maxAttempts;
  }
}
