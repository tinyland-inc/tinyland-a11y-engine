/**
 * Example Integration of the Accessibility Evaluation Engine
 * 
 * This demonstrates how to use the new engine to replace the problematic
 * axe-core implementation that was causing Chrome crashes.
 */

import { EvaluationEngine } from './core/EvaluationEngine';
import { QueueManager } from './core/QueueManager';
import { StreamingProtocol } from './streaming/StreamingProtocol';
import type { EvaluationResult } from './types';

/**
 * Initialize the accessibility evaluation system
 */
export async function initializeAccessibilityEngine() {
  // Create engine with conservative limits
  const engine = new EvaluationEngine({
    memoryLimit: 20 * 1024 * 1024, // 20MB limit
    chunkSize: 10 // Very small chunks
  });

  // Load plugins dynamically
  const plugins = await Promise.all([
    import('./plugins/wcag-aa'),
    import('./plugins/aria-validator'),
    import('./plugins/color-contrast'),
    import('./plugins/keyboard-navigation')
  ]);

  plugins.forEach(module => {
    if (module.default) {
      engine.registerPlugin(module.default);
    }
  });

  // Create queue manager for incremental processing
  const queueManager = new QueueManager(engine);

  // Optional: Setup streaming for real-time results
  let streaming: StreamingProtocol | null = null;
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    streaming = new StreamingProtocol('ws://localhost:3001/accessibility');
    await streaming.connect().catch(console.error);
  }

  return { engine, queueManager, streaming };
}

/**
 * Safe evaluation with proper cleanup
 */
export async function evaluatePageAccessibility(
  engine: EvaluationEngine,
  options = {}
) {
  // Exclude the accessibility UI itself
  const elements = document.querySelectorAll(
    'body *:not(.a11y-monitor):not(.a11y-monitor *)'
  );

  // Use viewport sampling by default
  const results = await engine.evaluate(Array.from(elements), {
    sampling: {
      type: 'viewport',
      strategy: 'viewport',
      sampleSize: 100,
      interval: 5000,
      rate: 0.2 // Only 20% of elements
    },
    chunkSize: 10,
    ...options
  });

  return results;
}

/**
 * Setup mutation observer with debouncing
 */
export function observePageChanges(
  callback: () => void,
  debounceMs = 5000
) {
  let timeoutId: NodeJS.Timeout;
  
  const observer = new MutationObserver(() => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(callback, debounceMs);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-label', 'aria-labelledby', 'role', 'alt']
  });

  return () => {
    clearTimeout(timeoutId);
    observer.disconnect();
  };
}

/**
 * Example usage in a Svelte component
 */
export const exampleUsage = `
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    initializeAccessibilityEngine, 
    evaluatePageAccessibility,
    observePageChanges 
  } from '@tinyland-inc/tinyland-a11y-engine';

  let engine;
  let results = [];
  let cleanup;

  onMount(async () => {
    // Initialize once
    const { engine: e } = await initializeAccessibilityEngine();
    engine = e;

    // Initial evaluation
    results = await evaluatePageAccessibility(engine);

    // Setup observer with 30-second debounce
    cleanup = observePageChanges(async () => {
      results = await evaluatePageAccessibility(engine);
    }, 30000);
  });

  onDestroy(() => {
    cleanup?.();
    engine?.cancelAll();
  });
</script>
`;

/**
 * Performance comparison with the old implementation
 * 
 * Old implementation (axe-core):
 * - Scanned entire DOM every 2 seconds
 * - No sampling or incremental processing
 * - Stored HTMLElement references causing memory leaks
 * - Recursive self-scanning
 * - Result: Chrome crashes after ~5 minutes
 * 
 * New implementation:
 * - Viewport-based sampling (20% of elements)
 * - Incremental processing in small chunks
 * - Memory-safe element references
 * - Excludes self from scanning
 * - Debounced updates (30+ seconds)
 * - Cancelable operations
 * - Result: Stable performance, no crashes
 */