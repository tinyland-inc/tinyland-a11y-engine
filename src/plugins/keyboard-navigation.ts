




import type { EvaluationPlugin } from '../types';

const plugin: EvaluationPlugin = {
  id: 'keyboard-navigation',
  name: 'Keyboard Navigation',
  version: '1.0.0',
  rules: [
    {
      id: 'keyboard-focusable',
      name: 'Interactive elements must be keyboard accessible',
      description: 'All interactive elements must be reachable via keyboard',
      category: 'Keyboard',
      severity: 'error',
      wcagCriteria: ['2.1.1'],
      selector: 'a[href], button, input, select, textarea, [role="button"], [onclick]',
      evaluate: async (element: Element) => {
        const tabindex = element.getAttribute('tabindex');
        
        
        if (tabindex === '-1') {
          return {
            severity: 'error',
            message: 'Interactive element not keyboard accessible',
            category: 'Keyboard',
            wcagCriteria: ['2.1.1'],
            details: {
              tabindex
            }
          };
        }
        
        return null;
      }
    },
    
    {
      id: 'keyboard-trap',
      name: 'No keyboard traps',
      description: 'Keyboard focus must not be trapped',
      category: 'Keyboard',
      severity: 'error',
      wcagCriteria: ['2.1.2'],
      selector: '[tabindex]',
      evaluate: async (element: Element) => {
        const tabindex = element.getAttribute('tabindex');
        
        
        if (tabindex && parseInt(tabindex) > 0) {
          return {
            severity: 'warning',
            message: 'Positive tabindex can create confusing tab order',
            category: 'Keyboard',
            wcagCriteria: ['2.1.2'],
            details: {
              tabindex
            }
          };
        }
        
        return null;
      }
    }
  ]
};

export default plugin;
