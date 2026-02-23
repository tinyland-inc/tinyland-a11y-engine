




import {
  type RGB,
  type ContrastResult,
  parseColor,
  checkContrast,
  getComputedColor,
  getEffectiveBackgroundColor,
  getContrastRatio,
  alphaBlend,
  getPerceivedBrightness
} from '../contrast.js';

import type { ValidationResult, ValidationError, ValidationWarning } from '../validators.js';

export interface ExtendedValidationOptions {
  level?: 'AA' | 'AAA';
  componentType?: 'text' | 'large-text' | 'ui-component' | 'graphic' | 'icon';
  includeColorBlindness?: boolean;
  includeTransparency?: boolean;
  customRatio?: number;
  checkGradients?: boolean;
  checkImages?: boolean;
  checkPatterns?: boolean;
  samplePoints?: number; 
}

export interface GradientInfo {
  type: 'linear' | 'radial' | 'conic';
  colors: RGB[];
  positions: number[];
  angle?: number;
  center?: { x: number; y: number };
}

export interface ImageAnalysisResult {
  dominantColor: RGB;
  averageColor: RGB;
  colorPalette: RGB[];
  hasTransparency: boolean;
  textBounds?: DOMRect;
}




export class ContrastValidator {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {
    if (typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }
  }

  


  async validateGradientContrast(
    element: Element,
    options: ExtendedValidationOptions = {}
  ): Promise<ValidationResult> {
    const foreground = getComputedColor(element, 'color');
    if (!foreground) {
      return this.createErrorResult('Could not determine text color');
    }

    const gradient = this.parseGradient(window.getComputedStyle(element).backgroundImage);
    if (!gradient) {
      return this.createErrorResult('No gradient found');
    }

    const { samplePoints = 10 } = options;
    const results: ContrastResult[] = [];
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    
    const samples = this.sampleGradient(gradient, samplePoints);
    let minRatio = Infinity;
    let maxRatio = 0;

    for (const sampleColor of samples) {
      const result = checkContrast(foreground, sampleColor);
      results.push(result);
      
      if (result.ratio < minRatio) minRatio = result.ratio;
      if (result.ratio > maxRatio) maxRatio = result.ratio;
    }

    
    const requiredRatio = this.getRequiredRatio(options);
    const valid = minRatio >= requiredRatio;

    if (!valid) {
      errors.push({
        type: 'contrast',
        message: `Minimum contrast ratio ${minRatio.toFixed(2)}:1 on gradient does not meet requirement of ${requiredRatio}:1`,
        element,
        expected: requiredRatio,
        actual: minRatio
      });
    }

    
    if (maxRatio - minRatio > 2) {
      warnings.push({
        type: 'gradient',
        message: `High contrast variation across gradient (${minRatio.toFixed(2)} - ${maxRatio.toFixed(2)}:1)`,
        suggestion: 'Consider using a more uniform background or adding text shadow'
      });
    }

    return {
      valid,
      ratio: minRatio,
      errors,
      warnings,
      suggestions: valid ? [] : ['Use a solid background color', 'Add text shadow or outline', 'Adjust gradient colors']
    };
  }

  


  async validateImageContrast(
    element: Element,
    imageUrl: string,
    options: ExtendedValidationOptions = {}
  ): Promise<ValidationResult> {
    if (!this.canvas || !this.ctx) {
      return this.createErrorResult('Canvas not available');
    }

    const foreground = getComputedColor(element, 'color');
    if (!foreground) {
      return this.createErrorResult('Could not determine text color');
    }

    try {
      const analysis = await this.analyzeImage(imageUrl, element.getBoundingClientRect());
      const results: ContrastResult[] = [];
      
      
      for (const bgColor of analysis.colorPalette) {
        results.push(checkContrast(foreground, bgColor));
      }

      const minRatio = Math.min(...results.map(r => r.ratio));
      const requiredRatio = this.getRequiredRatio(options);
      const valid = minRatio >= requiredRatio;

      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      if (!valid) {
        errors.push({
          type: 'contrast',
          message: `Contrast ratio ${minRatio.toFixed(2)}:1 on image background does not meet requirement`,
          element,
          expected: requiredRatio,
          actual: minRatio
        });
      }

      
      warnings.push({
        type: 'perception',
        message: 'Text on image backgrounds can be difficult to read',
        suggestion: 'Consider adding a semi-transparent overlay or text shadow'
      });

      return {
        valid,
        ratio: minRatio,
        errors,
        warnings,
        suggestions: ['Add semi-transparent overlay', 'Use text-shadow', 'Add background to text']
      };
    } catch (error) {
      return this.createErrorResult(`Failed to analyze image: ${error}`);
    }
  }

  


