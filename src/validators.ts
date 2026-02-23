



import { parseColor, getContrastRatio, analyzeContrast, type RGB } from './utils/color/index.js';


const checkContrast = analyzeContrast;

export interface ValidationError {
  type: string;
  message: string;
  element?: Element;
  expected?: number;
  actual?: number;
}

export interface ValidationWarning {
  type: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  ratio?: number;
  errors: (string | ValidationError)[];
  warnings: (string | ValidationWarning)[];
  suggestions?: string[];
  metadata?: Record<string, any>;
}

export interface ValidationContext {
  filename?: string;
  line?: number;
  column?: number;
  element?: string;
  wcagLevel?: 'AA' | 'AAA';
  isLargeText?: boolean;
  theme?: 'light' | 'dark';
}




export interface ValidationOptions {
  
  level?: 'AA' | 'AAA';
  
  largeText?: boolean;
  
  colorBlindness?: boolean;
  
  checkTransparency?: boolean;
}




export function validateContrast(
  foreground: string,
  background: string,
  context: ValidationContext = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const metadata: Record<string, any> = {};
  
  
  const fgColor = parseColor(foreground);
  const bgColor = parseColor(background);
  
  if (!fgColor) {
    errors.push(`Invalid foreground color: ${foreground}`);
    return { valid: false, errors, warnings };
  }
  
  if (!bgColor) {
    errors.push(`Invalid background color: ${background}`);
    return { valid: false, errors, warnings };
  }
  
  
  const result = checkContrast(fgColor, bgColor);
  const wcagLevel = context.wcagLevel || 'AA';
  const isLargeText = context.isLargeText || false;
  
  metadata.ratio = result.ratio;
  metadata.foreground = foreground;
  metadata.background = background;
  metadata.largeText = isLargeText;
  
  
  let passes = false;
  let requiredRatio = 0;

  if (wcagLevel === 'AA') {
    passes = isLargeText ? result.meetsAALarge : result.meetsAA;
    requiredRatio = isLargeText ? 3 : 4.5;
  } else {
    passes = isLargeText ? result.meetsAAALarge : result.meetsAAA;
    requiredRatio = isLargeText ? 4.5 : 7;
  }
  
  metadata.requiredRatio = requiredRatio;
  metadata.passes = passes;
  
  if (!passes) {
    const location = context.filename ? ` in ${context.filename}` : '';
    const position = context.line ? `:${context.line}:${context.column || 0}` : '';
    const element = context.element ? ` for ${context.element}` : '';
    
    errors.push(
      `Insufficient contrast ratio ${result.ratio.toFixed(2)}:1` +
      ` (requires ${requiredRatio}:1 for WCAG ${wcagLevel})` +
      `${element}${location}${position}`
    );
  } else if (wcagLevel === 'AA' && !result.meetsAAA) {
    
    warnings.push(
      `Contrast ratio ${result.ratio.toFixed(2)}:1 meets WCAG AA but not AAA` +
      ` (AAA requires ${isLargeText ? 4.5 : 7}:1)`
    );
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata
  };
}




export function validateTransparency(
  overlayColor: string,
  textColor: string,
  backgroundColor: string,
  context: ValidationContext = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const metadata: Record<string, any> = {};
  
  const overlay = parseColor(overlayColor);
  const text = parseColor(textColor);
  const background = parseColor(backgroundColor);
  
  if (!overlay || !text || !background) {
    errors.push('Invalid color values provided');
    return { valid: false, errors, warnings };
  }
  
  
  const effectiveBackground = blendColors(background, overlay);
  const effectiveText = overlay.a && overlay.a < 1 ? blendColors(text, overlay) : text;
  
  
  const result = validateContrast(
    rgbToString(effectiveText),
    rgbToString(effectiveBackground),
    context
  );
  
  if (!result.valid) {
    errors.push(
      `Transparency overlay reduces contrast below acceptable levels. ` +
      `Overlay alpha: ${overlay.a || 1}`
    );
    
    result.errors.forEach(e => {
      errors.push(typeof e === 'string' ? e : e.message);
    });
  }
  
  metadata.overlayAlpha = overlay.a || 1;
  metadata.effectiveColors = {
    text: rgbToString(effectiveText),
    background: rgbToString(effectiveBackground)
  };
  
  return {
    valid: errors.length === 0,
    errors,
    warnings: [...warnings, ...result.warnings],
    metadata
  };
}




