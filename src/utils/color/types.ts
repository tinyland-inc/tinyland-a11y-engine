







export interface RGB {
	r: number; 
	g: number; 
	b: number; 
	a?: number; 
}




export interface RGBA {
	r: number; 
	g: number; 
	b: number; 
	a: number; 
}




export interface HSL {
	h: number; 
	s: number; 
	l: number; 
	a?: number; 
}




export interface OKLCH {
	l: number; 
	c: number; 
	h: number; 
	alpha?: number; 
}




export interface OKLAB {
	l: number; 
	a: number; 
	b: number; 
	alpha?: number; 
}




export type ParsedColor =
	| { type: 'hex'; value: string; rgb: RGB }
	| { type: 'rgb'; value: string; rgb: RGB }
	| { type: 'hsl'; value: string; hsl: HSL }
	| { type: 'oklch'; value: string; oklch: OKLCH }
	| { type: 'oklab'; value: string; oklab: OKLAB }
	| { type: 'named'; value: string; rgb: RGB };




export type WCAGLevel = 'AA' | 'AAA' | 'AA-large' | 'AAA-large';




export interface ContrastResult {
	
	ratio: number;
	
	meetsAA: boolean;
	
	meetsAAA: boolean;
	
	meetsAALarge: boolean;
	
	meetsAAALarge: boolean;
	
	meetsUIComponent: boolean;
}




export interface ContrastValidation {
	ratio: number;
	passes: boolean;
	level: 'AA' | 'AAA' | 'FAIL';
}




export type ColorBlindnessType = 'protanopia' | 'deuteranopia' | 'tritanopia';




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