  validateSVGContrast(
    svgElement: SVGElement,
    background: RGB,
    options: ExtendedValidationOptions = {}
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const results: ContrastResult[] = [];

    
    const elements = svgElement.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line');
    
    elements.forEach(el => {
      const fill = window.getComputedStyle(el).fill;
      const stroke = window.getComputedStyle(el).stroke;
      const opacity = parseFloat(window.getComputedStyle(el).opacity || '1');

      
      if (fill && fill !== 'none') {
        const color = parseColor(fill);
        if (color) {
          
          if (opacity < 1) {
            color.a = (color.a || 1) * opacity;
          }
          results.push(checkContrast(color, background));
        }
      }

      
      if (stroke && stroke !== 'none') {
        const color = parseColor(stroke);
        if (color) {
          
          if (opacity < 1) {
            color.a = (color.a || 1) * opacity;
          }
          results.push(checkContrast(color, background));
        }
      }
    });

    if (results.length === 0) {
      return this.createErrorResult('No visible SVG elements found');
    }

    const minRatio = Math.min(...results.map(r => r.ratio));
    const requiredRatio = options.componentType === 'icon' ? 3 : this.getRequiredRatio(options);
    const valid = minRatio >= requiredRatio;

    if (!valid) {
      errors.push({
        type: 'contrast',
        message: `SVG contrast ratio ${minRatio.toFixed(2)}:1 does not meet requirement`,
        element: svgElement,
        expected: requiredRatio,
        actual: minRatio
      });
    }

    
    const hasLowOpacity = Array.from(elements).some(el => {
      const opacity = parseFloat(window.getComputedStyle(el).opacity || '1');
      return opacity < 0.6;
    });

    if (hasLowOpacity) {
      warnings.push({
        type: 'transparency',
        message: 'SVG contains elements with low opacity',
        suggestion: 'Consider increasing opacity for better visibility'
      });
    }

    return {
      valid,
      ratio: minRatio,
      errors,
      warnings,
      suggestions: valid ? [] : ['Increase icon opacity', 'Use higher contrast colors', 'Add stroke for better definition']
    };
  }

  


  validateFormElementContrast(
    element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    options: ExtendedValidationOptions = {}
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const results: ContrastResult[] = [];

    const background = getEffectiveBackgroundColor(element);

    
    const textColor = getComputedColor(element, 'color');
    if (textColor) {
      results.push(checkContrast(textColor, background));
    }

    
    if ('placeholder' in element && element.placeholder) {
      
      const placeholderColor = this.getPlaceholderColor(element);
      if (placeholderColor) {
        const placeholderResult = checkContrast(placeholderColor, background);
        results.push(placeholderResult);
        
        if (placeholderResult.ratio < 4.5) {
          warnings.push({
            type: 'contrast',
            message: `Placeholder text contrast ${placeholderResult.ratio.toFixed(2)}:1 may be too low`,
            suggestion: 'Consider using darker placeholder text'
          });
        }
      }
    }

    
    const borderColor = window.getComputedStyle(element).borderColor;
    if (borderColor && borderColor !== 'transparent') {
      const border = parseColor(borderColor);
      if (border) {
        const borderResult = checkContrast(border, background);
        if (borderResult.ratio < 3) {
          warnings.push({
            type: 'contrast',
            message: `Border contrast ${borderResult.ratio.toFixed(2)}:1 may be insufficient`,
            suggestion: 'Use a border color with at least 3:1 contrast'
          });
        }
      }
    }

    const minRatio = Math.min(...results.map(r => r.ratio));
    const requiredRatio = this.getRequiredRatio(options);
    const valid = minRatio >= requiredRatio;

    if (!valid) {
      errors.push({
        type: 'contrast',
        message: `Form element contrast ${minRatio.toFixed(2)}:1 does not meet requirement`,
        element,
        expected: requiredRatio,
        actual: minRatio
      });
    }

    return {
      valid,
      ratio: minRatio,
      errors,
      warnings,
      suggestions: valid ? [] : ['Increase text contrast', 'Darken borders', 'Adjust placeholder color']
    };
  }

  