export function validateThemeConsistency(
  lightColors: { foreground: string; background: string },
  darkColors: { foreground: string; background: string },
  context: ValidationContext = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const metadata: Record<string, any> = {};
  
  
  const lightResult = validateContrast(
    lightColors.foreground,
    lightColors.background,
    { ...context, theme: 'light' }
  );
  
  
  const darkResult = validateContrast(
    darkColors.foreground,
    darkColors.background,
    { ...context, theme: 'dark' }
  );
  
  metadata.light = lightResult.metadata;
  metadata.dark = darkResult.metadata;
  
  
  if (!lightResult.valid) {
    errors.push(...lightResult.errors.map(e => `[Light theme] ${e}`));
  }
  
  if (!darkResult.valid) {
    errors.push(...darkResult.errors.map(e => `[Dark theme] ${e}`));
  }
  
  
  if (lightResult.metadata?.ratio && darkResult.metadata?.ratio) {
    const lightRatio = lightResult.metadata.ratio;
    const darkRatio = darkResult.metadata.ratio;
    const difference = Math.abs(lightRatio - darkRatio);
    
    if (difference > 2) {
      warnings.push(
        `Large contrast difference between themes: ` +
        `Light ${lightRatio.toFixed(2)}:1, Dark ${darkRatio.toFixed(2)}:1`
      );
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings: [...warnings, ...lightResult.warnings, ...darkResult.warnings],
    metadata
  };
}




export function validateFocusIndicator(
  element: HTMLElement,
  context: ValidationContext = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const metadata: Record<string, any> = {};
  
  const styles = window.getComputedStyle(element);
  const focusStyles = window.getComputedStyle(element, ':focus');
  
  
  const outline = focusStyles.outline;
  const outlineWidth = parseFloat(focusStyles.outlineWidth);
  const outlineStyle = focusStyles.outlineStyle;
  
  metadata.outline = {
    width: outlineWidth,
    style: outlineStyle,
    color: focusStyles.outlineColor
  };
  
  
  if (outlineStyle === 'none' || outlineWidth === 0) {
    
    const hasBoxShadow = focusStyles.boxShadow !== 'none';
    const hasBorderChange = focusStyles.border !== styles.border;
    const hasBackgroundChange = focusStyles.backgroundColor !== styles.backgroundColor;
    
    metadata.alternativeIndicators = {
      boxShadow: hasBoxShadow,
      borderChange: hasBorderChange,
      backgroundChange: hasBackgroundChange
    };
    
    if (!hasBoxShadow && !hasBorderChange && !hasBackgroundChange) {
      errors.push(
        'Focus indicator removed without providing alternative. ' +
        'Elements must have visible focus indicators for keyboard navigation.'
      );
    }
  }
  
  
  if (focusStyles.outlineColor && focusStyles.backgroundColor) {
    const focusResult = validateContrast(
      focusStyles.outlineColor,
      focusStyles.backgroundColor,
      { ...context, element: 'focus indicator' }
    );
    
    if (!focusResult.valid) {
      errors.push('Focus indicator has insufficient contrast');
      
      focusResult.errors.forEach(e => {
        errors.push(typeof e === 'string' ? e : e.message);
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata
  };
}




export function validateTextSize(
  element: HTMLElement,
  context: ValidationContext = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const metadata: Record<string, any> = {};
  
  const styles = window.getComputedStyle(element);
  const fontSize = parseFloat(styles.fontSize);
  const fontWeight = styles.fontWeight;
  const lineHeight = parseFloat(styles.lineHeight);
  
  metadata.fontSize = fontSize;
  metadata.fontWeight = fontWeight;
  metadata.lineHeight = lineHeight;
  
  
  if (fontSize < 12) {
    errors.push(
      `Font size ${fontSize}px is below recommended minimum of 12px for body text`
    );
  } else if (fontSize < 14) {
    warnings.push(
      `Font size ${fontSize}px is small. Consider using 14px or larger for better readability`
    );
  }
  
  
  const lineHeightRatio = lineHeight / fontSize;
  if (lineHeightRatio < 1.4) {
    warnings.push(
      `Line height ratio ${lineHeightRatio.toFixed(2)} is tight. ` +
      `Consider 1.5 or higher for better readability`
    );
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata
  };
}


function blendColors(bottom: RGB, top: RGB): RGB {
  const alpha = top.a ?? 1;
  const invAlpha = 1 - alpha;
  
  return {
    r: Math.round(top.r * alpha + bottom.r * invAlpha),
    g: Math.round(top.g * alpha + bottom.g * invAlpha),
    b: Math.round(top.b * alpha + bottom.b * invAlpha),
    a: 1
  };
}

function rgbToString(rgb: RGB): string {
  return rgb.a !== undefined && rgb.a < 1
    ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rgb.a})`
    : `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}
