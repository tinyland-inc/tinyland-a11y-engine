




import type { RGB, HSL, OKLCH, OKLAB } from './types';
import { conversionCache } from './cache';




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
		const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
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




export function oklchToRgb(l: number, c: number, h: number): RGB {
	const cacheKey = `oklch:${l},${c},${h}`;
	const cached = conversionCache.get(cacheKey);
	if (cached) return cached;

	
	const hRad = (h * Math.PI) / 180;
	const a = c * Math.cos(hRad);
	const b = c * Math.sin(hRad);

	const result = oklabToRgb(l, a, b);
	conversionCache.set(cacheKey, result);
	return result;
}





export function oklabToRgb(l: number, a: number, b: number): RGB {
	const cacheKey = `oklab:${l},${a},${b}`;
	const cached = conversionCache.get(cacheKey);
	if (cached) return cached;

	
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

	const result = {
		r: Math.round(clamp(linearToSrgb(linearRgb.r)) * 255),
		g: Math.round(clamp(linearToSrgb(linearRgb.g)) * 255),
		b: Math.round(clamp(linearToSrgb(linearRgb.b)) * 255)
	};

	conversionCache.set(cacheKey, result);
	return result;
}




export function rgbToOklch(rgb: RGB): OKLCH {
	
	const oklab = rgbToOklab(rgb);

	
	const c = Math.sqrt(oklab.a * oklab.a + oklab.b * oklab.b);
	let h = Math.atan2(oklab.b, oklab.a) * (180 / Math.PI);
	if (h < 0) h += 360;

	return {
		l: oklab.l,
		c,
		h,
		alpha: rgb.a
	};
}




export function rgbToOklab(rgb: RGB): OKLAB {
	
	const linearR = srgbToLinear(rgb.r / 255);
	const linearG = srgbToLinear(rgb.g / 255);
	const linearB = srgbToLinear(rgb.b / 255);

	
	const m1 = [
		[0.4122214708, 0.5363325363, 0.0514459929],
		[0.2119034982, 0.6806995451, 0.1073969566],
		[0.0883024619, 0.2817188376, 0.6299787005]
	];

	const lms = [
		linearR * m1[0][0] + linearG * m1[0][1] + linearB * m1[0][2],
		linearR * m1[1][0] + linearG * m1[1][1] + linearB * m1[1][2],
		linearR * m1[2][0] + linearG * m1[2][1] + linearB * m1[2][2]
	];

	
	const lmsCubeRoot = lms.map((x) => Math.cbrt(x));

	
	const m2 = [
		[0.2104542553, 0.793617785, -0.0040720468],
		[1.9779984951, -2.428592205, 0.4505937099],
		[0.0259040371, 0.7827717662, -0.808675766]
	];

	return {
		l: lmsCubeRoot[0] * m2[0][0] + lmsCubeRoot[1] * m2[0][1] + lmsCubeRoot[2] * m2[0][2],
		a: lmsCubeRoot[0] * m2[1][0] + lmsCubeRoot[1] * m2[1][1] + lmsCubeRoot[2] * m2[1][2],
		b: lmsCubeRoot[0] * m2[2][0] + lmsCubeRoot[1] * m2[2][1] + lmsCubeRoot[2] * m2[2][2],
		alpha: rgb.a
	};
}




export function oklchToOklab(oklch: OKLCH): OKLAB {
	const hRad = (oklch.h * Math.PI) / 180;
	return {
		l: oklch.l,
		a: oklch.c * Math.cos(hRad),
		b: oklch.c * Math.sin(hRad),
		alpha: oklch.alpha
	};
}




export function oklabToOklch(oklab: OKLAB): OKLCH {
	const c = Math.sqrt(oklab.a * oklab.a + oklab.b * oklab.b);
	let h = Math.atan2(oklab.b, oklab.a) * (180 / Math.PI);
	if (h < 0) h += 360;

	return {
		l: oklab.l,
		c,
		h,
		alpha: oklab.alpha
	};
}




function linearToSrgb(value: number): number {
	if (value <= 0.0031308) {
		return value * 12.92;
	}
	return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}




function srgbToLinear(value: number): number {
	if (value <= 0.04045) {
		return value / 12.92;
	}
	return Math.pow((value + 0.055) / 1.055, 2.4);
}




function clamp(value: number): number {
	return Math.max(0, Math.min(1, value));
}




export function oklchStringToRgbValues(oklchString: string): string {
	const match = oklchString.match(
		/oklch\(\s*(\d+(?:\.\d+)?%?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(deg|grad|rad|turn)?\s*(?:\/\s*(\d+(?:\.\d+)?%?))?\s*\)/i
	);
	if (!match) return '0 0 0';

	let l = parseFloat(match[1]);
	if (match[1].includes('%')) l = l / 100;

	const c = parseFloat(match[2]);
	let h = parseFloat(match[3]);

	const hueUnit = match[4]?.toLowerCase();
	if (hueUnit === 'grad') h = h * 0.9;
	else if (hueUnit === 'rad') h = h * (180 / Math.PI);
	else if (hueUnit === 'turn') h = h * 360;

	const rgb = oklchToRgb(l, c, h);
	return `${rgb.r} ${rgb.g} ${rgb.b}`;
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
