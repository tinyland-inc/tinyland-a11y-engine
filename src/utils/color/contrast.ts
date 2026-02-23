




import type { RGB, ContrastResult, WCAGLevel } from './types';
import { luminanceCache, contrastCache } from './cache';
import { parseColor } from './parser';
import { alphaBlend } from './conversion';





export function getRelativeLuminance(rgb: RGB): number {
	const key = `${rgb.r},${rgb.g},${rgb.b}`;

	
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

	
	luminanceCache.set(key, luminance);
	return luminance;
}







export function getContrastRatio(color1: string | RGB, color2: string | RGB): number {
	
	let rgb1: RGB | null = typeof color1 === 'string' ? parseColor(color1) : color1;
	let rgb2: RGB | null = typeof color2 === 'string' ? parseColor(color2) : color2;

	if (!rgb1 || !rgb2) {
		return 1.0; 
	}

	
	const cacheKey = `${rgb1.r},${rgb1.g},${rgb1.b}|${rgb2.r},${rgb2.g},${rgb2.b}`;

	
	const cached = contrastCache.get(cacheKey);
	if (cached !== undefined) return cached;

	
	const fg = rgb1.a !== undefined && rgb1.a < 1 ? alphaBlend(rgb1, rgb2) : rgb1;

	const l1 = getRelativeLuminance(fg);
	const l2 = getRelativeLuminance(rgb2);

	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);

	const ratio = (lighter + 0.05) / (darker + 0.05);

	
	contrastCache.set(cacheKey, ratio);
	return ratio;
}




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





export function isLargeText(fontSize: string | number, fontWeight: string | number): boolean {
	const size = typeof fontSize === 'string' ? parseFloat(fontSize) : fontSize;
	const weight = typeof fontWeight === 'string' ? parseInt(fontWeight) || 400 : fontWeight;

	return size >= 24 || (size >= 18.66 && weight >= 700);
}





export function getPerceivedBrightness(rgb: RGB): number {
	return Math.sqrt(0.299 * Math.pow(rgb.r, 2) + 0.587 * Math.pow(rgb.g, 2) + 0.114 * Math.pow(rgb.b, 2));
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
	const maxAttempts = 51; 

	while (attempts < maxAttempts) {
		adjustedRgb.r = Math.max(0, Math.min(255, adjustedRgb.r + step));
		adjustedRgb.g = Math.max(0, Math.min(255, adjustedRgb.g + step));
		adjustedRgb.b = Math.max(0, Math.min(255, adjustedRgb.b + step));

		const newRatio = getContrastRatio(adjustedRgb, bgRgb);
		if (newRatio >= targetRatio) {
			return adjustedRgb;
		}

		
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




export function isReadableOnGlass(
	textColor: string | RGB,
	glassColor: RGB,
	glassOpacity: number,
	backgroundBehindGlass: RGB,
	minContrast = 4.5
): boolean {
	
	const effectiveBg = alphaBlend({ ...glassColor, a: glassOpacity }, backgroundBehindGlass);

	
	const ratio = getContrastRatio(textColor, effectiveBg);
	return ratio >= minContrast;
}





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




export function simulateColorBlindness(
	rgb: RGB,
	type: 'protanopia' | 'deuteranopia' | 'tritanopia'
): RGB {
	
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
