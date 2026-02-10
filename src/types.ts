// Color types for accessibility testing
export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface RGBA extends RGB {
  a: number;
}

// Theme types
export interface Theme {
  mode: 'light' | 'dark';
  variant: 'default' | 'high-contrast' | 'colorblind-safe';
}

// Component state types
export interface ComponentState {
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
  focused?: boolean;
  hovered?: boolean;
  pressed?: boolean;
  selected?: boolean;
  readonly?: boolean;
}

// Core accessibility event types
export interface AccessibilityEvent {
  type: string;
  timestamp: number;
  data: any;
}

export interface AccessibilityIssue extends EvaluationResult {
  severity: 'error' | 'warning' | 'info';
  rule: string;
  element: ElementReference;
}

export interface ElementReference {
  selector: string;
  tagName: string;
  attributes: Record<string, string>;
  text: string;
  bounds: DOMRect;
}

export interface EvaluationContext {
  options: EvaluationOptions;
  signal: AbortSignal;
  ruleFilter?: string[];
  viewport: ViewportInfo;
  timestamp: number;
  document: Document;
  window: Window;
}

export interface EvaluationOptions {
  memoryLimit?: number;
  chunkSize?: number;
  sampling?: SamplingStrategy;
  ruleFilter?: string[];
  timeout?: number;
}

export interface EvaluationPlugin {
  id: string;
  name?: string;
  version?: string;
  description?: string;
  rules?: EvaluationRule[];
  initialize?: (engine: any) => void;
  destroy?: () => void;
}

/**
 * Partial result returned by rules - engine adds id, timestamp, selector etc.
 */
export interface RuleResult {
  severity: 'error' | 'warning' | 'info';
  message: string;
  category?: string;
  wcagCriteria?: string | string[];
  details?: Record<string, any>;
}

export interface EvaluationRule {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  severity?: 'error' | 'warning' | 'info' | 'critical' | 'serious' | 'moderate' | 'minor';
  wcagCriteria?: string[];
  selector?: string;
  condition?: (element: Element, context: EvaluationContext) => boolean;
  evaluate: (element: Element, context: EvaluationContext) => Promise<EvaluationResult | RuleResult | null>;
}

export interface ViewportInfo {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
}

export interface AccessibilityReport {
  timestamp: number;
  issues: AccessibilityIssue[];
  score: number;
  viewport: ViewportInfo;
}

export interface MemoryStats {
  used: number;
  limit: number;
  pressure: 'low' | 'medium' | 'high' | 'critical';
}

