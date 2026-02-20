import { parse } from 'svelte/compiler';
import { parseColor, getContrastRatio } from './contrast.js';
import path from 'path';
import fs from 'fs';
import type { MemoryStats } from './types.js';

// Simple issue type for preprocessor (not the full AccessibilityIssue)
interface PreprocessorIssue {
  type: 'error' | 'warning';
  message: string;
  line?: number;
  column?: number;
}

/**
 * Svelte preprocessor for compile-time accessibility validation
 * Validates color contrast, ARIA attributes, and other a11y concerns
 */

// Default theme colors for validation
const DEFAULT_THEME_COLORS = {
  surface: { light: '#ffffff', dark: '#1a1a1a' },
  'surface-100': { light: '#f5f5f5', dark: '#2d2d2d' },
  'surface-200': { light: '#e5e5e5', dark: '#3a3a3a' },
  'surface-300': { light: '#d4d4d4', dark: '#525252' },
  primary: { light: '#8b5cf6', dark: '#a78bfa' },
  secondary: { light: '#06b6d4', dark: '#22d3ee' },
  tertiary: { light: '#84cc16', dark: '#a3e635' },
  success: { light: '#22c55e', dark: '#4ade80' },
  warning: { light: '#f59e0b', dark: '#fbbf24' },
  error: { light: '#ef4444', dark: '#f87171' },
  // Text colors
  'on-surface': { light: '#1a1a1a', dark: '#ffffff' },
  'on-primary': { light: '#ffffff', dark: '#1a1a1a' },
  'on-secondary': { light: '#ffffff', dark: '#1a1a1a' },
  'on-tertiary': { light: '#1a1a1a', dark: '#1a1a1a' },
  'on-success': { light: '#ffffff', dark: '#1a1a1a' },
  'on-warning': { light: '#1a1a1a', dark: '#1a1a1a' },
  'on-error': { light: '#ffffff', dark: '#1a1a1a' }
};

// WCAG contrast requirements
const WCAG_REQUIREMENTS = {
  normal: { AA: 4.5, AAA: 7 },
  large: { AA: 3, AAA: 4.5 },
  ui: { AA: 3 }
};

// Memory management
let memoryStats: MemoryStats = {
  used: 0,
  limit: 20 * 1024 * 1024, // 20MB default
  pressure: 'low'
};

// Track warnings/errors for reporting
let issues: PreprocessorIssue[] = [];

/**
 * Check memory pressure and act accordingly
 */
function checkMemoryPressure(): void {
  const usage = process.memoryUsage();
  memoryStats.used = usage.heapUsed;
  memoryStats.pressure = memoryStats.used > memoryStats.limit * 0.9 ? 'critical' :
                        memoryStats.used > memoryStats.limit * 0.7 ? 'high' :
                        memoryStats.used > memoryStats.limit * 0.5 ? 'medium' : 'low';
  
  if (memoryStats.pressure === 'critical') {
    console.warn('Memory pressure critical, clearing cache...');
    issues = []; // Clear issues to free memory
  }
}

/**
 * Parse theme colors from CSS or config files with memory limits
 */
function loadThemeColors(): Record<string, { light: string; dark: string }> {
  try {
    checkMemoryPressure();
    
    const projectRoot = process.cwd();
    const cssPath = path.join(projectRoot, 'src', 'app.css');
    
    if (fs.existsSync(cssPath)) {
      // Check file size to prevent memory overflow
      const stats = fs.statSync(cssPath);
      if (stats.size > 1024 * 1024) { // 1MB limit
        console.warn('CSS file too large, using default theme colors');
        return DEFAULT_THEME_COLORS;
      }
      
      const cssContent = fs.readFileSync(cssPath, 'utf-8');
      
      // Simple CSS variable parsing (could be enhanced)
      const colorVars: Record<string, { light: string; dark: string }> = {};
      
      // Extract OKLCH color variables
      const colorMatches = Array.from(cssContent.matchAll(/--color-([a-z0-9-]+):\s*oklch\([^)]+\)/g) || []);
      for (const match of colorMatches) {
        const colorName = match[1];
        if (colorName) {
          colorVars[colorName] = { 
            light: '#8b5cf6', // Default fallback
            dark: '#a78bfa' 
          };
        }
      }
      
      return Object.keys(colorVars).length > 0 ? colorVars : DEFAULT_THEME_COLORS;
    }
  } catch (error) {
    console.error('Failed to load theme colors:', error);
  }
  
  return DEFAULT_THEME_COLORS;
}

/**
 * Validate color contrast for a given element
 */
