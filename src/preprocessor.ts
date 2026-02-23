import { parse } from 'svelte/compiler';
import { parseColor, getContrastRatio } from './contrast.js';
import path from 'path';
import fs from 'fs';
import type { MemoryStats } from './types.js';


interface PreprocessorIssue {
  type: 'error' | 'warning';
  message: string;
  line?: number;
  column?: number;
}







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
  
  'on-surface': { light: '#1a1a1a', dark: '#ffffff' },
  'on-primary': { light: '#ffffff', dark: '#1a1a1a' },
  'on-secondary': { light: '#ffffff', dark: '#1a1a1a' },
  'on-tertiary': { light: '#1a1a1a', dark: '#1a1a1a' },
  'on-success': { light: '#ffffff', dark: '#1a1a1a' },
  'on-warning': { light: '#1a1a1a', dark: '#1a1a1a' },
  'on-error': { light: '#ffffff', dark: '#1a1a1a' }
};


const WCAG_REQUIREMENTS = {
  normal: { AA: 4.5, AAA: 7 },
  large: { AA: 3, AAA: 4.5 },
  ui: { AA: 3 }
};


let memoryStats: MemoryStats = {
  used: 0,
  limit: 20 * 1024 * 1024, 
  pressure: 'low'
};


let issues: PreprocessorIssue[] = [];




function checkMemoryPressure(): void {
  const usage = process.memoryUsage();
  memoryStats.used = usage.heapUsed;
  memoryStats.pressure = memoryStats.used > memoryStats.limit * 0.9 ? 'critical' :
                        memoryStats.used > memoryStats.limit * 0.7 ? 'high' :
                        memoryStats.used > memoryStats.limit * 0.5 ? 'medium' : 'low';
  
  if (memoryStats.pressure === 'critical') {
    console.warn('Memory pressure critical, clearing cache...');
    issues = []; 
  }
}




function loadThemeColors(): Record<string, { light: string; dark: string }> {
  try {
    checkMemoryPressure();
    
    const projectRoot = process.cwd();
    const cssPath = path.join(projectRoot, 'src', 'app.css');
    
    if (fs.existsSync(cssPath)) {
      
      const stats = fs.statSync(cssPath);
      if (stats.size > 1024 * 1024) { 
        console.warn('CSS file too large, using default theme colors');
        return DEFAULT_THEME_COLORS;
      }
      
      const cssContent = fs.readFileSync(cssPath, 'utf-8');
      
      
      const colorVars: Record<string, { light: string; dark: string }> = {};
      
      
      const colorMatches = Array.from(cssContent.matchAll(/--color-([a-z0-9-]+):\s*oklch\([^)]+\)/g) || []);
      for (const match of colorMatches) {
        const colorName = match[1];
        if (colorName) {
          colorVars[colorName] = { 
            light: '#8b5cf6', 
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




function validateColorContrast(
  element: any, 
  themeColors: Record<string, { light: string; dark: string }>
): void {
  
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




function validateAriaAttributes(element: any): void {
  const tag = element.name;
  
  
  if (tag === 'button' && !element.attributes?.['aria-label'] && !element.attributes?.['aria-labelledby']) {
    
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
  
  
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    const level = parseInt(tag[1]);
    if (level > 1) {
      
      
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




function validateKeyboardAccessibility(element: any): void {
  const tag = element.name;
  const hasTabindex = element.attributes?.tabindex !== undefined;
  const hasOnclick = element.attributes?.onclick !== undefined;
  
  
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
  
  
  if (hasTabindex && parseInt(element.attributes.tabindex) > 0) {
    issues.push({
      type: 'warning',
      message: 'Positive tabindex values can disrupt keyboard navigation order',
      line: element.start?.line,
      column: element.start?.column
    });
  }
}




function validateAccessibility(ast: any, themeColors: Record<string, { light: string; dark: string }>): void {
  issues = []; 
  
  
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




export function accessibilityPreprocessor() {
  return {
    name: 'accessibility',
    markup: async function ({ content, filename }: { content: string; filename: string }) {
      try {
        
        if (!filename || !filename.endsWith('.svelte') || process.env.NODE_ENV === 'test') {
          return { code: content };
        }
        
        
        const themeColors = loadThemeColors();
        
        
        const ast = parse(content, { filename });
        
        validateAccessibility(ast, themeColors);
        formatIssues(filename);
        
        
        return { code: content };
        
      } catch (error) {
        console.error(`Accessibility preprocessor error for ${filename}:`, error);
        return { code: content };
      }
    }
  };
}

export default accessibilityPreprocessor;
