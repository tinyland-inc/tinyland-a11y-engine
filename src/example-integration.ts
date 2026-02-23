






import { EvaluationEngine } from './core/EvaluationEngine';
import { QueueManager } from './core/QueueManager';
import { StreamingProtocol } from './streaming/StreamingProtocol';
import type { EvaluationResult } from './types';




export async function initializeAccessibilityEngine() {
  
  const engine = new EvaluationEngine({
    memoryLimit: 20 * 1024 * 1024, 
    chunkSize: 10 
  });

  
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

  
  const queueManager = new QueueManager(engine);

  
  let streaming: StreamingProtocol | null = null;
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    streaming = new StreamingProtocol('ws://localhost:3001/accessibility');
    await streaming.connect().catch(console.error);
  }

  return { engine, queueManager, streaming };
}




export async function evaluatePageAccessibility(
  engine: EvaluationEngine,
  options = {}
) {
  
  const elements = document.querySelectorAll(
    'body *:not(.a11y-monitor):not(.a11y-monitor *)'
  );

  
  const results = await engine.evaluate(Array.from(elements), {
    sampling: {
      type: 'viewport',
      strategy: 'viewport',
      sampleSize: 100,
      interval: 5000,
      rate: 0.2 
    },
    chunkSize: 10,
    ...options
  });

  return results;
}




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




export const exampleUsage = `
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    initializeAccessibilityEngine, 
    evaluatePageAccessibility,
    observePageChanges 
  } from '@tummycrypt/tinyland-a11y-engine';

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




















