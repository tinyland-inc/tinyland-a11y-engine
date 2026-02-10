/**
 * Theme-Aware Contrast Validator
 * Validates contrast across different theme modes (light, dark, high contrast)
 */

import {
  type RGB,
  parseColor,
  getComputedColor,
  getEffectiveBackgroundColor,
  checkContrast
} from '../contrast.js';

import type { ValidationResult, ValidationError, ValidationWarning } from '../validators.js';
import { ContrastValidator, type ExtendedValidationOptions } from './ContrastValidator.js';

export interface ThemeColors {
  background: RGB;
  foreground: RGB;
  primary: RGB;
  secondary: RGB;
  accent: RGB;
  error: RGB;
  warning: RGB;
  success: RGB;
  surface: RGB;
  onSurface: RGB;
}

export interface ThemeValidationOptions extends ExtendedValidationOptions {
  themes: Array<'light' | 'dark' | 'high-contrast'>;
  checkInversion?: boolean;
  checkSystemPreference?: boolean;
}

export interface ThemeValidationResult {
  theme: string;
  valid: boolean;
  results: Map<string, ValidationResult>;
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

/**
 * Validates contrast across different theme modes
 */
export class ThemeContrastValidator extends ContrastValidator {
  private themeCache = new Map<string, ThemeColors>();

  /**
   * Validate element across all theme modes
   */
  async validateAcrossThemes(
    element: Element,
    options: ThemeValidationOptions = { themes: ['light', 'dark'] }
  ): Promise<Map<string, ThemeValidationResult>> {
    const results = new Map<string, ThemeValidationResult>();

    for (const theme of options.themes) {
      const result = await this.validateTheme(element, theme, options);
      results.set(theme, result);
    }

    // Check for contrast inversion issues
    if (options.checkInversion && options.themes.includes('light') && options.themes.includes('dark')) {
      const lightResult = results.get('light');
      const darkResult = results.get('dark');
      
      if (lightResult && darkResult) {
        this.checkInversionIssues(lightResult, darkResult);
      }
    }

    return results;
  }

