




export interface RGB {
  r: number; 
  g: number; 
  b: number; 
  a?: number; 
}

export interface HSL {
  h: number; 
  s: number; 
  l: number; 
  a?: number; 
}

export interface ContrastResult {
  ratio: number;
  passesAA: boolean;
  passesAAA: boolean;
  passesLargeTextAA: boolean;
  passesLargeTextAAA: boolean;
  passesUIComponent: boolean;
}




export function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
    a: result[4] ? parseInt(result[4], 16) / 255 : 1
  };
}




export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  const hex = `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  if (rgb.a !== undefined && rgb.a < 1) {
    return hex + toHex(rgb.a * 255);
  }
  return hex;
}




export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  
  if (max === min) {
    return { h: 0, s: 0, l: l * 100, a: rgb.a };
  }
  
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  
  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    case b:
      h = (r - g) / d + 4;
      break;
    default:
      h = 0;
  }
  
  return {
    h: h * 60,
    s: s * 100,
    l: l * 100,
    a: rgb.a
  };
}




export function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;
  
  if (s === 0) {
    const gray = Math.round(l * 255);
    return { r: gray, g: gray, b: gray, a: hsl.a };
  }
  
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  
  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255),
    a: hsl.a
  };
}





export function getRelativeLuminance(rgb: RGB): number {
  const toLinearRGB = (value: number): number => {
    const sRGB = value / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  };
  
  const r = toLinearRGB(rgb.r);
  const g = toLinearRGB(rgb.g);
  const b = toLinearRGB(rgb.b);
  
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}





export function getContrastRatio(foreground: RGB, background: RGB): number {
  
  const fg = foreground.a !== undefined && foreground.a < 1
    ? alphaBlend(foreground, background)
    : foreground;
    
  const l1 = getRelativeLuminance(fg);
  const l2 = getRelativeLuminance(background);
  
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}




export function alphaBlend(foreground: RGB, background: RGB): RGB {
  const alpha = foreground.a ?? 1;
  const invAlpha = 1 - alpha;
  
  return {
    r: Math.round(foreground.r * alpha + background.r * invAlpha),
    g: Math.round(foreground.g * alpha + background.g * invAlpha),
    b: Math.round(foreground.b * alpha + background.b * invAlpha),
    a: 1
  };
}




export function checkContrast(foreground: RGB, background: RGB): ContrastResult {
  const ratio = getContrastRatio(foreground, background);
  
  return {
    ratio,
    passesAA: ratio >= 4.5,
    passesAAA: ratio >= 7,
    passesLargeTextAA: ratio >= 3,
    passesLargeTextAAA: ratio >= 4.5,
    passesUIComponent: ratio >= 3
  };
}




export function parseColor(color: string): RGB | null {
  if (!color) return null;
  
  
  if (color.startsWith('#')) {
    try {
      return hexToRgb(color);
    } catch {
      return null;
    }
  }
  
  
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
      a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
    };
  }
  
  
  const hslMatch = color.match(/hsla?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%(?:,\s*([\d.]+))?\)/);
  if (hslMatch) {
    const hsl: HSL = {
      h: parseInt(hslMatch[1]),
      s: parseFloat(hslMatch[2]),
      l: parseFloat(hslMatch[3]),
      a: hslMatch[4] ? parseFloat(hslMatch[4]) : 1
    };
    return hslToRgb(hsl);
  }
  
  
  return getNamedColor(color);
}




function getNamedColor(name: string): RGB | null {
  const namedColors: Record<string, RGB> = {
    
    black: { r: 0, g: 0, b: 0 },
    white: { r: 255, g: 255, b: 255 },
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 128, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    yellow: { r: 255, g: 255, b: 0 },
    cyan: { r: 0, g: 255, b: 255 },
    magenta: { r: 255, g: 0, b: 255 },
    
    
    gray: { r: 128, g: 128, b: 128 },
    grey: { r: 128, g: 128, b: 128 },
    darkgray: { r: 169, g: 169, b: 169 },
    darkgrey: { r: 169, g: 169, b: 169 },
    lightgray: { r: 211, g: 211, b: 211 },
    lightgrey: { r: 211, g: 211, b: 211 },
    
    
    navy: { r: 0, g: 0, b: 128 },
    olive: { r: 128, g: 128, b: 0 },
    teal: { r: 0, g: 128, b: 128 },
    purple: { r: 128, g: 0, b: 128 },
    maroon: { r: 128, g: 0, b: 0 },
    
    
    transparent: { r: 0, g: 0, b: 0, a: 0 }
  };
  
  return namedColors[name.toLowerCase()] || null;
}




export function getComputedColor(element: Element, property: 'color' | 'background-color'): RGB | null {
  const computed = window.getComputedStyle(element);
  const color = computed.getPropertyValue(property);
  return parseColor(color);
}




export function getEffectiveBackgroundColor(element: Element): RGB {
  let current: Element | null = element;
  const blendStack: RGB[] = [];
  
  while (current && current !== document.body) {
    const bg = getComputedColor(current, 'background-color');
    if (bg && (bg.a === undefined || bg.a > 0)) {
      blendStack.push(bg);
      if (bg.a === 1) break; 
    }
    current = current.parentElement;
  }
  
  
  if (blendStack.length === 0) {
    return { r: 255, g: 255, b: 255, a: 1 };
  }
  
  
  let result = blendStack[blendStack.length - 1];
  for (let i = blendStack.length - 2; i >= 0; i--) {
    result = alphaBlend(blendStack[i], result);
  }
  
  return result;
}




export function simulateColorBlindness(rgb: RGB, type: 'protanopia' | 'deuteranopia' | 'tritanopia'): RGB {
  
  const matrices = {
    protanopia: [
      [0.567, 0.433, 0],
      [0.558, 0.442, 0],
      [0, 0.242, 0.758]
    ],
    deuteranopia: [
      [0.625, 0.375, 0],
      [0.7, 0.3, 0],
      [0, 0.3, 0.7]
    ],
    tritanopia: [
      [0.95, 0.05, 0],
      [0, 0.433, 0.567],
      [0, 0.475, 0.525]
    ]
  };
  
  const matrix = matrices[type];
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  
  return {
    r: Math.round((matrix[0][0] * r + matrix[0][1] * g + matrix[0][2] * b) * 255),
    g: Math.round((matrix[1][0] * r + matrix[1][1] * g + matrix[1][2] * b) * 255),
    b: Math.round((matrix[2][0] * r + matrix[2][1] * g + matrix[2][2] * b) * 255),
    a: rgb.a
  };
}




export function getPerceivedBrightness(rgb: RGB): number {
  
  return Math.sqrt(
    0.299 * Math.pow(rgb.r, 2) +
    0.587 * Math.pow(rgb.g, 2) +
    0.114 * Math.pow(rgb.b, 2)
  );
}




export function isLightColor(rgb: RGB): boolean {
  return getPerceivedBrightness(rgb) > 127.5;
}




export function getContrastingColor(background: RGB, preferDark = true): RGB {
  const isLight = isLightColor(background);
  
  if (isLight && preferDark) {
    return { r: 0, g: 0, b: 0 }; 
  } else if (!isLight && !preferDark) {
    return { r: 255, g: 255, b: 255 }; 
  } else if (isLight) {
    return { r: 255, g: 255, b: 255 }; 
  } else {
    return { r: 0, g: 0, b: 0 }; 
  }
}
