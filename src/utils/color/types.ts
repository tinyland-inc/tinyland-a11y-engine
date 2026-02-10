/**
 * Unified color type definitions
 * Consolidates types from colorContrast, colorConversion, accessibility/contrast
 */

/**
 * RGB color with values 0-255
 */
export interface RGB {
	r: number; // 0-255
	g: number; // 0-255
	b: number; // 0-255
	a?: number; // 0-1 (alpha)
}

/**
 * RGBA color (explicit alpha channel)
 */
export interface RGBA {
	r: number; // 0-255
	g: number; // 0-255
	b: number; // 0-255
	a: number; // 0-1
}

/**
 * HSL color space
 */
export interface HSL {
	h: number; // 0-360 (hue)
	s: number; // 0-100 (saturation)
	l: number; // 0-100 (lightness)
	a?: number; // 0-1 (alpha)
}

/**
 * OKLCH color space (perceptually uniform)
 */
export interface OKLCH {
	l: number; // 0-1 (lightness)
	c: number; // 0-0.4+ (chroma)
	h: number; // 0-360 (hue)
	alpha?: number; // 0-1
}

/**
 * OKLAB color space (perceptually uniform)
 */
export interface OKLAB {
	l: number; // 0-1 (lightness)
	a: number; // -0.4 to 0.4 (green-red axis)
	b: number; // -0.4 to 0.4 (blue-yellow axis)
	alpha?: number; // 0-1
}

/**
 * Parsed color with space information
 */
export type ParsedColor =
	| { type: 'hex'; value: string; rgb: RGB }
	| { type: 'rgb'; value: string; rgb: RGB }
	| { type: 'hsl'; value: string; hsl: HSL }
	| { type: 'oklch'; value: string; oklch: OKLCH }
	| { type: 'oklab'; value: string; oklab: OKLAB }
	| { type: 'named'; value: string; rgb: RGB };

/**
 * WCAG conformance levels
 */
export type WCAGLevel = 'AA' | 'AAA' | 'AA-large' | 'AAA-large';

/**
 * Contrast analysis result (comprehensive)
 */
export interface ContrastResult {
	/** Contrast ratio (1-21) */
	ratio: number;
	/** Meets WCAG AA for normal text (4.5:1) */
	meetsAA: boolean;
	/** Meets WCAG AAA for normal text (7:1) */
	meetsAAA: boolean;
	/** Meets WCAG AA for large text (3:1) */
	meetsAALarge: boolean;
	/** Meets WCAG AAA for large text (4.5:1) */
	meetsAAALarge: boolean;
	/** Meets UI component contrast (3:1) */
	meetsUIComponent: boolean;
}

/**
 * Simple contrast validation result
 */
export interface ContrastValidation {
	ratio: number;
	passes: boolean;
	level: 'AA' | 'AAA' | 'FAIL';
}

/**
 * Color blindness simulation types
 */
export type ColorBlindnessType = 'protanopia' | 'deuteranopia' | 'tritanopia';

/**
 * Color palette generation result
 */
export interface ColorPalette {
	lighter: string;
	light: string;
	base: string;
	dark: string;
	darker: string;
	complementary: string;
	muted: string;
	vibrant: string;
}
