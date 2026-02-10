/**
 * Unified color parsing
 * Consolidates parsing logic from all sources
 */

import type { RGB, HSL, OKLCH, OKLAB, ParsedColor } from './types';
import { parseCache } from './cache';

/**
 * Parse any CSS color string to RGB
 * Supports: hex, rgb, rgba, hsl, hsla, oklch, oklab, named colors
 */
export function parseColor(color: string): RGB | null {
	if (!color) return null;

	// Check cache first
	const cached = parseCache.get(color);
	if (cached !== undefined) return cached;

	let result: RGB | null = null;

	// Try each parser in order of likelihood
	if (color.startsWith('#')) {
		result = parseHex(color);
	} else if (color.startsWith('rgb')) {
		result = parseRgb(color);
	} else if (color.startsWith('hsl')) {
		result = parseHsl(color);
	} else if (color.startsWith('oklch')) {
		result = parseOklchToRgb(color);
	} else if (color.startsWith('oklab')) {
		result = parseOklabToRgb(color);
	} else {
		// Try named color
		result = parseNamedColor(color);
	}

	// Cache the result (even if null)
	if (result) {
		parseCache.set(color, result);
	}

	return result;
}

/**
 * Parse hex color to RGB
 * Supports: #fff, #ffffff, #ffffffff (with alpha)
 */
export function parseHex(hex: string): RGB | null {
	const cleaned = hex.replace(/^#/, '');

	// 3-digit hex (#fff)
	if (cleaned.length === 3) {
		return {
			r: parseInt(cleaned[0] + cleaned[0], 16),
			g: parseInt(cleaned[1] + cleaned[1], 16),
			b: parseInt(cleaned[2] + cleaned[2], 16),
			a: 1
		};
	}

	// 6-digit hex (#ffffff)
	if (cleaned.length === 6) {
		return {
			r: parseInt(cleaned.slice(0, 2), 16),
			g: parseInt(cleaned.slice(2, 4), 16),
			b: parseInt(cleaned.slice(4, 6), 16),
			a: 1
		};
	}

	// 8-digit hex with alpha (#ffffffff)
	if (cleaned.length === 8) {
		return {
			r: parseInt(cleaned.slice(0, 2), 16),
			g: parseInt(cleaned.slice(2, 4), 16),
			b: parseInt(cleaned.slice(4, 6), 16),
			a: parseInt(cleaned.slice(6, 8), 16) / 255
		};
	}

	return null;
}

/**
 * Parse RGB/RGBA color string
 * Supports: rgb(255, 0, 0), rgba(255, 0, 0, 0.5), rgb(255 0 0), rgb(255 0 0 / 0.5)
 */
export function parseRgb(color: string): RGB | null {
	// Modern space-separated syntax with optional slash alpha
	const modernMatch = color.match(
		/rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+%?))?\s*\)/
	);
	if (modernMatch) {
		let alpha = 1;
		if (modernMatch[4]) {
			alpha = modernMatch[4].includes('%')
				? parseFloat(modernMatch[4]) / 100
				: parseFloat(modernMatch[4]);
		}
		return {
			r: parseInt(modernMatch[1]),
			g: parseInt(modernMatch[2]),
			b: parseInt(modernMatch[3]),
			a: alpha
		};
	}

	// Legacy comma-separated syntax
	const legacyMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
	if (legacyMatch) {
		return {
			r: parseInt(legacyMatch[1]),
			g: parseInt(legacyMatch[2]),
			b: parseInt(legacyMatch[3]),
			a: legacyMatch[4] ? parseFloat(legacyMatch[4]) : 1
		};
	}

	return null;
}

/**
 * Parse HSL/HSLA color string
 * Supports: hsl(120, 100%, 50%), hsla(120, 100%, 50%, 0.5)
 */
export function parseHsl(color: string): RGB | null {
	const match = color.match(
		/hsla?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%(?:,\s*([\d.]+))?\)/
	);
	if (!match) return null;

	const hsl: HSL = {
		h: parseInt(match[1]),
		s: parseFloat(match[2]),
		l: parseFloat(match[3]),
		a: match[4] ? parseFloat(match[4]) : 1
	};

	return hslToRgb(hsl);
}

/**
 * Parse OKLCH and convert to RGB
 */
export function parseOklchToRgb(color: string): RGB | null {
	const parsed = parseOklchString(color);
	if (!parsed) return null;

	// Import from conversion module (will be created)
	// For now, basic implementation
	return oklchToRgbBasic(parsed.l, parsed.c, parsed.h, parsed.alpha);
}

/**
 * Parse OKLAB and convert to RGB
 */
export function parseOklabToRgb(color: string): RGB | null {
	const parsed = parseOklabString(color);
	if (!parsed) return null;

	return oklabToRgbBasic(parsed.l, parsed.a, parsed.b, parsed.alpha);
}

/**
 * Parse OKLCH CSS string
 * Supports: oklch(0.5 0.19 27), oklch(50% 0.19 27deg / 0.5)
 */
