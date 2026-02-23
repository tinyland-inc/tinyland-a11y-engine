





import { createContrastValidator as _createContrastValidator, ContrastValidator as _ContrastValidator } from './ContrastValidator.js';
import { ContrastTestRunner as _ContrastTestRunner, createStandardTestSuites as _createStandardTestSuites } from './ContrastTestRunner.js';
import { RuntimeContrastMonitor as _RuntimeContrastMonitor, createContrastMonitor as _createContrastMonitor } from './RuntimeContrastMonitor.js';
import type { MonitorOptions as _MonitorOptions } from './RuntimeContrastMonitor.js';
import type { ContrastTestSuite as _ContrastTestSuite, TestRunResult as _TestRunResult } from './ContrastTestRunner.js';
import type { ValidationOptions as _ValidationOptions } from '../validators.js';


export { ContrastValidator, createContrastValidator } from './ContrastValidator.js';
export type {
  ExtendedValidationOptions,
  GradientInfo,
  ImageAnalysisResult
} from './ContrastValidator.js';


export { ThemeContrastValidator, createThemeContrastValidator } from './ThemeContrastValidator.js';
export type {
  ThemeColors,
  ThemeValidationOptions,
  ThemeValidationResult
} from './ThemeContrastValidator.js';


export { ContrastTestRunner, createStandardTestSuites } from './ContrastTestRunner.js';
export type {
  ContrastTestCase,
  ContrastTestSuite,
  TestRunResult,
  TestCaseResult,
  CoverageReport
} from './ContrastTestRunner.js';


export { RuntimeContrastMonitor, createContrastMonitor } from './RuntimeContrastMonitor.js';
export type {
  MonitorOptions,
  ViolationReport,
  MonitorStats
} from './RuntimeContrastMonitor.js';


export type {
  ValidationResult,
  ValidationContext,
  ValidationOptions
} from '../validators.js';




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




export function validateContrast(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA'
): boolean {
  const validator = _createContrastValidator();
  const result = validator.validateContrast(foreground, background, { level });
  return result.valid;
}




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




export function enableContrastMonitoring(options?: _MonitorOptions): _RuntimeContrastMonitor {
  return _createContrastMonitor(options, true);
}




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




export async function generateAccessibilityReport(
  options?: {
    root?: Element;
    themes?: Array<'light' | 'dark' | 'high-contrast'>;
    wcagLevel?: 'AA' | 'AAA';
    includeColorBlindness?: boolean;
  }
): Promise<string> {
  const runner = new _ContrastTestRunner();

  
  const scanResults = await runner.scanPage(options);

  
  const testResults = await runAccessibilityTests();

  
  return runner.generateReport(testResults);
}
