/**
 * WCAG contrast ratio calculations
 * Consolidates contrast logic from all sources with caching
 */

import type { RGB, ContrastResult, WCAGLevel } from './types';
import { luminanceCache, contrastCache } from './cache';
import { parseColor } from './parser';
import { alphaBlend } from './conversion';

/**
 * Calculate relative luminance (WCAG 2.1 formula)
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function getRelativeLuminance(rgb: RGB): number {
	const key = `${rgb.r},${rgb.g},${rgb.b}`;

	// Check cache
	const cached = luminanceCache.get(key);
	if (cached !== undefined) return cached;

	const toLinearRGB = (value: number): number => {
		const sRGB = value / 255;
		return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
	};

	const r = toLinearRGB(rgb.r);
	const g = toLinearRGB(rgb.g);
	const b = toLinearRGB(rgb.b);

	const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

	// Cache the result
	luminanceCache.set(key, luminance);
	return luminance;
}

/**
 * Calculate contrast ratio between two colors
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 *
 * Accepts either RGB objects or color strings
 */
export function getContrastRatio(color1: string | RGB, color2: string | RGB): number {
	// Parse colors if strings
	let rgb1: RGB | null = typeof color1 === 'string' ? parseColor(color1) : color1;
	let rgb2: RGB | null = typeof color2 === 'string' ? parseColor(color2) : color2;

	if (!rgb1 || !rgb2) {
		return 1.0; // Return minimum contrast if colors can't be parsed
	}

	// Create cache key
	const cacheKey = `${rgb1.r},${rgb1.g},${rgb1.b}|${rgb2.r},${rgb2.g},${rgb2.b}`;

	// Check cache
	const cached = contrastCache.get(cacheKey);
	if (cached !== undefined) return cached;

	// Handle transparency by alpha blending
	const fg = rgb1.a !== undefined && rgb1.a < 1 ? alphaBlend(rgb1, rgb2) : rgb1;

	const l1 = getRelativeLuminance(fg);
	const l2 = getRelativeLuminance(rgb2);

	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);

	const ratio = (lighter + 0.05) / (darker + 0.05);

	// Cache the result
	contrastCache.set(cacheKey, ratio);
	return ratio;
}

/**
 * Check if contrast ratio meets WCAG level
 */
export function meetsWCAG(
	color1: string | RGB,
	color2: string | RGB,
	level: WCAGLevel = 'AA'
): boolean {
	const ratio = getContrastRatio(color1, color2);
	switch (level) {
		case 'AA':
			return ratio >= 4.5;
		case 'AAA':
			return ratio >= 7;
		case 'AA-large':
			return ratio >= 3;
		case 'AAA-large':
			return ratio >= 4.5;
		default:
			return ratio >= 4.5;
	}
}

/**
 * Get full contrast analysis
 */
export function analyzeContrast(color1: string | RGB, color2: string | RGB): ContrastResult {
	const ratio = getContrastRatio(color1, color2);
	return {
		ratio,
		meetsAA: ratio >= 4.5,
		meetsAAA: ratio >= 7,
		meetsAALarge: ratio >= 3,
		meetsAAALarge: ratio >= 4.5,
		meetsUIComponent: ratio >= 3
	};
}

/**
 * Check if text size qualifies as "large" per WCAG
 * Large text: 18pt (24px) or 14pt (18.66px) bold
 */
export function isLargeText(fontSize: string | number, fontWeight: string | number): boolean {
	const size = typeof fontSize === 'string' ? parseFloat(fontSize) : fontSize;
	const weight = typeof fontWeight === 'string' ? parseInt(fontWeight) || 400 : fontWeight;

	return size >= 24 || (size >= 18.66 && weight >= 700);
}

/**
 * Calculate perceived brightness (for determining if color is light or dark)
 * Using HSP color model
 */
export function getPerceivedBrightness(rgb: RGB): number {
	return Math.sqrt(0.299 * Math.pow(rgb.r, 2) + 0.587 * Math.pow(rgb.g, 2) + 0.114 * Math.pow(rgb.b, 2));
}

/**
 * Determine if a color is perceived as light or dark
 */
