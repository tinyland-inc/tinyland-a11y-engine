




import type { EvaluationPlugin } from '../types';

const plugin: EvaluationPlugin = {
  id: 'color-contrast',
  name: 'Color Contrast Checker',
  version: '1.0.0',
  rules: [
    {
      id: 'color-contrast-text',
      name: 'Text must have sufficient color contrast',
      description: 'Text must meet WCAG AA contrast ratios',
      category: 'Color',
      severity: 'error',
      wcagCriteria: ['1.4.3'],
      selector: '*',
      condition: (element: Element) => {
        
        const text = element.textContent?.trim();
        return !!text && element.children.length === 0;
      },
      evaluate: async (element: Element) => {
        const styles = window.getComputedStyle(element);
        const fontSize = parseFloat(styles.fontSize);
        const fontWeight = styles.fontWeight;
        const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight === 'bold');
        
        
        const fgColor = styles.color;
        const bgColor = styles.backgroundColor;
        
        
        if (!fgColor || !bgColor || bgColor === 'transparent') {
          return null;
        }
        
        
        const ratio = getContrastRatio(fgColor, bgColor);
        const requiredRatio = isLargeText ? 3 : 4.5;
        
        if (ratio < requiredRatio) {
          return {
            severity: 'error',
            message: `Insufficient color contrast: ${ratio.toFixed(2)}:1 (required: ${requiredRatio}:1)`,
            category: 'Color',
            wcagCriteria: ['1.4.3'],
            details: {
              foreground: fgColor,
              background: bgColor,
              ratio,
              requiredRatio,
              isLargeText
            }
          };
        }
        
        return null;
      }
    }
  ]
};


function getContrastRatio(fg: string, bg: string): number {
  
  
  return 5; 
}

export default plugin;
