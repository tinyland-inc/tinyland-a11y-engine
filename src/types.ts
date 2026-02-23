
export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface RGBA extends RGB {
  a: number;
}


export interface Theme {
  mode: 'light' | 'dark';
  variant: 'default' | 'high-contrast' | 'colorblind-safe';
}


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
    themeInfo?: unknown;
    isNearIdentical?: boolean;
    isInvisible?: boolean;
    computedStyles?: Record<string, string | number>;
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
  
  id?: string;
  timestamp: number;
  
  data?: any;
  
  payload?: any;
  compressed?: boolean;
  sessionId?: string;
}

export interface EvaluationConfig {
  enabled: boolean;
  samplingStrategy: SamplingStrategy;
  streamingEnabled: boolean;
  
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


export interface PerformanceMetrics {
  duration: number;
  elementsEvaluated: number;
  rulesExecuted: number;
  memoryUsed: number;
  cpuUsage: number;
  workerUtilization: number;
}


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


export interface CustomRule {
  id: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  wcagCriteria?: string[];
  evaluate: (element: Element, context: any) => Promise<{ passed: boolean; violation?: any }>;
}




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




export interface AccessibilityConfig {
  
  endpoint: string;
  
  authToken?: string;
  
  evaluation: {
    
    wcag: '2.1' | '2.2';
    
    level: 'A' | 'AA' | 'AAA';
    
    customRules?: CustomRule[];
  };
  
  sampling: SamplingConfig;
  
  performance: {
    
    useWorkers: boolean;
    
    maxWorkers?: number;
    
    batchSize?: number;
    
    compression?: 'none' | 'gzip' | 'deflate';
  };
  
  privacy: {
    
    redactText: boolean;
    
    excludeAttributes?: string[];
  };
}