export function isLightColor(rgb: RGB): boolean {
	return getPerceivedBrightness(rgb) > 127.5;
}

/**
 * Generate a contrasting color for text on a given background
 */
export function getContrastingColor(background: RGB, preferDark = true): RGB {
	const isLight = isLightColor(background);

	if (isLight && preferDark) {
		return { r: 0, g: 0, b: 0 }; // Black
	} else if (!isLight && !preferDark) {
		return { r: 255, g: 255, b: 255 }; // White
	} else if (isLight) {
		return { r: 255, g: 255, b: 255 }; // White
	} else {
		return { r: 0, g: 0, b: 0 }; // Black
	}
}

/**
 * Adjust color brightness until target contrast is met
 */
export function adjustColorForContrast(
	color: string | RGB,
	background: string | RGB,
	targetRatio = 4.5,
	preferLighter = true
): RGB {
	const rgb = typeof color === 'string' ? parseColor(color) : color;
	const bgRgb = typeof background === 'string' ? parseColor(background) : background;

	if (!rgb || !bgRgb) {
		return rgb || { r: 0, g: 0, b: 0 };
	}

	const currentRatio = getContrastRatio(rgb, bgRgb);
	if (currentRatio >= targetRatio) {
		return rgb;
	}

	const step = preferLighter ? 5 : -5;
	let adjustedRgb = { ...rgb };
	let attempts = 0;
	const maxAttempts = 51; // 255 / 5 = 51 steps

	while (attempts < maxAttempts) {
		adjustedRgb.r = Math.max(0, Math.min(255, adjustedRgb.r + step));
		adjustedRgb.g = Math.max(0, Math.min(255, adjustedRgb.g + step));
		adjustedRgb.b = Math.max(0, Math.min(255, adjustedRgb.b + step));

		const newRatio = getContrastRatio(adjustedRgb, bgRgb);
		if (newRatio >= targetRatio) {
			return adjustedRgb;
		}

		// If we've reached pure white or black, stop
		if (
			(preferLighter && adjustedRgb.r === 255 && adjustedRgb.g === 255 && adjustedRgb.b === 255) ||
			(!preferLighter && adjustedRgb.r === 0 && adjustedRgb.g === 0 && adjustedRgb.b === 0)
		) {
			break;
		}

		attempts++;
	}

	return adjustedRgb;
}

/**
 * Check if text is readable on a semi-transparent background
 */
export function isReadableOnGlass(
	textColor: string | RGB,
	glassColor: RGB,
	glassOpacity: number,
	backgroundBehindGlass: RGB,
	minContrast = 4.5
): boolean {
	// Calculate effective background color
	const effectiveBg = alphaBlend({ ...glassColor, a: glassOpacity }, backgroundBehindGlass);

	// Check contrast
	const ratio = getContrastRatio(textColor, effectiveBg);
	return ratio >= minContrast;
}

/**
 * Batch validate contrast for multiple element pairs
 * Returns validation results for each pair
 */
export function batchValidate(
	pairs: Array<{
		foreground: string | RGB;
		background: string | RGB;
		largeText?: boolean;
	}>
): Array<{
	contrast: number;
	passes: boolean;
	level: 'AA' | 'AAA' | 'FAIL';
}> {
	return pairs.map(({ foreground, background, largeText = false }) => {
		const ratio = getContrastRatio(foreground, background);

		// WCAG 2.1 requirements
		const aaThreshold = largeText ? 3 : 4.5;
		const aaaThreshold = largeText ? 4.5 : 7;

		let level: 'AA' | 'AAA' | 'FAIL' = 'FAIL';
		if (ratio >= aaaThreshold) {
			level = 'AAA';
		} else if (ratio >= aaThreshold) {
			level = 'AA';
		}

		return {
			contrast: ratio,
			passes: ratio >= aaThreshold,
			level
		};
	});
}

/**
 * Simulate color blindness
 */
export function simulateColorBlindness(
	rgb: RGB,
	type: 'protanopia' | 'deuteranopia' | 'tritanopia'
): RGB {
	// Conversion matrices for different types of color blindness
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
