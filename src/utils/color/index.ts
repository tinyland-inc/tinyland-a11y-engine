/**
 * Unified Color Utilities
 * Public API for all color operations
 *
 * Consolidates functionality from:
 * - colorContrast.ts
 * - colorConversion.ts
 * - contrastValidator.ts
 * - accessibility/contrast.ts
 * - composables/useColorCalculations.svelte.ts
 */

// ========== Types ==========
export type {
	RGB,
	RGBA,
	HSL,
	OKLCH,
	OKLAB,
	ParsedColor,
	WCAGLevel,
	ContrastResult,
	ContrastValidation,
	ColorBlindnessType,
	ColorPalette
} from './types';

// ========== Parsing ==========
export {
	parseColor,
	parseHex,
	parseRgb,
	parseHsl,
	parseOklchString,
	parseOklabString,
	parseOklchToRgb,
	parseOklabToRgb
} from './parser';

// ========== Conversion ==========
export {
	hexToRgb,
	rgbToHex,
	rgbToHsl,
	hslToRgb,
	rgbToOklch,
	rgbToOklab,
	oklchToRgb,
	oklabToRgb,
	oklchToOklab,
	oklabToOklch,
	oklchStringToRgbValues,
	alphaBlend
} from './conversion';

// ========== Contrast & Accessibility ==========
export {
	getRelativeLuminance,
	getContrastRatio,
	meetsWCAG,
	analyzeContrast,
	isLargeText,
	getPerceivedBrightness,
	isLightColor,
	getContrastingColor,
	adjustColorForContrast,
	isReadableOnGlass,
	batchValidate,
	simulateColorBlindness
} from './contrast';

// ========== Cache Management ==========
export {
	ColorCache,
	parseCache,
	conversionCache,
	luminanceCache,
	contrastCache,
	clearAllCaches,
	getAllCacheStats
} from './cache';

// ========== Legacy Compatibility ==========
// Re-export common aliases for backward compatibility

/**
 * @deprecated Use parseColor instead
 */
export { parseColor as getCSSVariableColor } from './parser';

/**
 * @deprecated Use getRelativeLuminance instead
 */
export { getRelativeLuminance as getLuminance } from './contrast';

/**
 * Apply transparency to a color over a background
 * @deprecated Use alphaBlend instead
 */
export { alphaBlend as applyTransparency } from './conversion';

/**
 * Check if a color combination meets WCAG requirements
 * Alias for meetsWCAG with different parameter order
 */
export function checkWCAG(
	foreground: string,
	background: string,
	level: 'AA' | 'AAA' = 'AA',
	fontSize: 'normal' | 'large' = 'normal'
): boolean {
	const wcagLevel = fontSize === 'large' ? `${level}-large` : level;
	return meetsWCAG(foreground, background, wcagLevel as any);
}

/**
 * Generate color palette variations
 * Helper function that combines multiple utilities
 */
export function generateAccessiblePalette(baseColor: string, count = 5, minContrast = 4.5): string[] {
	const palette: string[] = [baseColor];
	const rgb = parseColor(baseColor);
	if (!rgb) return palette;

	// Generate lighter variations
	for (let i = 1; i < Math.ceil(count / 2); i++) {
		const factor = 1 + i * 0.2;
		const lighter = {
			r: Math.min(255, rgb.r * factor),
			g: Math.min(255, rgb.g * factor),
			b: Math.min(255, rgb.b * factor)
		};
		palette.push(rgbToHex(lighter));
	}

	// Generate darker variations
	for (let i = 1; i <= Math.floor(count / 2); i++) {
		const factor = 1 - i * 0.2;
		const darker = {
			r: Math.max(0, rgb.r * factor),
			g: Math.max(0, rgb.g * factor),
			b: Math.max(0, rgb.b * factor)
		};
		palette.push(rgbToHex(darker));
	}

	return palette;
}

import { parseColor } from './parser';
import { rgbToHex } from './conversion';
import { meetsWCAG } from './contrast';