export function parseOklchString(oklchString: string): OKLCH | null {
	const match = oklchString.match(
		/oklch\(\s*(\d+(?:\.\d+)?%?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(deg|grad|rad|turn)?\s*(?:\/\s*(\d+(?:\.\d+)?%?))?\s*\)/i
	);

	if (!match) return null;

	// Parse lightness (0-1 or 0%-100%)
	let l = parseFloat(match[1]);
	if (match[1].includes('%')) {
		l = l / 100;
	}

	// Parse chroma (typically 0-0.4, but can exceed)
	const c = parseFloat(match[2]);

	// Parse hue (convert all angle units to degrees)
	let h = parseFloat(match[3]);
	const hueUnit = match[4]?.toLowerCase();
	if (hueUnit === 'grad') h = h * 0.9; // 400 gradians = 360 degrees
	else if (hueUnit === 'rad') h = h * (180 / Math.PI); // radians to degrees
	else if (hueUnit === 'turn') h = h * 360; // 1 turn = 360 degrees

	// Parse alpha (optional, 0-1 or 0%-100%)
	let alpha = 1;
	if (match[5]) {
		alpha = parseFloat(match[5]);
		if (match[5].includes('%')) alpha = alpha / 100;
	}

	return { l, c, h, alpha };
}

/**
 * Parse OKLAB CSS string
 * Supports: oklab(0.5 0.1 -0.05), oklab(50% 0.1 -0.05 / 0.5)
 */
export function parseOklabString(oklabString: string): OKLAB | null {
	const match = oklabString.match(
		/oklab\(\s*(\d+(?:\.\d+)?%?)\s+([-+]?\d+(?:\.\d+)?)\s+([-+]?\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?%?))?\s*\)/i
	);

	if (!match) return null;

	// Parse lightness (0-1 or 0%-100%)
	let l = parseFloat(match[1]);
	if (match[1].includes('%')) {
		l = l / 100;
	}

	// Parse a and b axes (can be negative)
	const a = parseFloat(match[2]);
	const b = parseFloat(match[3]);

	// Parse alpha (optional, 0-1 or 0%-100%)
	let alpha = 1;
	if (match[4]) {
		alpha = parseFloat(match[4]);
		if (match[4].includes('%')) alpha = alpha / 100;
	}

	return { l, a, b, alpha };
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(hsl: HSL): RGB {
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
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};

	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;

	return {
		r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
		g: Math.round(hue2rgb(p, q, h) * 255),
		b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
		a: hsl.a
	};
}

/**
 * Basic OKLCH to RGB conversion
 */
function oklchToRgbBasic(l: number, c: number, h: number, alpha = 1): RGB {
	// Convert to Lab
	const hRad = (h * Math.PI) / 180;
	const a = c * Math.cos(hRad);
	const b = c * Math.sin(hRad);

	return oklabToRgbBasic(l, a, b, alpha);
}

/**
 * Basic OKLAB to RGB conversion
 */
function oklabToRgbBasic(l: number, a: number, b: number, alpha = 1): RGB {
	// OKLab to linear RGB matrix
	const m1 = [
		[1.0, 0.3963377774, 0.2158037573],
		[1.0, -0.1055613458, -0.0638541728],
		[1.0, -0.0894841775, -1.291485548]
	];

	const lms = [
		l + a * m1[0][1] + b * m1[0][2],
		l + a * m1[1][1] + b * m1[1][2],
		l + a * m1[2][1] + b * m1[2][2]
	];

	const lmsCubed = lms.map((x) => x * x * x);

	// LMS to linear RGB matrix
	const m2 = [
		[4.0767416621, -3.3077115913, 0.2309699292],
		[-1.2684380046, 2.6097574011, -0.3413193965],
		[-0.0041960863, -0.7034186147, 1.707614701]
	];

	const linearRgb = {
		r: lmsCubed[0] * m2[0][0] + lmsCubed[1] * m2[0][1] + lmsCubed[2] * m2[0][2],
		g: lmsCubed[0] * m2[1][0] + lmsCubed[1] * m2[1][1] + lmsCubed[2] * m2[1][2],
		b: lmsCubed[0] * m2[2][0] + lmsCubed[1] * m2[2][1] + lmsCubed[2] * m2[2][2]
	};

	const linearToSrgb = (value: number): number => {
		if (value <= 0.0031308) {
			return value * 12.92;
		}
		return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
	};

	const clamp = (value: number): number => Math.max(0, Math.min(1, value));

	return {
		r: Math.round(clamp(linearToSrgb(linearRgb.r)) * 255),
		g: Math.round(clamp(linearToSrgb(linearRgb.g)) * 255),
		b: Math.round(clamp(linearToSrgb(linearRgb.b)) * 255),
		a: alpha
	};
}

/**
 * Parse CSS named colors
 */
function parseNamedColor(name: string): RGB | null {
	const namedColors: Record<string, RGB> = {
		// Basic colors
		black: { r: 0, g: 0, b: 0 },
		white: { r: 255, g: 255, b: 255 },
		red: { r: 255, g: 0, b: 0 },
		green: { r: 0, g: 128, b: 0 },
		blue: { r: 0, g: 0, b: 255 },
		yellow: { r: 255, g: 255, b: 0 },
		cyan: { r: 0, g: 255, b: 255 },
		magenta: { r: 255, g: 0, b: 255 },

		// Grays
		gray: { r: 128, g: 128, b: 128 },
		grey: { r: 128, g: 128, b: 128 },
		darkgray: { r: 169, g: 169, b: 169 },
		darkgrey: { r: 169, g: 169, b: 169 },
		lightgray: { r: 211, g: 211, b: 211 },
		lightgrey: { r: 211, g: 211, b: 211 },
		silver: { r: 192, g: 192, b: 192 },

		// Common colors
		navy: { r: 0, g: 0, b: 128 },
		olive: { r: 128, g: 128, b: 0 },
		teal: { r: 0, g: 128, b: 128 },
		purple: { r: 128, g: 0, b: 128 },
		maroon: { r: 128, g: 0, b: 0 },
		lime: { r: 0, g: 255, b: 0 },
		aqua: { r: 0, g: 255, b: 255 },
		fuchsia: { r: 255, g: 0, b: 255 },

		// Special
		transparent: { r: 0, g: 0, b: 0, a: 0 }
	};

	return namedColors[name.toLowerCase()] || null;
}