  validateDisabledElementContrast(
    element: HTMLElement,
    options: ExtendedValidationOptions = {}
  ): ValidationResult {
    const foreground = getComputedColor(element, 'color');
    const background = getEffectiveBackgroundColor(element);

    if (!foreground || !background) {
      return this.createErrorResult('Could not determine element colors');
    }

    const result = checkContrast(foreground, background);
    const warnings: ValidationWarning[] = [];

    
    if (result.ratio < 2) {
      warnings.push({
        type: 'perception',
        message: 'Disabled element may be difficult to distinguish',
        suggestion: 'Consider maintaining at least 2:1 contrast for disabled states'
      });
    }

    
    if (result.ratio > 4.5) {
      warnings.push({
        type: 'perception', 
        message: 'Disabled element may appear active',
        suggestion: 'Consider reducing contrast to indicate disabled state'
      });
    }

    return {
      valid: true, 
      ratio: result.ratio,
      errors: [],
      warnings,
      suggestions: []
    };
  }

  


  private parseGradient(gradientString: string): GradientInfo | null {
    if (!gradientString || gradientString === 'none') return null;

    const colors: RGB[] = [];
    const positions: number[] = [];

    
    const colorMatches = gradientString.matchAll(/(?:rgb|rgba|hsl|hsla|#)[\w\s,.\(\)#]+/g);
    
    for (const match of colorMatches) {
      const color = parseColor(match[0]);
      if (color) {
        colors.push(color);
      }
    }

    if (colors.length < 2) return null;

    
    let type: 'linear' | 'radial' | 'conic' = 'linear';
    if (gradientString.includes('radial-gradient')) type = 'radial';
    else if (gradientString.includes('conic-gradient')) type = 'conic';

    
    let angle = 180; 
    const angleMatch = gradientString.match(/(\d+)deg/);
    if (angleMatch) {
      angle = parseInt(angleMatch[1]);
    }

    return { type, colors, positions, angle };
  }

  


  private sampleGradient(gradient: GradientInfo, sampleCount: number): RGB[] {
    const samples: RGB[] = [];
    
    for (let i = 0; i < sampleCount; i++) {
      const position = i / (sampleCount - 1);
      const color = this.interpolateGradient(gradient, position);
      samples.push(color);
    }

    return samples;
  }

  


  private interpolateGradient(gradient: GradientInfo, position: number): RGB {
    const { colors } = gradient;
    
    if (position <= 0) return colors[0];
    if (position >= 1) return colors[colors.length - 1];

    
    const segmentSize = 1 / (colors.length - 1);
    const segmentIndex = Math.floor(position / segmentSize);
    const segmentPosition = (position % segmentSize) / segmentSize;

    const color1 = colors[segmentIndex];
    const color2 = colors[Math.min(segmentIndex + 1, colors.length - 1)];

    return {
      r: Math.round(color1.r + (color2.r - color1.r) * segmentPosition),
      g: Math.round(color1.g + (color2.g - color1.g) * segmentPosition),
      b: Math.round(color1.b + (color2.b - color1.b) * segmentPosition),
      a: 1
    };
  }

  


  private async analyzeImage(
    imageUrl: string,
    textBounds?: DOMRect
  ): Promise<ImageAnalysisResult> {
    return new Promise((resolve, reject) => {
      if (!this.canvas || !this.ctx) {
        reject(new Error('Canvas not available'));
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        if (!this.canvas || !this.ctx) return;

        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.drawImage(img, 0, 0);

        
        let sampleX = 0;
        let sampleY = 0;
        let sampleWidth = img.width;
        let sampleHeight = img.height;

        if (textBounds) {
          
          const scaleX = img.width / img.naturalWidth;
          const scaleY = img.height / img.naturalHeight;
          
          sampleX = Math.floor(textBounds.x * scaleX);
          sampleY = Math.floor(textBounds.y * scaleY);
          sampleWidth = Math.floor(textBounds.width * scaleX);
          sampleHeight = Math.floor(textBounds.height * scaleY);
        }

        const imageData = this.ctx.getImageData(sampleX, sampleY, sampleWidth, sampleHeight);
        const pixels = imageData.data;
        
        
        const colorMap = new Map<string, number>();
        let hasTransparency = false;
        
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];
          
          if (a < 255) hasTransparency = true;
          
          
          const qR = Math.round(r / 16) * 16;
          const qG = Math.round(g / 16) * 16;
          const qB = Math.round(b / 16) * 16;
          
          const key = `${qR},${qG},${qB}`;
          colorMap.set(key, (colorMap.get(key) || 0) + 1);
        }

        
        const sortedColors = Array.from(colorMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([color]) => {
            const [r, g, b] = color.split(',').map(Number);
            return { r, g, b, a: 1 };
          });

        
        let totalR = 0, totalG = 0, totalB = 0;
        let pixelCount = 0;
        
        for (let i = 0; i < pixels.length; i += 4) {
          const a = pixels[i + 3];
          if (a > 0) {
            totalR += pixels[i];
            totalG += pixels[i + 1];
            totalB += pixels[i + 2];
            pixelCount++;
          }
        }

        const averageColor: RGB = {
          r: Math.round(totalR / pixelCount),
          g: Math.round(totalG / pixelCount),
          b: Math.round(totalB / pixelCount),
          a: 1
        };

        resolve({
          dominantColor: sortedColors[0] || averageColor,
          averageColor,
          colorPalette: sortedColors,
          hasTransparency,
          textBounds
        });
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = imageUrl;
    });
  }

  


  private getPlaceholderColor(element: HTMLInputElement | HTMLTextAreaElement): RGB | null {
    
    const textColor = getComputedColor(element, 'color');
    
    if (!textColor) return null;

    
    return {
      ...textColor,
      a: 0.54
    };
  }

  


  protected getRequiredRatio(options: ExtendedValidationOptions): number {
    if (options.customRatio) return options.customRatio;

    const { level = 'AA', componentType = 'text' } = options;

    switch (componentType) {
      case 'ui-component':
      case 'graphic':
      case 'icon':
        return 3;
      case 'large-text':
        return level === 'AAA' ? 4.5 : 3;
      default:
        return level === 'AAA' ? 7 : 4.5;
    }
  }

  


  private createErrorResult(message: string): ValidationResult {
    return {
      valid: false,
      ratio: 0,
      errors: [{
        type: 'contrast',
        message,
        expected: 1,
        actual: 0
      }],
      warnings: [],
      suggestions: []
    };
  }

  


  validateContrast(
    foreground: string | RGB,
    background: string | RGB,
    options: ExtendedValidationOptions = {}
  ): ValidationResult {
    const fg = typeof foreground === 'string' ? parseColor(foreground) : foreground;
    const bg = typeof background === 'string' ? parseColor(background) : background;

    if (!fg || !bg) {
      return this.createErrorResult('Invalid color format');
    }

    const result = checkContrast(fg, bg);
    const requiredRatio = this.getRequiredRatio(options);
    const valid = result.ratio >= requiredRatio;

    const errors: ValidationError[] = [];
    if (!valid) {
      errors.push({
        type: 'contrast',
        message: `Contrast ratio ${result.ratio.toFixed(2)}:1 does not meet requirement of ${requiredRatio}:1`,
        expected: requiredRatio,
        actual: result.ratio
      });
    }

    return {
      valid,
      ratio: result.ratio,
      errors,
      warnings: [],
      suggestions: valid ? [] : ['Adjust colors to meet contrast requirements']
    };
  }

  


  validateElementContrast(
    element: Element,
    options: ExtendedValidationOptions = {}
  ): ValidationResult {
    const foreground = getComputedColor(element, 'color');
    const background = getEffectiveBackgroundColor(element);

    if (!foreground) {
      return this.createErrorResult('Could not determine text color');
    }

    if (!background) {
      return this.createErrorResult('Could not determine background color');
    }

    const result = checkContrast(foreground, background);
    const requiredRatio = this.getRequiredRatio(options);
    const valid = result.ratio >= requiredRatio;

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!valid) {
      errors.push({
        type: 'contrast',
        message: `Contrast ratio ${result.ratio.toFixed(2)}:1 does not meet requirement of ${requiredRatio}:1`,
        element,
        expected: requiredRatio,
        actual: result.ratio
      });
    }

    return {
      valid,
      ratio: result.ratio,
      errors,
      warnings,
      suggestions: valid ? [] : ['Adjust foreground or background color']
    };
  }
}




export function createContrastValidator(): ContrastValidator {
  return new ContrastValidator();
}