  /**
   * Validate specific theme
   */
  private async validateTheme(
    element: Element,
    theme: string,
    options: ExtendedValidationOptions
  ): Promise<ThemeValidationResult> {
    // Apply theme to document
    const previousTheme = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', theme);

    // Force style recalculation
    element.getBoundingClientRect();

    const validationResults = new Map<string, ValidationResult>();
    let totalChecks = 0;
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    // Validate main element
    const mainResult = await this.validateElementWithTheme(element, options);
    validationResults.set('main', mainResult);
    totalChecks++;
    if (mainResult.valid) passed++;
    else failed++;
    warnings += mainResult.warnings.length;

    // Find and validate all text elements within
    const textElements = this.findAllTextElements(element);
    
    for (let i = 0; i < textElements.length; i++) {
      const textEl = textElements[i];
      const result = await this.validateElementWithTheme(textEl, options);
      validationResults.set(`text-${i}`, result);
      totalChecks++;
      if (result.valid) passed++;
      else failed++;
      warnings += result.warnings.length;
    }

    // Validate interactive elements
    const interactiveElements = element.querySelectorAll(
      'button, a, input, textarea, select, [role="button"], [role="link"], [tabindex]'
    );

    for (let i = 0; i < interactiveElements.length; i++) {
      const interactiveEl = interactiveElements[i];
      const result = await this.validateElementWithTheme(interactiveEl, {
        ...options,
        componentType: 'ui-component'
      });
      validationResults.set(`interactive-${i}`, result);
      totalChecks++;
      if (result.valid) passed++;
      else failed++;
      warnings += result.warnings.length;
    }

    // Restore previous theme
    if (previousTheme) {
      document.documentElement.setAttribute('data-theme', previousTheme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    return {
      theme,
      valid: failed === 0,
      results: validationResults,
      summary: {
        totalChecks,
        passed,
        failed,
        warnings
      }
    };
  }

  /**
   * Validate element in current theme context
   */
  private async validateElementWithTheme(
    element: Element,
    options: ExtendedValidationOptions
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Get computed colors in current theme
    const foreground = getComputedColor(element, 'color');
    const background = getEffectiveBackgroundColor(element);

    if (!foreground || !background) {
      return {
        valid: false,
        ratio: 0,
        errors: [{
          type: 'color',
          message: 'Could not determine element colors in theme',
          element,
          expected: 1,
          actual: 0
        }],
        warnings: [],
        suggestions: []
      };
    }

    const result = checkContrast(foreground, background);
    const requiredRatio = this.getRequiredRatio(options);
    const valid = result.ratio >= requiredRatio;

    if (!valid) {
      errors.push({
        type: 'contrast',
        message: `Contrast ratio ${result.ratio.toFixed(2)}:1 does not meet requirement in theme`,
        element,
        expected: requiredRatio,
        actual: result.ratio
      });
    }

    // Check if element has theme-specific styles
    const hasThemeStyles = this.hasThemeSpecificStyles(element);
    if (!hasThemeStyles) {
      warnings.push({
        type: 'theme',
        message: 'Element may not have theme-specific styles',
        suggestion: 'Ensure element adapts to theme changes'
      });
    }

    return {
      valid,
      ratio: result.ratio,
      errors,
      warnings,
      suggestions: valid ? [] : ['Adjust theme colors', 'Use CSS variables for theme support']
    };
  }

  /**
   * Find all elements containing text
   */
  findAllTextElements(root: Element): Element[] {
    const textElements: Element[] = [];
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) {
            return NodeFilter.FILTER_SKIP;
          }

          const element = node as Element;
          
          // Skip hidden elements
          const style = window.getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_SKIP;
          }

          // Check if element contains direct text
          const hasDirectText = Array.from(element.childNodes).some(
            child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim()
          );

          if (hasDirectText) {
            return NodeFilter.FILTER_ACCEPT;
          }

          // Check for pseudo-elements with content
          const before = style.getPropertyValue('content');
          const after = window.getComputedStyle(element, '::after').content;
          
          if ((before && before !== 'none') || (after && after !== 'none')) {
            return NodeFilter.FILTER_ACCEPT;
          }

          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    let node: Node | null;
    while (node = walker.nextNode()) {
      textElements.push(node as Element);
    }

    return textElements;
  }

