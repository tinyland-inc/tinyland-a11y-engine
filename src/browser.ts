export interface BrowserA11yFingerprint {
	screenReader: {
		detected: boolean;
		type: string | null;
		confidence: 'high' | 'medium' | 'low';
		method: string;
	};
	preferences: {
		reducedMotion: boolean;
		highContrast: boolean;
		forcedColors: boolean;
		darkMode: boolean;
		fontScaling: number;
	};
	assistiveTech: {
		touchEnabled: boolean;
		keyboardNavigation: boolean;
		focusVisible: boolean;
	};
	capabilities: {
		ariaSupport: boolean;
		semanticHTML: boolean;
		cssVars: boolean;
	};
}

export interface BrowserA11yViolation {
	id: string;
	impact: 'critical' | 'serious' | 'moderate' | 'minor';
	description: string;
	help: string;
	helpUrl?: string;
	nodes: Array<{
		html: string;
		target: string[];
		failureSummary?: string;
	}>;
	tags: string[];
}

/**
 * Browser-side axe-core evaluation extracted into the package surface so live
 * runtimes can depend on a package contract instead of app-local imports.
 */
export async function runAxeEvaluation(
	element: HTMLElement = document.body,
): Promise<BrowserA11yViolation[]> {
	const axe = await import('axe-core');
	const results = await axe.default.run(element);
	return results.violations as BrowserA11yViolation[];
}

function supportsFocusVisibleSelector(): boolean {
	try {
		document.documentElement.matches(':focus-visible');
		return true;
	} catch {
		return false;
	}
}

function supportsSemanticHtml(): boolean {
	return document.createElement('article').constructor.name !== 'HTMLUnknownElement';
}

export function detectBrowserA11yFingerprint(): BrowserA11yFingerprint {
	const screenReaderMatch = navigator.userAgent.match(/NVDA|JAWS|VoiceOver|TalkBack/i);
	const screenReaderDetected = !!screenReaderMatch;

	return {
		screenReader: {
			detected: screenReaderDetected,
			type: screenReaderMatch?.[0] || null,
			confidence: screenReaderDetected ? 'medium' : 'low',
			method: 'user-agent-heuristic',
		},
		preferences: {
			reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
			highContrast: window.matchMedia('(prefers-contrast: high)').matches,
			forcedColors: window.matchMedia('(forced-colors: active)').matches,
			darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
			fontScaling: parseFloat(getComputedStyle(document.documentElement).fontSize) / 16,
		},
		assistiveTech: {
			touchEnabled: 'ontouchstart' in window,
			keyboardNavigation: document.body.classList.contains('keyboard-navigation'),
			focusVisible: supportsFocusVisibleSelector(),
		},
		capabilities: {
			ariaSupport: 'ariaLabel' in document.createElement('div'),
			semanticHTML: supportsSemanticHtml(),
			cssVars: CSS.supports('color', 'var(--test)'),
		},
	};
}
