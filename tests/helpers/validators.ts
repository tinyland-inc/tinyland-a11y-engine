




import type { RGB } from '../../src/contrast';
import { getContrastRatio, hexToRgb, simulateColorBlindness } from '../../src/contrast';

export interface ValidationError {
  type: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationWarning {
  type: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  ratio: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}




export function validateContrast(
  foreground: string,
  background: string,
  options: {
    level?: 'AA' | 'AAA';
    includeColorBlindness?: boolean;
    componentType?: 'text' | 'large-text' | 'ui-component';
  } = {}
): ValidationResult {
  const { level = 'AA', includeColorBlindness = false, componentType = 'text' } = options;

  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  const ratio = getContrastRatio(fg, bg);

  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  
  let requiredRatio = 4.5; 
  if (level === 'AAA') {
    requiredRatio = componentType === 'large-text' ? 4.5 : 7;
  } else {
    requiredRatio = componentType === 'large-text' || componentType === 'ui-component' ? 3 : 4.5;
  }

  const valid = ratio >= requiredRatio;

  if (!valid) {
    errors.push({
      type: 'contrast',
      message: `Contrast ratio ${ratio.toFixed(2)}:1 does not meet WCAG ${level} requirements (${requiredRatio}:1 required)`,
      severity: 'error'
    });
    suggestions.push(`Increase contrast to at least ${requiredRatio}:1`);
  }

  
  if (includeColorBlindness) {
    const types: Array<'protanopia' | 'deuteranopia' | 'tritanopia'> = ['protanopia', 'deuteranopia', 'tritanopia'];

    for (const type of types) {
      const simFg = simulateColorBlindness(fg, type);
      const simBg = simulateColorBlindness(bg, type);
      const simRatio = getContrastRatio(simFg, simBg);

      if (simRatio < requiredRatio) {
        warnings.push({
          type: 'perception',
          message: `Low contrast for ${type} users (${simRatio.toFixed(2)}:1)`
        });
      }
    }
  }

  return { valid, ratio, errors, warnings, suggestions };
}




export function* generateColorCombinations(
  count: number,
  options: {
    seed?: number;
    colorSpace?: 'rgb' | 'hsl';
    includeTransparency?: boolean;
  } = {}
): Generator<[RGB, RGB]> {
  const { seed = Date.now(), colorSpace = 'rgb', includeTransparency = false } = options;

  
  let s = seed;
  const random = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  for (let i = 0; i < count; i++) {
    let fg: RGB;
    let bg: RGB;

    if (colorSpace === 'hsl') {
      
      fg = hslToRgb(random() * 360, random(), random());
      bg = hslToRgb(random() * 360, random(), random());
    } else {
      fg = {
        r: Math.floor(random() * 256),
        g: Math.floor(random() * 256),
        b: Math.floor(random() * 256),
        a: includeTransparency ? random() : 1
      };
      bg = {
        r: Math.floor(random() * 256),
        g: Math.floor(random() * 256),
        b: Math.floor(random() * 256),
        a: 1
      };
    }

    yield [fg, bg];
  }
}




export function generateEdgeCases(): Array<[RGB, RGB, string]> {
  return [
    [{ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, 'Black on white'],
    [{ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }, 'White on black'],
    [{ r: 128, g: 128, b: 128 }, { r: 128, g: 128, b: 128 }, 'Same color'],
    [{ r: 255, g: 0, b: 0, a: 0 }, { r: 0, g: 0, b: 255 }, 'Fully transparent'],
    [{ r: 255, g: 0, b: 0, a: 0.5 }, { r: 0, g: 0, b: 255 }, 'Semi-transparent'],
    [{ r: 255, g: 255, b: 255 }, { r: 254, g: 254, b: 254 }, 'Nearly identical'],
    [{ r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 }, 'Nearly black on black'],
  ];
}




function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    a: 1
  };
}
