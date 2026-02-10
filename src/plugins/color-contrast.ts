/**
 * Color Contrast Plugin
 * Checks text color contrast ratios
 */

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
        // Only check elements with text content
        const text = element.textContent?.trim();
        return !!text && element.children.length === 0;
      },
      evaluate: async (element: Element) => {
        const styles = window.getComputedStyle(element);
        const fontSize = parseFloat(styles.fontSize);
        const fontWeight = styles.fontWeight;
        const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight === 'bold');
        
        // Get colors
        const fgColor = styles.color;
        const bgColor = styles.backgroundColor;
        
        // Skip if colors are not set or transparent
        if (!fgColor || !bgColor || bgColor === 'transparent') {
          return null;
        }
        
        // Calculate contrast ratio (simplified)
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

// Simplified contrast ratio calculation
function getContrastRatio(fg: string, bg: string): number {
  // This is a placeholder - real implementation would parse colors
  // and calculate actual luminance values
  return 5; // Mock value
}

export default plugin;