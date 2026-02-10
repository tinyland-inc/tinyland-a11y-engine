/**
 * Contrast Test Runner
 * Comprehensive testing utilities for contrast validation
 */

import {
  type RGB,
  parseColor,
  checkContrast,
  simulateColorBlindness
} from '../contrast.js';

import type {
  ValidationResult,
  ValidationError,
  ValidationWarning
} from '../validators.js';

import { ContrastValidator, type ExtendedValidationOptions } from './ContrastValidator.js';

// Use ExtendedValidationOptions for ContrastTestRunner
type ValidationOptions = ExtendedValidationOptions;
import { ThemeContrastValidator } from './ThemeContrastValidator.js';

export interface ContrastTestCase {
  name: string;
  selector?: string;
  element?: Element;
  foreground?: string | RGB;
  background?: string | RGB;
  options?: ValidationOptions;
  expected?: {
    valid?: boolean;
    minRatio?: number;
    maxRatio?: number;
  };
}

export interface ContrastTestSuite {
  name: string;
  description?: string;
  setup?: () => void | Promise<void>;
  teardown?: () => void | Promise<void>;
  tests: ContrastTestCase[];
}

export interface TestRunResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: TestCaseResult[];
  coverage: CoverageReport;
}

export interface TestCaseResult {
  name: string;
  passed: boolean;
  skipped: boolean;
  duration: number;
  validation?: ValidationResult;
  error?: Error;
  failures: string[];
}

export interface CoverageReport {
  elementsChecked: number;
  elementsPassed: number;
  elementsFailed: number;
  componentsChecked: Set<string>;
  themesChecked: Set<string>;
  wcagLevels: Set<string>;
  colorBlindnessChecked: boolean;
}

/**
 * Runs comprehensive contrast validation tests
 */
export class ContrastTestRunner {
  private validator: ContrastValidator;
  private themeValidator: ThemeContrastValidator;
  private coverage: CoverageReport;

  constructor() {
    this.validator = new ContrastValidator();
    this.themeValidator = new ThemeContrastValidator();
    this.coverage = this.initCoverage();
  }

