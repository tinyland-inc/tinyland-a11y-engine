import type { AccessibilityTestResult } from './types';
import type { Result } from 'axe-core';

export interface JsonReport {
  metadata: {
    timestamp: string;
    version: string;
    testRunner: string;
    environment: string;
  };
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    successRate: number;
    duration: number;
    violations: {
      total: number;
      critical: number;
      serious: number;
      moderate: number;
      minor: number;
    };
  };
  results: {
    byTheme: Record<string, ThemeResult>;
    byRoute: Record<string, RouteResult>;
    byComponent: Record<string, ComponentResult>;
  };
  violations: ViolationDetail[];
  contrastFailures: ContrastFailure[];
  actionableItems: ActionableItem[];
}

interface ThemeResult {
  passed: number;
  failed: number;
  violations: number;
  criticalIssues: number;
}

interface RouteResult {
  passed: number;
  failed: number;
  violations: number;
  themes: Record<string, boolean>;
}

interface ComponentResult {
  occurrences: number;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  violations: string[];
}

interface ViolationDetail {
  id: string;
  impact: string;
  description: string;
  help: string;
  helpUrl: string;
  wcagCriteria: string[];
  occurrences: number;
  affectedElements: ElementDetail[];
}

interface ElementDetail {
  selector: string;
  html: string;
  failureSummary: string;
  route: string;
  theme: string;
}

interface ContrastFailure {
  selector: string;
  foreground: string;
  background: string;
  ratio: number;
  requiredRatio: number;
  wcagLevel: 'AA' | 'AAA';
  fontSize: string;
  fontWeight: string;
  element: string;
  routes: string[];
  themes: string[];
}

interface ActionableItem {
  priority: 'immediate' | 'high' | 'medium' | 'low';
  type: 'contrast' | 'aria' | 'keyboard' | 'structure';
  issue: string;
  solution: string;
  affectedComponents: string[];
  estimatedEffort: 'trivial' | 'small' | 'medium' | 'large';
  wcagCriteria: string;
}

export class JsonReportGenerator {
  generateReport(results: AccessibilityTestResult[]): JsonReport {
    const timestamp = new Date();
    const summary = this.calculateSummary(results);
    const violations = this.extractViolations(results);
    const contrastFailures = this.extractContrastFailures(results);
    const actionableItems = this.generateActionableItems(violations, contrastFailures);

    return {
      metadata: {
        timestamp: timestamp.toISOString(),
        version: '1.0.0',
        testRunner: 'playwright-axe',
        environment: process.env.NODE_ENV || 'test'
      },
      summary,
      results: {
        byTheme: this.groupByTheme(results),
        byRoute: this.groupByRoute(results),
        byComponent: this.groupByComponent(violations)
      },
      violations,
      contrastFailures,
      actionableItems
    };
  }

  generateCICDReport(results: AccessibilityTestResult[]): CICDReport {
    const report = this.generateReport(results);
    const hasFailures = report.summary.failed > 0;
    const hasCriticalIssues = report.summary.violations.critical > 0;
    
    return {
      status: hasFailures ? 'failed' : 'passed',
      blocking: hasCriticalIssues,
      summary: {
        message: this.generateSummaryMessage(report.summary),
        successRate: report.summary.successRate,
        criticalIssues: report.summary.violations.critical,
        totalViolations: report.summary.violations.total
      },
      annotations: this.generateAnnotations(report.violations),
      metrics: {
        accessibility_score: report.summary.successRate,
        critical_violations: report.summary.violations.critical,
        serious_violations: report.summary.violations.serious,
        contrast_failures: report.contrastFailures.length,
        test_duration_ms: report.summary.duration
      },
      artifacts: {
        fullReport: 'accessibility-report.html',
        jsonReport: 'accessibility-report.json',
        screenshots: this.getScreenshotPaths(results)
      }
    };
  }

  private calculateSummary(results: AccessibilityTestResult[]) {
    const totalTests = results.length;
    const passed = results.filter(r => r.axeResults.violations.length === 0).length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    
    const violations = {
      total: 0,
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0
    };

    results.forEach(result => {
      result.axeResults.violations.forEach(violation => {
        violations.total += violation.nodes.length;
        const impact = violation.impact || 'minor';
        violations[impact as keyof typeof violations] += violation.nodes.length;
      });
    });

    return {
      totalTests,
      passed,
      failed: totalTests - passed,
      successRate: (passed / totalTests) * 100,
      duration: totalDuration,
      violations
    };
  }