function validateColorContrast(
  element: any, 
  themeColors: Record<string, { light: string; dark: string }>
): void {
  // Get background and text colors
  const bgColor = element.attributes?.bg || element.attributes?.['bg-surface-50'] || 'surface';
  const textColor = element.attributes?.text || element.attributes?.['text-surface-900'] || 'on-surface';
  
  if (bgColor && textColor) {
    const bgLight = themeColors[bgColor]?.light || DEFAULT_THEME_COLORS.surface.light;
    const textLight = themeColors[textColor]?.light || DEFAULT_THEME_COLORS['on-surface'].light;
    
    const bgColorParsed = parseColor(bgLight);
    const textColorParsed = parseColor(textLight);
    
    if (bgColorParsed && textColorParsed) {
      const contrast = getContrastRatio(textColorParsed, bgColorParsed);
      
      if (contrast < WCAG_REQUIREMENTS.normal.AA) {
        issues.push({
          type: 'error',
          message: `Insufficient contrast ratio: ${contrast.toFixed(2)} (minimum 4.5:1)`,
          line: element.start?.line,
          column: element.start?.column
        });
      } else if (contrast < WCAG_REQUIREMENTS.normal.AAA) {
        issues.push({
          type: 'warning',
          message: `Low contrast ratio: ${contrast.toFixed(2)} (AAA requires 7:1)`,
          line: element.start?.line,
          column: element.start?.column
        });
      }
    }
  }
}

/**
 * Validate ARIA attributes
 */
function validateAriaAttributes(element: any): void {
  const tag = element.name;
  
  // Check for required ARIA attributes
  if (tag === 'button' && !element.attributes?.['aria-label'] && !element.attributes?.['aria-labelledby']) {
    // Check if button has text content
    const hasText = element.children?.some((child: any) => child.type === 'Text' && child.data.trim());
    if (!hasText) {
      issues.push({
        type: 'error',
        message: 'Button missing aria-label or text content',
        line: element.start?.line,
        column: element.start?.column
      });
    }
  }
  
  if (tag === 'img' && !element.attributes?.alt && !element.attributes?.['aria-label']) {
    issues.push({
      type: 'error',
      message: 'Image missing alt text or aria-label',
      line: element.start?.line,
      column: element.start?.column
    });
  }
  
  // Check for proper heading hierarchy
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    const level = parseInt(tag[1]);
    if (level > 1) {
      // This would require tracking previous heading levels in a real implementation
      // For now, just warn about skipped levels
      if (level > 2) {
        issues.push({
          type: 'warning',
          message: `Possible skipped heading level: h${level}`,
          line: element.start?.line,
          column: element.start?.column
        });
      }
    }
  }
}

/**
 * Validate keyboard accessibility
 */
function validateKeyboardAccessibility(element: any): void {
  const tag = element.name;
  const hasTabindex = element.attributes?.tabindex !== undefined;
  const hasOnclick = element.attributes?.onclick !== undefined;
  
  // Check for interactive elements that might not be keyboard accessible
  if (hasOnclick && !['button', 'a', 'input', 'select', 'textarea'].includes(tag)) {
    if (!hasTabindex && !element.attributes?.role) {
      issues.push({
        type: 'warning',
        message: `Interactive ${tag} element missing keyboard accessibility (tabindex or role)`,
        line: element.start?.line,
        column: element.start?.column
      });
    }
  }
  
  // Check for positive tabindex values
  if (hasTabindex && parseInt(element.attributes.tabindex) > 0) {
    issues.push({
      type: 'warning',
      message: 'Positive tabindex values can disrupt keyboard navigation order',
      line: element.start?.line,
      column: element.start?.column
    });
  }
}

/**
 * Main validation function
 */
function validateAccessibility(ast: any, themeColors: Record<string, { light: string; dark: string }>): void {
  issues = []; // Reset issues for this file
  
  // Simple tree traversal for accessibility validation
  function traverse(node: any) {
    if (node.type === 'Element') {
      validateColorContrast(node, themeColors);
      validateAriaAttributes(node);
      validateKeyboardAccessibility(node);
    }
    
    if (node.children) {
      node.children.forEach(traverse);
    }
  }
  
  traverse(ast);
}

/**
 * Format issues for console output
 */
function formatIssues(filename: string): void {
  if (issues.length === 0) {
    console.log(`✅ ${filename}: No accessibility issues found`);
    return;
  }
  
  console.log(`\n🔍 ${filename}: Found ${issues.length} accessibility issues:\n`);
  
  issues.forEach((issue, index) => {
    const location = issue.line && issue.column ? ` (${issue.line}:${issue.column})` : '';
    const icon = issue.type === 'error' ? '❌' : '⚠️';
    console.log(`${index + 1}. ${icon} ${issue.message}${location}`);
  });
}

/**
 * Main preprocessor function
 */
export function accessibilityPreprocessor() {
  return {
    name: 'accessibility',
    markup: async function ({ content, filename }: { content: string; filename: string }) {
      try {
        // Skip processing for non-Svelte files or in test environment
        if (!filename || !filename.endsWith('.svelte') || process.env.NODE_ENV === 'test') {
          return { code: content };
        }
        
        // Load theme colors
        const themeColors = loadThemeColors();
        
        // Parse and validate
        const ast = parse(content, { filename });
        
        validateAccessibility(ast, themeColors);
        formatIssues(filename);
        
        // Return original content unchanged (validation only)
        return { code: content };
        
      } catch (error) {
        console.error(`Accessibility preprocessor error for ${filename}:`, error);
        return { code: content };
      }
    }
  };
}

export default accessibilityPreprocessor;