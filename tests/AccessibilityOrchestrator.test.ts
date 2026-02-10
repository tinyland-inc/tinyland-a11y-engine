import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AccessibilityOrchestrator } from '../src/AccessibilityOrchestrator';
import { DOMSampler } from '../src/sampler/DOMSampler';
import { StreamingClient } from '../src/streaming/StreamingClient';
import { ContrastAnalyzer } from '../src/engine/ContrastAnalyzer';
import type { EvaluationConfig, EvaluationResult, EvaluationStats } from '../src/types';

// Mock dependencies
vi.mock('../src/sampler/DOMSampler');
vi.mock('../src/streaming/StreamingClient');
vi.mock('../src/engine/ContrastAnalyzer');

describe('AccessibilityOrchestrator', () => {
  let config: EvaluationConfig;
  let onResultsMock: (results: EvaluationResult[], stats: EvaluationStats) => void;
  let orchestrator: AccessibilityOrchestrator;
  let mockSampler: any;
  let mockContrastAnalyzer: any;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      enabled: true,
      samplingStrategy: {
        type: 'viewport',
        sampleSize: 50,
        interval: 30000
      },
      streamingEnabled: false,
      batchSize: 50,
      batchInterval: 100,
      maxMemoryMB: 50,
      evaluationInterval: 30000,
      viewportOnly: true
    };

    // Cast mock to match expected signature for TS7 compatibility
    onResultsMock = vi.fn() as unknown as (results: EvaluationResult[], stats: EvaluationStats) => void;

    // Setup mocks
    mockSampler = {
      sampleElements: vi.fn().mockReturnValue([]),
      observeChanges: vi.fn(),
      destroy: vi.fn()
    };
    (DOMSampler as any).mockImplementation(() => mockSampler);

    mockContrastAnalyzer = {
      analyzeElement: vi.fn(),
      destroy: vi.fn()
    };
    (ContrastAnalyzer as any).mockImplementation(() => mockContrastAnalyzer);
    (StreamingClient as any).mockImplementation(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn().mockResolvedValue(undefined),
      sendEvaluation: vi.fn().mockResolvedValue(undefined),
      sendHeartbeat: vi.fn(),
      getStatus: vi.fn().mockReturnValue({ connected: true, queueSize: 0, retryAttempts: 0 })
    }));
  });

  afterEach(() => {
    if (orchestrator) {
      orchestrator.stop();
    }
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      orchestrator = new AccessibilityOrchestrator(config, onResultsMock);

      expect(DOMSampler).toHaveBeenCalledWith(config.samplingStrategy);
      expect(ContrastAnalyzer).toHaveBeenCalled();
    });

    it('should not create StreamingClient when streaming is disabled', () => {
      orchestrator = new AccessibilityOrchestrator(config, onResultsMock);

      expect(StreamingClient).not.toHaveBeenCalled();
    });

    it('should create StreamingClient when streaming is enabled', () => {
      config.streamingEnabled = true;
      orchestrator = new AccessibilityOrchestrator(config, onResultsMock);

      expect(StreamingClient).toHaveBeenCalled();
    });
  });

  describe('Start/Stop Lifecycle', () => {
    beforeEach(() => {
      orchestrator = new AccessibilityOrchestrator(config, onResultsMock);
    });

    it('should not start when disabled', () => {
      config.enabled = false;
      orchestrator = new AccessibilityOrchestrator(config, onResultsMock);
      const evaluateSpy = vi.spyOn(orchestrator as any, 'evaluate');

      orchestrator.start();

      expect(evaluateSpy).not.toHaveBeenCalled();
    });

    it('should connect streaming client when enabled', () => {
      config.streamingEnabled = true;
      orchestrator = new AccessibilityOrchestrator(config, onResultsMock);

      const mockStreamingClient = (StreamingClient as any).mock.results[0].value;
      const connectSpy = vi.spyOn(mockStreamingClient, 'connect');

      orchestrator.start();

      expect(connectSpy).toHaveBeenCalled();
    });

    it('should stop all operations on stop', () => {
      vi.useFakeTimers();
      orchestrator.start();
      orchestrator.stop();

      // Should not trigger more evaluations
      vi.advanceTimersByTime(config.evaluationInterval);

      expect(mockSampler.destroy).toHaveBeenCalled();
      expect(mockContrastAnalyzer.destroy).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Evaluation Process', () => {
    beforeEach(() => {
      orchestrator = new AccessibilityOrchestrator(config, onResultsMock);
    });

    it('should skip invisible elements', async () => {
      const visibleElement = document.createElement('p');
      visibleElement.textContent = 'Visible';

      const hiddenElement = document.createElement('p');
      hiddenElement.textContent = 'Hidden';
      hiddenElement.style.display = 'none';

      document.body.appendChild(visibleElement);
      document.body.appendChild(hiddenElement);

      mockSampler.sampleElements.mockReturnValue([visibleElement, hiddenElement]);

      await (orchestrator as any).evaluate();

      expect(mockContrastAnalyzer.analyzeElement).toHaveBeenCalledTimes(1);
      expect(mockContrastAnalyzer.analyzeElement).toHaveBeenCalledWith(visibleElement);

      // Cleanup
      document.body.removeChild(visibleElement);
      document.body.removeChild(hiddenElement);
    });

    it('should skip elements without text', async () => {
      const elementWithText = document.createElement('p');
      elementWithText.textContent = 'Text';

      const emptyElement = document.createElement('p');
      emptyElement.textContent = '';

      mockSampler.sampleElements.mockReturnValue([elementWithText, emptyElement]);

      await (orchestrator as any).evaluate();

      expect(mockContrastAnalyzer.analyzeElement).toHaveBeenCalledTimes(1);
      expect(mockContrastAnalyzer.analyzeElement).toHaveBeenCalledWith(elementWithText);
    });

    it('should respect memory limits', async () => {
      const getMemoryUsageSpy = vi.spyOn(orchestrator as any, 'getMemoryUsage');
      getMemoryUsageSpy.mockReturnValue(config.maxMemoryMB + 10);

      await (orchestrator as any).evaluate();

      expect(mockContrastAnalyzer.analyzeElement).not.toHaveBeenCalled();
      expect(onResultsMock).not.toHaveBeenCalled();
    });

    it('should handle evaluation errors gracefully', async () => {
      mockSampler.sampleElements.mockImplementation(() => {
        throw new Error('Sample error');
      });

      await expect((orchestrator as any).evaluate()).resolves.not.toThrow();
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      orchestrator = new AccessibilityOrchestrator(config, onResultsMock);
    });

    it('should provide current stats via getStats', () => {
      const stats = orchestrator.getStats();

      expect(stats).toEqual({
        totalElements: 0,
        evaluatedElements: 0,
        issues: 0,
        criticalIssues: 0,
        evaluationTimeMs: 0,
        memoryUsageMB: 0
      });
    });
  });

  describe('Configuration Updates', () => {
    beforeEach(() => {
      orchestrator = new AccessibilityOrchestrator(config, onResultsMock);
    });

    it('should restart with new configuration', () => {
      const stopSpy = vi.spyOn(orchestrator, 'stop');
      const startSpy = vi.spyOn(orchestrator, 'start');

      orchestrator.updateConfig({
        evaluationInterval: 60000
      });

      expect(stopSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalled();
    });
  });
});