  private extractViolations(results: AccessibilityTestResult[]): ViolationDetail[] {
    const violationMap = new Map<string, ViolationDetail>();

    results.forEach(result => {
      result.axeResults.violations.forEach(violation => {
        const existing = violationMap.get(violation.id) || {
          id: violation.id,
          impact: violation.impact || 'minor',
          description: violation.description,
          help: violation.help,
          helpUrl: violation.helpUrl,
          wcagCriteria: violation.tags.filter(tag => tag.startsWith('wcag')),
          occurrences: 0,
          affectedElements: []
        };

        existing.occurrences += violation.nodes.length;
        
        violation.nodes.forEach(node => {
          existing.affectedElements.push({
            selector: node.target.join(' '),
            html: node.html,
            failureSummary: node.failureSummary || '',
            route: result.route,
            theme: result.theme
          });
        });

        violationMap.set(violation.id, existing);
      });
    });

    return Array.from(violationMap.values())
      .sort((a, b) => {
        const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
        return (impactOrder[a.impact as keyof typeof impactOrder] || 3) - 
               (impactOrder[b.impact as keyof typeof impactOrder] || 3);
      });
  }

  private extractContrastFailures(results: AccessibilityTestResult[]): ContrastFailure[] {
    const failureMap = new Map<string, ContrastFailure>();

    results.forEach(result => {
      result.contrastResults
        .filter(c => !c.meetsAA)
        .forEach(contrast => {
          const key = `${contrast.selector}-${contrast.foreground}-${contrast.background}`;
          const existing = failureMap.get(key);
          
          if (existing) {
            if (!existing.routes.includes(result.route)) {
              existing.routes.push(result.route);
            }
            if (!existing.themes.includes(result.theme)) {
              existing.themes.push(result.theme);
            }
          } else {
            failureMap.set(key, {
              selector: contrast.selector,
              foreground: contrast.foreground,
              background: contrast.background,
              ratio: contrast.ratio,
              requiredRatio: contrast.isLargeText ? 3 : 4.5,
              wcagLevel: contrast.meetsAAA ? 'AAA' : 'AA',
              fontSize: contrast.fontSize,
              fontWeight: contrast.fontWeight,
              element: contrast.element,
              routes: [result.route],
              themes: [result.theme]
            });
          }
        });
    });

    return Array.from(failureMap.values())
      .sort((a, b) => a.ratio - b.ratio); 
  }