// Accessibility evaluation types
export interface EvaluationResult {
  id: string;
  timestamp?: number;
  type: 'contrast' | 'text' | 'aria' | 'keyboard' | 'structure' | 'collision' | 'error' | 'warning';
  severity: 'error' | 'warning' | 'info';
  wcagLevel: 'A' | 'AA' | 'AAA';
  wcagCriteria: string;
  selector: string;
  message: string;
  line?: number;
  column?: number;
  ruleId?: string;
  metadata?: Record<string, any>;
  details?: Record<string, any>;
  element?: ElementReference | {
    tagName: string;
    className?: string;
    id?: string;
    text?: string;
    html?: string;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
}

export interface ContrastEvaluation extends EvaluationResult {
  type: 'contrast';
  metadata: {
    foreground: string;
    background: string;
    ratio: number;
    largeText: boolean;
    requiredRatio: number;
    pixelSamples?: number;
    edgeContrastIssue?: boolean;
    textElement?: string;
    backgroundElement?: string;
    fontSize?: number;
    fontWeight?: string;
    contrastMode?: string;
    variantClasses?: string[];
  };
}

export interface SamplingStrategy {
  type: 'viewport' | 'random' | 'priority' | 'adaptive' | 'fixed' | 'event-driven' | 'hybrid';
  strategy?: 'viewport' | 'random' | 'priority' | 'adaptive' | 'fixed' | 'event-driven' | 'hybrid';
  sampleSize?: number;
  interval?: number;
  rate?: number;
  adaptiveThreshold?: number;
  regions?: string[];
  exclude?: string[];
  maxElements?: number;
  throttleMs?: number;
}

export interface StreamMessage {
  type: 'evaluation' | 'heartbeat' | 'config' | 'error' | 'result' | 'progress' | 'complete';
  /** Unique message identifier */
  id?: string;
  timestamp: number;
  /** Legacy data field */
  data?: any;
  /** Payload field (alias for data) */
  payload?: any;
  compressed?: boolean;
  sessionId?: string;
}

export interface EvaluationConfig {
  enabled: boolean;
  samplingStrategy: SamplingStrategy;
  streamingEnabled: boolean;
  /** Endpoint URL for streaming client (defaults to window.location.origin) */
  streamingEndpoint?: string;
  batchSize: number;
  batchInterval: number;
  maxMemoryMB: number;
  evaluationInterval: number;
  viewportOnly: boolean;
}

export interface EvaluationStats {
  totalElements: number;
  evaluatedElements: number;
  issues: number;
  criticalIssues: number;
  evaluationTimeMs: number;
  memoryUsageMB: number;
}

// Batch evaluation result containing multiple issues
export interface BatchEvaluationResult {
  id: string;
  startTime: number;
  endTime: number;
  issues: AccessibilityIssue[];
  metrics: PerformanceMetrics;
  metadata: {
    elementsTotal: number;
    elementsEvaluated: number;
    rulesApplied: number;
    wcagVersion: string;
    wcagLevel: string;
  };
}

// Performance metrics for evaluation
export interface PerformanceMetrics {
  duration: number;
  elementsEvaluated: number;
  rulesExecuted: number;
  memoryUsed: number;
  cpuUsage: number;
  workerUtilization: number;
}

// Streaming types
export interface EvaluationBatch {
  sequence: number;
  issues: AccessibilityIssue[];
  summary: BatchSummary;
  metrics: PerformanceMetrics;
}

export interface BatchSummary {
  totalIssues: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  newIssues: number;
  resolvedIssues: number;
}

export interface HeartbeatData {
  health: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  messagesSent: number;
  configHash: string;
}

export interface ConfigUpdate {
  requiresRestart?: boolean;
  [key: string]: any;
}

export interface ErrorData {
  code: string;
  message: string;
  recoverable: boolean;
  retryAfter?: number;
}

// Sampling configuration
export interface SamplingConfig {
  strategy: 'fixed' | 'adaptive' | 'event-driven' | 'hybrid';
  interval: number;
  regions?: string[];
  exclude?: string[];
  maxElements?: number;
  triggers?: EvaluationTrigger[];
}

export interface EvaluationTrigger {
  type: 'scroll' | 'resize' | 'mutation' | 'focus' | 'theme-change' | 'route-change';
  debounce?: number;
  throttle?: number;
  options?: Record<string, any>;
}

// Custom rule type for evaluation engine
export interface CustomRule {
  id: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  wcagCriteria?: string[];
  evaluate: (element: Element, context: any) => Promise<{ passed: boolean; violation?: any }>;
}

/**
 * Queue for managing batched accessibility evaluations
 */
export interface EvaluationQueue {
  id: string;
  elements: Element[];
  options: EvaluationOptions;
  priority: number;
  status: 'pending' | 'processing' | 'complete' | 'error';
  results?: EvaluationResult[];
  error?: Error;
}

export interface EvaluationQueueItem {
  id: string;
  elements: Element[];
  options: EvaluationOptions;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: EvaluationResult;
  error?: Error;
}

/**
 * Main accessibility configuration object
 */
export interface AccessibilityConfig {
  /** WebSocket endpoint for streaming results */
  endpoint: string;
  /** Authentication token for WebSocket */
  authToken?: string;
  /** Evaluation settings */
  evaluation: {
    /** WCAG version (2.1 or 2.2) */
    wcag: '2.1' | '2.2';
    /** WCAG conformance level */
    level: 'A' | 'AA' | 'AAA';
    /** Custom rules to register */
    customRules?: CustomRule[];
  };
  /** Sampling configuration */
  sampling: SamplingConfig;
  /** Performance settings */
  performance: {
    /** Use web workers for evaluation */
    useWorkers: boolean;
    /** Maximum number of workers */
    maxWorkers?: number;
    /** Batch size for processing */
    batchSize?: number;
    /** Compression mode for streaming */
    compression?: 'none' | 'gzip' | 'deflate';
  };
  /** Privacy settings */
  privacy: {
    /** Redact text content in reports */
    redactText: boolean;
    /** Attributes to exclude from reports */
    excludeAttributes?: string[];
  };
}