import type { ContrastEvaluation } from '../types';

export class ContrastAnalyzer {
  private cache = new Map<string, number>();
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  
  
  private readonly MIN_VISIBLE_CONTRAST = 1.1;
  
  constructor() {
    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }
  }
  
  


  analyzeElement(element: Element): ContrastEvaluation | null {
    if (!element) return null;
    const computed = window.getComputedStyle(element);
    const color = computed.color;
    const backgroundColor = this.getEffectiveBackground(element);
    
    if (!color || !backgroundColor) return null;
    
    
    const hasProblematicVariant = this.hasProblematicSkeletonVariant(element);
    
    
    const cacheKey = `${color}-${backgroundColor}`;
    let ratio = this.cache.get(cacheKey);
    
    if (!ratio) {
      const fg = this.parseColor(color);
      const bg = this.parseColor(backgroundColor);
      
      if (!fg || !bg) return null;
      
      ratio = this.calculateContrastRatio(fg, bg);
      this.cache.set(cacheKey, ratio);
    }
    
    
    const isNearIdentical = this.areColorsNearIdentical(color, backgroundColor);
    const isInvisible = ratio < this.MIN_VISIBLE_CONTRAST;
    
    const fontSize = parseFloat(computed.fontSize);
    const fontWeight = computed.fontWeight;
    const largeText = this.isLargeText(fontSize, fontWeight);
    const requiredRatio = largeText ? 3 : 4.5; 
    
    let severity: 'error' | 'warning' | 'info';
    let message: string;
    
    
    if (hasProblematicVariant && (isNearIdentical || ratio < 2.0)) {
      severity = 'error';
      message = `Critical: Skeleton variant class causing contrast issue - ${ratio.toFixed(2)}:1 (${color} on ${backgroundColor})`;
    } else if (isNearIdentical || isInvisible) {
      severity = 'error';
      message = `Critical: Text is nearly invisible with contrast ratio ${ratio.toFixed(2)}:1 (${color} on ${backgroundColor})`;
    } else if (ratio < requiredRatio) {
      severity = 'error';
      message = `Contrast ratio ${ratio.toFixed(2)}:1 fails WCAG AA (requires ${requiredRatio}:1)`;
    } else if (hasProblematicVariant && ratio < 3.0) {
      severity = 'warning';
      message = `Warning: Skeleton variant may cause contrast issues in some themes - ${ratio.toFixed(2)}:1`;
    } else {
      severity = 'info';
      message = `Contrast ratio ${ratio.toFixed(2)}:1 passes WCAG AA`;
    }

    
    const themeInfo = this.extractThemeInfo(element);
    
    const evaluation: ContrastEvaluation = {
      id: this.generateId(),
      timestamp: Date.now(),
      type: 'contrast' as const,
      severity,
      wcagLevel: 'AA' as const,
      wcagCriteria: largeText ? '1.4.3' : '1.4.3',
      selector: this.getSelector(element),
      message,
      metadata: {
        foreground: color,
        background: backgroundColor,
        ratio,
        largeText,
        requiredRatio,
        pixelSamples: 0,
        edgeContrastIssue: isNearIdentical || isInvisible,
        textElement: element.textContent?.trim().substring(0, 50) || '',
        fontSize,
        fontWeight,
        contrastMode: hasProblematicVariant ? 'problematic-variant' : 'standard',
        variantClasses: Array.from(element.classList).filter(c => c.includes('variant-')),
        themeInfo,
        isNearIdentical,
        isInvisible,
        computedStyles: {
          color,
          backgroundColor,
          fontSize,
          fontWeight
        }
      }
    };

    
    this.logContrastAnalysis(evaluation);
    
    return evaluation;
  }
  
  



  analyzeWithPixelNeighbors(element: Element): ContrastEvaluation | null {
    if (!element.getBoundingClientRect) return null;
    
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    
    
    const standardResult = this.analyzeElement(element);
    if (!standardResult) return null;
    
    
    if (standardResult.severity === 'info') {
      const hasEdgeIssues = this.checkEdgeContrast(element);
      if (hasEdgeIssues) {
        standardResult.severity = 'warning';
        standardResult.message += ' (Warning: Poor edge contrast detected)';
        standardResult.metadata = {
          ...standardResult.metadata,
          edgeContrastIssue: true
        };
      }
    }
    
    return standardResult;
  }
  
  


  private checkEdgeContrast(element: Element): boolean {
    const computed = window.getComputedStyle(element);
    const textColor = this.parseColor(computed.color);
    if (!textColor) return false;
    
    
    const parent = element.parentElement;
    if (!parent) return false;
    
    const parentBg = window.getComputedStyle(parent).backgroundColor;
    if (!parentBg || parentBg === 'transparent') return false;
    
    const bgColor = this.parseColor(parentBg);
    if (!bgColor) return false;
    
    
    const edgeRatio = this.calculateContrastRatio(textColor, bgColor);
    return edgeRatio < 1.5; 
  }
  
  


  private hasProblematicSkeletonVariant(element: Element): boolean {
    const classList = element.classList;
    
    
    
    const problematicVariants = [
      'variant-filled-surface',
      'variant-soft-surface',
      'variant-filled-tertiary' 
    ];
    
    
    for (const variant of problematicVariants) {
      if (classList.contains(variant)) {
        
        const isDarkMode = document.documentElement.classList.contains('dark') || 
                          document.body.classList.contains('dark');
        
        if (isDarkMode) {
          
          return true;
        }
      }
    }
    
    
    if ((classList.contains('badge') || classList.contains('chip')) && 
        (classList.contains('variant-filled-surface') || 
         classList.contains('variant-soft-surface') ||
         classList.contains('variant-filled-tertiary'))) {
      return true;
    }
    
    
    if (classList.contains('variant-filled-tertiary')) {
      const theme = document.documentElement.getAttribute('data-theme');
      if (theme === 'trans') {
        return true; 
      }
    }
    
    return false;
  }

  


  private areColorsNearIdentical(color1: string, color2: string): boolean {
    const c1 = this.parseColor(color1);
    const c2 = this.parseColor(color2);
    
    if (!c1 || !c2) return false;
    
    
    const distance = Math.sqrt(
      Math.pow(c1.r - c2.r, 2) +
      Math.pow(c1.g - c2.g, 2) +
      Math.pow(c1.b - c2.b, 2)
    );
    
    
    
    return distance < 10;
  }
  
  


  private getEffectiveBackground(element: Element): string | null {
    let current: Element | null = element;
    const colors: string[] = [];
    
    while (current) {
      const computed = window.getComputedStyle(current);
      const bg = computed.backgroundColor;
      
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
        colors.push(bg);
        
        
        const opacity = parseFloat(computed.opacity);
        if (opacity === 1) {
          return bg; 
        }
      }
      
      current = current.parentElement;
    }
    
    
    if (colors.length > 0) {
      return colors[0]; 
    }
    
    
    return 'rgb(255, 255, 255)';
  }
  
  


  private parseColor(color: string): { r: number; g: number; b: number } | null {
    
    if (color.startsWith('var(')) {
      const varName = color.match(/var\((--[^)]+)\)/)?.[1];
      if (varName) {
        const resolved = getComputedStyle(document.documentElement).getPropertyValue(varName);
        if (resolved) color = resolved.trim();
      }
    }
    
    
    if (!this.ctx || !this.canvas) return null;
    
    try {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(0, 0, 1, 1);
      const data = this.ctx.getImageData(0, 0, 1, 1).data;
      
      return {
        r: data[0],
        g: data[1],
        b: data[2]
      };
    } catch (error) {
      console.warn('[ContrastAnalyzer] Failed to parse color:', color, error);
      return null;
    }
  }
  
  


  private calculateContrastRatio(
    fg: { r: number; g: number; b: number },
    bg: { r: number; g: number; b: number }
  ): number {
    const l1 = this.relativeLuminance(fg);
    const l2 = this.relativeLuminance(bg);
    
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }
  
  


  private relativeLuminance(color: { r: number; g: number; b: number }): number {
    const { r, g, b } = color;
    
    const rsRGB = r / 255;
    const gsRGB = g / 255;
    const bsRGB = b / 255;
    
    const rL = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const gL = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const bL = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
    
    return 0.2126 * rL + 0.7152 * gL + 0.0722 * bL;
  }
  
  


  private isLargeText(fontSize: number, fontWeight: string): boolean {
    const isBold = parseInt(fontWeight) >= 700 || fontWeight === 'bold';
    return fontSize >= 18 || (fontSize >= 14 && isBold);
  }
  
  


  private generateId(): string {
    return `contrast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  


  private getSelector(element: Element): string {
    if (element.id) return `#${element.id}`;
    
    const path: string[] = [];
    let current: Element | null = element;
    
    while (current && current.tagName !== 'BODY') {
      let selector = current.tagName.toLowerCase();
      
      if (current.className) {
        const classes = Array.from(current.classList)
          .filter(c => !c.startsWith('svelte-'))
          .slice(0, 2);
        if (classes.length > 0) {
          selector += `.${classes.join('.')}`;
        }
      }
      
      path.unshift(selector);
      current = current.parentElement;
      
      
      if (path.length > 4) break;
    }
    
    return path.join(' > ');
  }
  
  


  clearCache(): void {
    this.cache.clear();
  }
  
  


  private extractThemeInfo(element: Element) {
    const docElement = document.documentElement;
    const bodyClasses = document.body.className;
    const rootClasses = docElement.className;
    
    
    const isDarkMode = 
      bodyClasses.includes('dark') ||
      rootClasses.includes('dark') ||
      bodyClasses.includes('theme-dark') ||
      rootClasses.includes('theme-dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    
    const style = getComputedStyle(docElement);
    const themeVars: Record<string, string> = {};
    
    
    const varPatterns = [
      '--color-',
      '--background-',
      '--text-',
      '--primary-',
      '--secondary-',
      '--surface-',
      '--theme-'
    ];
    
    varPatterns.forEach(pattern => {
      for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        if (prop.startsWith(pattern)) {
          themeVars[prop] = style.getPropertyValue(prop).trim();
        }
      }
    });
    
    return {
      isDarkMode,
      bodyClasses,
      rootClasses,
      themeVars,
      colorScheme: style.colorScheme,
      elementClasses: element.className
    };
  }

  



  private logContrastAnalysis(evaluation: any): void {
    const logData = {
      timestamp: new Date().toISOString(),
      type: 'CONTRAST_ANALYSIS',
      severity: evaluation.severity,
      element: {
        selector: evaluation.selector,
        text: evaluation.metadata.elementText,
        classes: evaluation.metadata.themeInfo.elementClasses
      },
      contrast: {
        ratio: evaluation.metadata.ratio,
        required: evaluation.metadata.requiredRatio,
        passes: evaluation.severity !== 'error',
        foreground: evaluation.metadata.foreground,
        background: evaluation.metadata.background,
        isNearIdentical: evaluation.metadata.isNearIdentical,
        isInvisible: evaluation.metadata.isInvisible
      },
      theme: evaluation.metadata.themeInfo,
      styles: evaluation.metadata.computedStyles,
      wcag: {
        level: evaluation.wcagLevel,
        criteria: evaluation.wcagCriteria,
        largeText: evaluation.metadata.largeText
      },
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    
    if (evaluation.severity === 'error' && evaluation.metadata.isNearIdentical) {
      console.log('[A11Y_CONTRAST_ANALYSIS]', JSON.stringify(logData, null, 2));
    }
    
    
    if (typeof window !== 'undefined' && (window as any).__SOCKETIO_CONTRAST_LOG__) {
      (window as any).__SOCKETIO_CONTRAST_LOG__(logData);
    }

    
    if (evaluation.severity === 'error' || evaluation.metadata.isNearIdentical) {
      const event = new CustomEvent('contrast-analysis-critical', {
        detail: logData
      });
      document.dispatchEvent(event);
    }
  }

  


  destroy(): void {
    this.cache.clear();
    this.canvas = null;
    this.ctx = null;
  }
}