  /**
   * Run a test suite
   */
  async runSuite(suite: ContrastTestSuite): Promise<TestRunResult> {
    const startTime = performance.now();
    const results: TestCaseResult[] = [];
    
    // Setup
    if (suite.setup) {
      await suite.setup();
    }

    // Run tests
    for (const test of suite.tests) {
      const result = await this.runTest(test);
      results.push(result);
    }

    // Teardown
    if (suite.teardown) {
      await suite.teardown();
    }

    const endTime = performance.now();
    
    // Calculate summary
    const passed = results.filter(r => r.passed && !r.skipped).length;
    const failed = results.filter(r => !r.passed && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;

    return {
      suite: suite.name,
      passed,
      failed,
      skipped,
      duration: endTime - startTime,
      results,
      coverage: this.coverage
    };
  }

  /**
   * Run a single test case
   */
  private async runTest(test: ContrastTestCase): Promise<TestCaseResult> {
    const startTime = performance.now();
    const failures: string[] = [];
    
    try {
      // Get element to test
      const element = test.element || 
        (test.selector ? document.querySelector(test.selector) : null);

      let validation: ValidationResult;

      if (element) {
        // Test actual DOM element
        validation = await this.validateElement(element, test.options);
        this.updateCoverage(element, validation, test.options);
      } else if (test.foreground && test.background) {
        // Test color pair
        validation = this.validateColors(test.foreground, test.background, test.options);
      } else {
        return {
          name: test.name,
          passed: false,
          skipped: true,
          duration: 0,
          failures: ['No element or colors provided']
        };
      }

      // Check expectations
      if (test.expected) {
        if (test.expected.valid !== undefined && validation.valid !== test.expected.valid) {
          failures.push(
            `Expected valid=${test.expected.valid}, got ${validation.valid}`
          );
        }

        if (test.expected.minRatio !== undefined && validation.ratio < test.expected.minRatio) {
          failures.push(
            `Expected ratio >= ${test.expected.minRatio}, got ${validation.ratio.toFixed(2)}`
          );
        }

        if (test.expected.maxRatio !== undefined && validation.ratio > test.expected.maxRatio) {
          failures.push(
            `Expected ratio <= ${test.expected.maxRatio}, got ${validation.ratio.toFixed(2)}`
          );
        }
      }

      const endTime = performance.now();

      return {
        name: test.name,
        passed: failures.length === 0 && validation.valid,
        skipped: false,
        duration: endTime - startTime,
        validation,
        failures
      };
    } catch (error) {
      const endTime = performance.now();
      
      return {
        name: test.name,
        passed: false,
        skipped: false,
        duration: endTime - startTime,
        error: error as Error,
        failures: [`Test error: ${(error as Error).message}`]
      };
    }
  }

  /**
   * Validate element with extended options
   */
  private async validateElement(
    element: Element,
    options?: ValidationOptions
  ): Promise<ValidationResult> {
    // Determine element type
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');

    // Handle different element types
    if (element instanceof HTMLInputElement || 
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement) {
      return this.validator.validateFormElementContrast(element, options);
    }

    if (element instanceof SVGElement) {
      const background = this.themeValidator.getEffectiveBackgroundColor(
        element.parentElement || document.body
      );
      return this.validator.validateSVGContrast(element, background, options);
    }

    // Check for gradient backgrounds
    const bgImage = window.getComputedStyle(element).backgroundImage;
    if (bgImage && bgImage !== 'none' && bgImage.includes('gradient')) {
      return this.validator.validateGradientContrast(element, options);
    }

    // Check for image backgrounds
    if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
      const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
      if (urlMatch) {
        return this.validator.validateImageContrast(element, urlMatch[1], options);
      }
    }

    // Default validation
    return this.validator.validateElementContrast(element, options);
  }

  /**
   * Validate color pair
   */
  private validateColors(
    foreground: string | RGB,
    background: string | RGB,
    options?: ValidationOptions
  ): ValidationResult {
    const fg = typeof foreground === 'string' ? parseColor(foreground) : foreground;
    const bg = typeof background === 'string' ? parseColor(background) : background;

    if (!fg || !bg) {
      return {
        valid: false,
        ratio: 0,
        errors: [{
          type: 'color',
          message: 'Invalid color format',
          expected: 1,
          actual: 0
        }],
        warnings: [],
        suggestions: []
      };
    }

    const result = checkContrast(fg, bg);
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const requiredRatio = this.getRequiredRatio(options);
    const valid = result.ratio >= requiredRatio;

    if (!valid) {
      errors.push({
        type: 'contrast',
        message: `Contrast ratio ${result.ratio.toFixed(2)}:1 does not meet requirement`,
        expected: requiredRatio,
        actual: result.ratio
      });
    }

    // Check color blindness if requested
    if (options?.includeColorBlindness) {
      const types: Array<'protanopia' | 'deuteranopia' | 'tritanopia'> = 
        ['protanopia', 'deuteranopia', 'tritanopia'];
      
      for (const type of types) {
        const simFg = simulateColorBlindness(fg, type);
        const simBg = simulateColorBlindness(bg, type);
        const simResult = checkContrast(simFg, simBg);
        
        if (simResult.ratio < requiredRatio) {
          warnings.push({
            type: 'perception',
            message: `May fail for ${type} (${simResult.ratio.toFixed(2)}:1)`,
            suggestion: 'Test with color blindness simulators'
          });
        }
      }
    }

    return {
      valid,
      ratio: result.ratio,
      errors,
      warnings,
      suggestions: valid ? [] : ['Adjust colors to meet contrast requirements']
    };
  }

