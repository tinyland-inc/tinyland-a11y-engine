







export * from './types.js';


export {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  getRelativeLuminance,
  getContrastRatio,
  alphaBlend,
  analyzeContrast as checkContrast,
  parseColor,
  simulateColorBlindness,
  getPerceivedBrightness,
  isLightColor,
  getContrastingColor,
  type HSL,
  type ContrastResult,
  type RGB,
} from './utils/color/index.js';


export { getComputedColor, getEffectiveBackgroundColor } from './contrast.js';




export type { ValidationError, ValidationWarning, ValidationResult, ValidationContext, ValidationOptions } from './validators.js';
export { validateTransparency, validateThemeConsistency, validateFocusIndicator, validateTextSize } from './validators.js';
export * from './validators/index.js';


export * from './actions.js';


export {
  accessibilityPreprocessor,
  accessibilityPreprocessor as createAccessibilityPreprocessor,
} from './preprocessor.js';


export { EventEmitter } from './engine/events.js';


export { AccessibilityOrchestrator } from './AccessibilityOrchestrator.js';


import type {
  AccessibilityIssue,
  EvaluationResult,
  EvaluationConfig,
  BatchEvaluationResult,
  SamplingStrategy,
} from './types.js';
import { EventEmitter } from './engine/events.js';


export interface AccessibilityConfig extends EvaluationConfig {
  streaming?: {
    endpoint?: string;
    batchSize?: number;
    retryAttempts?: number;
  };
  sampling: SamplingStrategy;
  endpoint?: string;
  authToken?: string;
  evaluation?: {
    wcag?: string;
    level?: string;
    depth?: string;
    customRules?: any[];
  };
  performance?: {
    useWorkers?: boolean;
    maxWorkers?: number;
    batchSize?: number;
    compression?: string;
  };
  privacy?: {
    redactText?: boolean;
    excludeAttributes?: string[];
  };
}





export class AccessibilityStream extends EventEmitter {
  private config: AccessibilityConfig;
  private isRunning = false;
  private evaluationQueue: Element[][] = [];
  private isProcessing = false;
  private samplingInterval?: ReturnType<typeof setInterval>;

  constructor(config: AccessibilityConfig) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      this.isRunning = true;

      const interval = this.config.sampling?.interval || 5000;
      this.samplingInterval = setInterval(() => {
        if (this.isRunning) {
          this.performSample();
        }
      }, interval);

      this.emit('started');
    } catch (error) {
      this.emit('error', {
        code: 'START_ERROR',
        message: 'Failed to start accessibility stream',
        error,
      });
      throw error;
    }
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.samplingInterval) {
      clearInterval(this.samplingInterval);
      this.samplingInterval = undefined;
    }

    this.evaluationQueue = [];
    this.emit('stopped');
  }

  pause(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.emit('paused');
  }

  resume(): void {
    this.isRunning = true;
    this.emit('resumed');
  }

  private performSample(): void {
    const sampleSize = this.config.sampling?.sampleSize || 100;
    const elements = Array.from(document.querySelectorAll('*')).slice(0, sampleSize);

    this.emit('sample', {
      elements,
      timestamp: Date.now(),
      sampleNumber: Math.floor(Math.random() * 1000000),
    });
  }

  async evaluate(elements?: Element[]): Promise<EvaluationResult[]> {
    const targetElements = elements || Array.from(document.querySelectorAll('*'));
    const results: EvaluationResult[] = [];

    this.emit('evaluation:complete', { issues: results, metrics: {} });

    return results;
  }

  updateConfig(config: Partial<AccessibilityConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config-updated', this.config);
  }

  getStatus(): {
    running: boolean;
    connected: boolean;
    queueSize: number;
    samplingStats: any;
    streamingStats: any;
  } {
    return {
      running: this.isRunning,
      connected: true,
      queueSize: this.evaluationQueue.length,
      samplingStats: {
        sampleCount: 0,
        currentInterval: this.config.sampling?.interval || 5000,
        strategy: this.config.sampling?.type || 'viewport',
      },
      streamingStats: {
        connected: true,
        queueSize: 0,
        messagesSent: 0,
        uptime: 0,
      },
    };
  }

  registerRule(_rule: any): void {
    
  }

  async destroy(): Promise<void> {
    this.stop();
    this.removeAllListeners();
  }
}


export function createAccessibilityStream(config: AccessibilityConfig): AccessibilityStream {
  return new AccessibilityStream(config);
}




export async function quickContrastCheck(
  foreground: string,
  background: string
): Promise<{
  ratio: number;
  passesAA: boolean;
  passesAAA: boolean;
}> {
  const { parseColor: parse, checkContrast: check } = await import('./contrast.js');

  const fg = parse(foreground);
  const bg = parse(background);

  if (!fg || !bg) {
    throw new Error('Invalid color format');
  }

  const result = check(fg, bg);

  return {
    ratio: result.ratio,
    passesAA: result.passesAA,
    passesAAA: result.passesAAA,
  };
}