  private generateActionableItems(
    violations: ViolationDetail[], 
    contrastFailures: ContrastFailure[]
  ): ActionableItem[] {
    const items: ActionableItem[] = [];

    
    contrastFailures.slice(0, 10).forEach(failure => {
      items.push({
        priority: failure.ratio < 3 ? 'immediate' : 'high',
        type: 'contrast',
        issue: `Contrast ratio ${failure.ratio.toFixed(2)}:1 fails WCAG ${failure.wcagLevel} (requires ${failure.requiredRatio}:1)`,
        solution: `Update ${failure.selector} to use higher contrast colors. Current: ${failure.foreground} on ${failure.background}`,
        affectedComponents: [failure.selector],
        estimatedEffort: 'trivial',
        wcagCriteria: '1.4.3'
      });
    });

    
    violations.forEach(violation => {
      const priority = violation.impact === 'critical' ? 'immediate' : 
                      violation.impact === 'serious' ? 'high' : 
                      violation.impact === 'moderate' ? 'medium' : 'low';
      
      const components = [...new Set(violation.affectedElements.map(el => 
        el.selector.split(' ')[0]
      ))];

      items.push({
        priority,
        type: this.getViolationType(violation.id),
        issue: violation.description,
        solution: violation.help,
        affectedComponents: components.slice(0, 5),
        estimatedEffort: this.estimateEffort(violation),
        wcagCriteria: violation.wcagCriteria.join(', ')
      });
    });

    return items.sort((a, b) => {
      const priorityOrder = { immediate: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private getViolationType(violationId: string): 'contrast' | 'aria' | 'keyboard' | 'structure' {
    if (violationId.includes('contrast')) return 'contrast';
    if (violationId.includes('aria')) return 'aria';
    if (violationId.includes('keyboard') || violationId.includes('focus')) return 'keyboard';
    return 'structure';
  }

  private estimateEffort(violation: ViolationDetail): 'trivial' | 'small' | 'medium' | 'large' {
    if (violation.occurrences === 1) return 'trivial';
    if (violation.occurrences < 5) return 'small';
    if (violation.occurrences < 20) return 'medium';
    return 'large';
  }

  private groupByTheme(results: AccessibilityTestResult[]): Record<string, ThemeResult> {
    const themes: Record<string, ThemeResult> = {};
    
    results.forEach(result => {
      if (!themes[result.theme]) {
        themes[result.theme] = {
          passed: 0,
          failed: 0,
          violations: 0,
          criticalIssues: 0
        };
      }
      
      const themeResult = themes[result.theme];
      if (result.axeResults.violations.length === 0) {
        themeResult.passed++;
      } else {
        themeResult.failed++;
        result.axeResults.violations.forEach(v => {
          themeResult.violations += v.nodes.length;
          if (v.impact === 'critical') {
            themeResult.criticalIssues += v.nodes.length;
          }
        });
      }
    });
    
    return themes;
  }

  private groupByRoute(results: AccessibilityTestResult[]): Record<string, RouteResult> {
    const routes: Record<string, RouteResult> = {};
    
    results.forEach(result => {
      if (!routes[result.route]) {
        routes[result.route] = {
          passed: 0,
          failed: 0,
          violations: 0,
          themes: {}
        };
      }
      
      const routeResult = routes[result.route];
      const hasPassed = result.axeResults.violations.length === 0;
      
      if (hasPassed) {
        routeResult.passed++;
      } else {
        routeResult.failed++;
        routeResult.violations += result.axeResults.violations.reduce(
          (sum, v) => sum + v.nodes.length, 0
        );
      }
      
      routeResult.themes[result.theme] = hasPassed;
    });
    
    return routes;
  }

  private groupByComponent(violations: ViolationDetail[]): Record<string, ComponentResult> {
    const components: Record<string, ComponentResult> = {};
    
    violations.forEach(violation => {
      violation.affectedElements.forEach(element => {
        const component = element.selector.split(' ')[0];
        
        if (!components[component]) {
          components[component] = {
            occurrences: 0,
            severity: violation.impact as any,
            violations: []
          };
        }
        
        components[component].occurrences++;
        if (!components[component].violations.includes(violation.id)) {
          components[component].violations.push(violation.id);
        }
        
        
        const severityOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
        const currentSeverity = severityOrder[components[component].severity];
        const violationSeverity = severityOrder[violation.impact as keyof typeof severityOrder];
        
        if (violationSeverity < currentSeverity) {
          components[component].severity = violation.impact as any;
        }
      });
    });
    
    return components;
  }

  private generateSummaryMessage(summary: any): string {
    if (summary.violations.critical > 0) {
      return `🚨 Critical accessibility issues detected! ${summary.violations.critical} critical violations must be fixed.`;
    }
    if (summary.failed > 0) {
      return `⚠️ Accessibility tests failed. ${summary.violations.total} violations found across ${summary.failed} test cases.`;
    }
    return `✅ All accessibility tests passed! Success rate: ${summary.successRate.toFixed(1)}%`;
  }

  private generateAnnotations(violations: ViolationDetail[]): Annotation[] {
    return violations
      .filter(v => v.impact === 'critical' || v.impact === 'serious')
      .slice(0, 10)
      .map(violation => ({
        level: violation.impact === 'critical' ? 'failure' : 'warning',
        message: `${violation.id}: ${violation.help}`,
        file: 'accessibility-test',
        line: 1,
        title: `Accessibility: ${violation.impact} issue`
      }));
  }

  private getScreenshotPaths(results: AccessibilityTestResult[]): string[] {
    
    return results
      .filter(r => r.axeResults.violations.length > 0)
      .map(r => `screenshots/${r.route.replace(/\//g, '-')}-${r.theme}.png`);
  }
}

interface CICDReport {
  status: 'passed' | 'failed';
  blocking: boolean;
  summary: {
    message: string;
    successRate: number;
    criticalIssues: number;
    totalViolations: number;
  };
  annotations: Annotation[];
  metrics: Record<string, number>;
  artifacts: {
    fullReport: string;
    jsonReport: string;
    screenshots: string[];
  };
}

interface Annotation {
  level: 'notice' | 'warning' | 'failure';
  message: string;
  file: string;
  line: number;
  title: string;
}