  /**
   * Run automated page scan
   */
  async scanPage(options?: {
    root?: Element;
    themes?: Array<'light' | 'dark' | 'high-contrast'>;
    wcagLevel?: 'AA' | 'AAA';
    includeColorBlindness?: boolean;
  }): Promise<Map<Element, ValidationResult>> {
    const root = options?.root || document.body;
    const results = new Map<Element, ValidationResult>();

    // Find all text elements
    const textElements = this.themeValidator.findAllTextElements(root);
    
    // Find all interactive elements
    const interactiveElements = root.querySelectorAll(
      'button, a, input, textarea, select, [role="button"], [role="link"], [tabindex]'
    );

    // Find all elements with background images
    const imageElements = Array.from(root.querySelectorAll('*')).filter(el => {
      const bg = window.getComputedStyle(el).backgroundImage;
      return bg && bg !== 'none';
    });

    // Test all elements
    const allElements = new Set([
      ...textElements,
      ...interactiveElements,
      ...imageElements
    ]);

    for (const element of allElements) {
      const validation = await this.validateElement(element, {
        level: options?.wcagLevel,
        includeColorBlindness: options?.includeColorBlindness
      });
      
      results.set(element, validation);
      this.updateCoverage(element, validation, { level: options?.wcagLevel });
    }

    return results;
  }

  /**
   * Generate test report
   */
  generateReport(results: TestRunResult[]): string {
    const report: string[] = [];
    
    report.push('# Contrast Validation Test Report');
    report.push(`Generated: ${new Date().toISOString()}\n`);

    // Summary
    const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    report.push('## Summary');
    report.push(`- Total Tests: ${totalPassed + totalFailed + totalSkipped}`);
    report.push(`- Passed: ${totalPassed} ✅`);
    report.push(`- Failed: ${totalFailed} ❌`);
    report.push(`- Skipped: ${totalSkipped} ⏭️`);
    report.push(`- Duration: ${totalDuration.toFixed(2)}ms\n`);

    // Coverage
    if (results.length > 0) {
      const coverage = results[0].coverage;
      report.push('## Coverage');
      report.push(`- Elements Checked: ${coverage.elementsChecked}`);
      report.push(`- Elements Passed: ${coverage.elementsPassed}`);
      report.push(`- Elements Failed: ${coverage.elementsFailed}`);
      report.push(`- Component Types: ${Array.from(coverage.componentsChecked).join(', ')}`);
      report.push(`- Themes Tested: ${Array.from(coverage.themesChecked).join(', ')}`);
      report.push(`- WCAG Levels: ${Array.from(coverage.wcagLevels).join(', ')}`);
      report.push(`- Color Blindness: ${coverage.colorBlindnessChecked ? 'Yes' : 'No'}\n`);
    }

    // Detailed results
    report.push('## Test Results');
    
    for (const suite of results) {
      report.push(`\n### ${suite.suite}`);
      
      for (const test of suite.results) {
        const icon = test.passed ? '✅' : test.skipped ? '⏭️' : '❌';
        report.push(`\n#### ${icon} ${test.name}`);
        
        if (test.validation) {
          report.push(`- Ratio: ${test.validation.ratio.toFixed(2)}:1`);
          report.push(`- Valid: ${test.validation.valid}`);
          
          if (test.validation.errors.length > 0) {
            report.push('- Errors:');
            test.validation.errors.forEach(err => {
              const message = typeof err === 'string' ? err : err.message;
              report.push(`  - ${message}`);
            });
          }

          if (test.validation.warnings.length > 0) {
            report.push('- Warnings:');
            test.validation.warnings.forEach(warn => {
              const message = typeof warn === 'string' ? warn : warn.message;
              report.push(`  - ${message}`);
            });
          }
        }
        
        if (test.failures.length > 0) {
          report.push('- Failures:');
          test.failures.forEach(failure => {
            report.push(`  - ${failure}`);
          });
        }
        
        if (test.error) {
          report.push(`- Error: ${test.error.message}`);
        }
      }
    }

    return report.join('\n');
  }

