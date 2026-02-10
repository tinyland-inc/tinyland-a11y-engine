/**
 * Accessibility Validators
 * Export all contrast validation utilities
 */

// Import items needed for helper functions
import { createContrastValidator as _createContrastValidator, ContrastValidator as _ContrastValidator } from './ContrastValidator.js';
import { ContrastTestRunner as _ContrastTestRunner, createStandardTestSuites as _createStandardTestSuites } from './ContrastTestRunner.js';
import { RuntimeContrastMonitor as _RuntimeContrastMonitor, createContrastMonitor as _createContrastMonitor } from './RuntimeContrastMonitor.js';
import type { MonitorOptions as _MonitorOptions } from './RuntimeContrastMonitor.js';
import type { ContrastTestSuite as _ContrastTestSuite, TestRunResult as _TestRunResult } from './ContrastTestRunner.js';
import type { ValidationOptions as _ValidationOptions } from '../validators.js';

// Core validators
export { ContrastValidator, createContrastValidator } from './ContrastValidator.js';
export type {
  ExtendedValidationOptions,
  GradientInfo,
  ImageAnalysisResult
} from './ContrastValidator.js';

// Theme validators
export { ThemeContrastValidator, createThemeContrastValidator } from './ThemeContrastValidator.js';
export type {
  ThemeColors,
  ThemeValidationOptions,
  ThemeValidationResult
} from './ThemeContrastValidator.js';

// Test runner
export { ContrastTestRunner, createStandardTestSuites } from './ContrastTestRunner.js';
export type {
  ContrastTestCase,
  ContrastTestSuite,
  TestRunResult,
  TestCaseResult,
  CoverageReport
} from './ContrastTestRunner.js';

// Runtime monitor
export { RuntimeContrastMonitor, createContrastMonitor } from './RuntimeContrastMonitor.js';
export type {
  MonitorOptions,
  ViolationReport,
  MonitorStats
} from './RuntimeContrastMonitor.js';

// Re-export types from parent validators
export type {
  ValidationResult,
  ValidationContext,
  ValidationOptions
} from '../validators.js';

// Note: Use ExtendedValidationOptions from ContrastValidator for richer options

// Re-export contrast utilities
export {
  type RGB,
  type HSL,
  type ContrastResult,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  getRelativeLuminance,
  getContrastRatio,
  alphaBlend,
  checkContrast,
  parseColor,
  getComputedColor,
  getEffectiveBackgroundColor,
  simulateColorBlindness,
  getPerceivedBrightness,
  isLightColor,
  getContrastingColor
} from '../contrast.js';

/**
 * Quick validation helper
 */
export function validateContrast(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA'
): boolean {
  const validator = _createContrastValidator();
  const result = validator.validateContrast(foreground, background, { level });
  return result.valid;
}

/**
 * Get all elements with contrast violations on the current page
 */
export async function findContrastViolations(
  root: Element = document.body,
  options?: _ValidationOptions
): Promise<Element[]> {
  const runner = new _ContrastTestRunner();
  const results = await runner.scanPage({ root, wcagLevel: options?.level });

  const violations: Element[] = [];
  for (const [element, validation] of results) {
    if (!validation.valid) {
      violations.push(element);
    }
  }

  return violations;
}

/**
 * Enable runtime contrast monitoring
 */
export function enableContrastMonitoring(options?: _MonitorOptions): _RuntimeContrastMonitor {
  return _createContrastMonitor(options, true);
}

/**
 * Run accessibility test suite
 */
export async function runAccessibilityTests(
  suites?: _ContrastTestSuite[]
): Promise<_TestRunResult[]> {
  const runner = new _ContrastTestRunner();
  const testSuites = suites || _createStandardTestSuites();

  const results: _TestRunResult[] = [];
  for (const suite of testSuites) {
    const result = await runner.runSuite(suite);
    results.push(result);
  }

  return results;
}

/**
 * Generate accessibility report
 */
export async function generateAccessibilityReport(
  options?: {
    root?: Element;
    themes?: Array<'light' | 'dark' | 'high-contrast'>;
    wcagLevel?: 'AA' | 'AAA';
    includeColorBlindness?: boolean;
  }
): Promise<string> {
  const runner = new _ContrastTestRunner();

  // Run page scan
  const scanResults = await runner.scanPage(options);

  // Run standard tests
  const testResults = await runAccessibilityTests();

  // Generate report
  return runner.generateReport(testResults);
}