  /**
   * Extract theme colors from CSS variables
   */
  extractThemeColors(theme: string): ThemeColors | null {
    // Check cache first
    if (this.themeCache.has(theme)) {
      return this.themeCache.get(theme)!;
    }

    // Apply theme temporarily
    const previousTheme = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', theme);

    const computed = window.getComputedStyle(document.documentElement);
    
    // Common CSS variable patterns
    const colorVars = {
      background: ['--background', '--bg-color', '--color-background'],
      foreground: ['--foreground', '--text-color', '--color-text'],
      primary: ['--primary', '--color-primary', '--primary-color'],
      secondary: ['--secondary', '--color-secondary', '--secondary-color'],
      accent: ['--accent', '--color-accent', '--accent-color'],
      error: ['--error', '--color-error', '--danger'],
      warning: ['--warning', '--color-warning', '--caution'],
      success: ['--success', '--color-success', '--positive'],
      surface: ['--surface', '--color-surface', '--card-bg'],
      onSurface: ['--on-surface', '--color-on-surface', '--card-text']
    };

    const colors: Partial<ThemeColors> = {};

    for (const [key, vars] of Object.entries(colorVars)) {
      for (const varName of vars) {
        const value = computed.getPropertyValue(varName);
        if (value) {
          const color = parseColor(value.trim());
          if (color) {
            colors[key as keyof ThemeColors] = color;
            break;
          }
        }
      }
    }

    // Restore previous theme
    if (previousTheme) {
      document.documentElement.setAttribute('data-theme', previousTheme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    // Only cache if we found enough colors
    if (Object.keys(colors).length >= 4) {
      const themeColors = colors as ThemeColors;
      this.themeCache.set(theme, themeColors);
      return themeColors;
    }

    return null;
  }

  /**
   * Check for contrast inversion issues between themes
   */
  private checkInversionIssues(
    lightResult: ThemeValidationResult,
    darkResult: ThemeValidationResult
  ): void {
    // Compare contrast ratios between themes
    for (const [key, lightValidation] of lightResult.results) {
      const darkValidation = darkResult.results.get(key);
      
      if (!darkValidation) continue;

      const lightRatio = lightValidation.ratio;
      const darkRatio = darkValidation.ratio;

      // Check if one theme passes but the other fails
      if (lightValidation.valid && !darkValidation.valid) {
        darkValidation.warnings.push({
          type: 'theme',
          message: 'Contrast passes in light theme but fails in dark theme',
          suggestion: 'Ensure consistent contrast across themes'
        });
      } else if (!lightValidation.valid && darkValidation.valid) {
        lightValidation.warnings.push({
          type: 'theme',
          message: 'Contrast passes in dark theme but fails in light theme',
          suggestion: 'Ensure consistent contrast across themes'
        });
      }

      // Check for significant ratio differences
      const ratioDiff = Math.abs(lightRatio - darkRatio);
      if (ratioDiff > 3) {
        const warning: ValidationWarning = {
          type: 'theme',
          message: `Large contrast difference between themes (${ratioDiff.toFixed(1)}:1)`,
          suggestion: 'Consider normalizing contrast across themes'
        };
        
        lightValidation.warnings.push(warning);
        darkValidation.warnings.push(warning);
      }
    }
  }

  /**
   * Check if element has theme-specific styles
   */
  private hasThemeSpecificStyles(element: Element): boolean {
    // Get all stylesheets
    const stylesheets = Array.from(document.styleSheets);
    
    for (const sheet of stylesheets) {
      try {
        const rules = Array.from(sheet.cssRules || []);
        
        for (const rule of rules) {
          if (rule instanceof CSSStyleRule) {
            // Check if rule includes theme selectors
            if (rule.selectorText.includes('[data-theme') ||
                rule.selectorText.includes('.theme-') ||
                rule.selectorText.includes(':root')) {
              
              // Check if element matches this selector
              if (element.matches(rule.selectorText)) {
                return true;
              }
            }
          }
        }
      } catch (e) {
        // Cross-origin stylesheets will throw
        continue;
      }
    }

    return false;
  }

  /**
   * Validate high contrast mode support
   */
  async validateHighContrastMode(
    element: Element,
    options: ExtendedValidationOptions = {}
  ): Promise<ValidationResult> {
    // Check if browser supports prefers-contrast
    const prefersContrast = window.matchMedia('(prefers-contrast: high)');
    
    if (!prefersContrast.matches) {
      // Simulate high contrast by checking with higher requirements
      return this.validateElementWithTheme(element, {
        ...options,
        customRatio: 7, // AAA level
        level: 'AAA'
      });
    }

    // Validate in actual high contrast mode
    return this.validateElementWithTheme(element, options);
  }

  /**
   * Get required ratio based on options (override from ContrastValidator)
   */
  protected override getRequiredRatio(options: ExtendedValidationOptions): number {
    if (options.customRatio) return options.customRatio;

    const { level = 'AA', componentType = 'text' } = options;

    switch (componentType) {
      case 'ui-component':
        return 3;
      case 'large-text':
        return level === 'AAA' ? 4.5 : 3;
      default:
        return level === 'AAA' ? 7 : 4.5;
    }
  }

  /**
   * Get effective background color (delegates to contrast utility)
   */
  getEffectiveBackgroundColor(element: Element): RGB {
    return getEffectiveBackgroundColor(element);
  }
}

/**
 * Factory function to create theme validator instance
 */
export function createThemeContrastValidator(): ThemeContrastValidator {
  return new ThemeContrastValidator();
}