  /**
   * Update coverage metrics
   */
  private updateCoverage(
    element: Element,
    validation: ValidationResult,
    options?: ValidationOptions
  ): void {
    this.coverage.elementsChecked++;
    
    if (validation.valid) {
      this.coverage.elementsPassed++;
    } else {
      this.coverage.elementsFailed++;
    }

    // Track component type
    const tagName = element.tagName.toLowerCase();
    this.coverage.componentsChecked.add(tagName);

    // Track WCAG level
    if (options?.level) {
      this.coverage.wcagLevels.add(options.level);
    }

    // Track color blindness testing
    if (options?.includeColorBlindness) {
      this.coverage.colorBlindnessChecked = true;
    }
  }

  /**
   * Initialize coverage report
   */
  private initCoverage(): CoverageReport {
    return {
      elementsChecked: 0,
      elementsPassed: 0,
      elementsFailed: 0,
      componentsChecked: new Set(),
      themesChecked: new Set(),
      wcagLevels: new Set(),
      colorBlindnessChecked: false
    };
  }

  /**
   * Get required ratio based on options
   */
  private getRequiredRatio(options?: ValidationOptions): number {
    if (options?.customRatio) return options.customRatio;

    const { level = 'AA', componentType = 'text' } = options || {};

    switch (componentType) {
      case 'ui-component':
        return 3;
      case 'large-text':
        return level === 'AAA' ? 4.5 : 3;
      default:
        return level === 'AAA' ? 7 : 4.5;
    }
  }
}

/**
 * Create standard test suites
 */
export function createStandardTestSuites(): ContrastTestSuite[] {
  return [
    {
      name: 'WCAG AA Compliance',
      description: 'Test for WCAG 2.1 Level AA compliance',
      tests: [
        {
          name: 'Body text contrast',
          selector: 'body',
          options: { level: 'AA', componentType: 'text' },
          expected: { valid: true, minRatio: 4.5 }
        },
        {
          name: 'Heading contrast',
          selector: 'h1, h2, h3',
          options: { level: 'AA', componentType: 'large-text' },
          expected: { valid: true, minRatio: 3 }
        },
        {
          name: 'Link contrast',
          selector: 'a',
          options: { level: 'AA', componentType: 'text' },
          expected: { valid: true, minRatio: 4.5 }
        },
        {
          name: 'Button contrast',
          selector: 'button',
          options: { level: 'AA', componentType: 'ui-component' },
          expected: { valid: true, minRatio: 3 }
        }
      ]
    },
    {
      name: 'Form Accessibility',
      description: 'Test form element contrast',
      tests: [
        {
          name: 'Input text contrast',
          selector: 'input[type="text"]',
          options: { level: 'AA' },
          expected: { valid: true, minRatio: 4.5 }
        },
        {
          name: 'Input border contrast',
          selector: 'input',
          options: { level: 'AA', componentType: 'ui-component' },
          expected: { valid: true, minRatio: 3 }
        },
        {
          name: 'Placeholder contrast',
          selector: 'input[placeholder]',
          options: { level: 'AA' },
          expected: { valid: true, minRatio: 4.5 }
        },
        {
          name: 'Disabled input contrast',
          selector: 'input:disabled',
          options: { level: 'AA' },
          expected: { valid: true }
        }
      ]
    },
    {
      name: 'Color Blindness',
      description: 'Test contrast for color blindness',
      tests: [
        {
          name: 'Error messages - Protanopia',
          selector: '.error',
          options: { includeColorBlindness: true },
          expected: { valid: true }
        },
        {
          name: 'Success messages - Deuteranopia',
          selector: '.success',
          options: { includeColorBlindness: true },
          expected: { valid: true }
        },
        {
          name: 'Warning messages - Tritanopia',
          selector: '.warning',
          options: { includeColorBlindness: true },
          expected: { valid: true }
        }
      ]
    }
  ];
}