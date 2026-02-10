import { HtmlReportGenerator } from './HtmlReportGenerator';
import { JsonReportGenerator } from './JsonReportGenerator';
import { MarkdownReportGenerator } from './MarkdownReportGenerator';
import type { AccessibilityTestResult } from './types';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Optional logger interface for external logging integrations (e.g., Loki).
 * Consumers can provide their own implementation when instantiating the orchestrator.
 */
export interface A11yLogger {
  summary(data: Record<string, unknown>): void;
  aria(message: string, data: Record<string, unknown>): void;
  contrast(message: string, data: Record<string, unknown>): void;
}

/** No-op logger used when no external logger is provided */
const noopLogger: A11yLogger = {
  summary: () => {},
  aria: () => {},
  contrast: () => {},
};

export interface ReportConfig {
  outputDir: string;
  formats: ('html' | 'json' | 'markdown')[];
  sendToLoki?: boolean;
  generateScreenshots?: boolean;
  githubIntegration?: {
    enabled: boolean;
    prNumber?: number;
    repository?: string;
  };
  slackIntegration?: {
    enabled: boolean;
    webhookUrl?: string;
    channel?: string;
  };
}

export class ReportOrchestrator {
  private htmlGenerator: HtmlReportGenerator;
  private jsonGenerator: JsonReportGenerator;
  private markdownGenerator: MarkdownReportGenerator;
  private logger: A11yLogger;

  constructor(logger?: A11yLogger) {
    this.htmlGenerator = new HtmlReportGenerator();
    this.jsonGenerator = new JsonReportGenerator();
    this.markdownGenerator = new MarkdownReportGenerator();
    this.logger = logger ?? noopLogger;
  }

  async generateReports(
    results: AccessibilityTestResult[],
    config: ReportConfig
  ): Promise<ReportOutputs> {
    const timestamp = new Date();
    const outputs: ReportOutputs = {
      timestamp,
      paths: {},
      summary: this.generateSummary(results)
    };

    // Ensure output directory exists
    mkdirSync(config.outputDir, { recursive: true });

    // Generate reports in requested formats
    if (config.formats.includes('html')) {
      const htmlReport = this.generateHtmlReport(results, timestamp);
      const htmlPath = join(config.outputDir, `accessibility-report-${timestamp.getTime()}.html`);
      writeFileSync(htmlPath, htmlReport);
      outputs.paths.html = htmlPath;
    }

    if (config.formats.includes('json')) {
      const jsonReport = this.jsonGenerator.generateReport(results);
      const jsonPath = join(config.outputDir, `accessibility-report-${timestamp.getTime()}.json`);
      writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
      outputs.paths.json = jsonPath;

      // Also generate CI/CD report
      const cicdReport = this.jsonGenerator.generateCICDReport(results);
      const cicdPath = join(config.outputDir, `accessibility-ci-report-${timestamp.getTime()}.json`);
      writeFileSync(cicdPath, JSON.stringify(cicdReport, null, 2));
      outputs.paths.cicd = cicdPath;
    }

    if (config.formats.includes('markdown')) {
      const markdownReport = this.markdownGenerator.generateReport(results);
      const markdownPath = join(config.outputDir, `accessibility-report-${timestamp.getTime()}.md`);
      writeFileSync(markdownPath, markdownReport);
      outputs.paths.markdown = markdownPath;
    }

    // Send to Loki if configured
    if (config.sendToLoki) {
      await this.sendToLoki(results, outputs.summary);
    }

    // GitHub integration
    if (config.githubIntegration?.enabled && config.githubIntegration.prNumber) {
      await this.postGitHubComment(results, config.githubIntegration);
    }

    // Slack integration
    if (config.slackIntegration?.enabled && config.slackIntegration.webhookUrl) {
      await this.sendSlackNotification(outputs.summary, config.slackIntegration);
    }

    return outputs;
  }

  private generateHtmlReport(results: AccessibilityTestResult[], timestamp: Date): string {
    const summary = this.generateSummary(results);
    const reportData = {
      results,
      timestamp,
      summary
    };
    return this.htmlGenerator.generateReport(reportData);
  }

  private generateSummary(results: AccessibilityTestResult[]) {
    const totalTests = results.length;
    const passed = results.filter(r => r.axeResults.violations.length === 0).length;
    const failed = totalTests - passed;

    let criticalIssues = 0;
    let majorIssues = 0;
    let minorIssues = 0;

    const byTheme = new Map<string, { passed: number; failed: number }>();
    const byRoute = new Map<string, { passed: number; failed: number }>();
    const byComponent = new Map<string, number>();

    results.forEach(result => {
      // Theme stats
      const themeStats = byTheme.get(result.theme) || { passed: 0, failed: 0 };
      if (result.axeResults.violations.length === 0) {
        themeStats.passed++;
      } else {
        themeStats.failed++;
      }
      byTheme.set(result.theme, themeStats);

      // Route stats
      const routeStats = byRoute.get(result.route) || { passed: 0, failed: 0 };
      if (result.axeResults.violations.length === 0) {
        routeStats.passed++;
      } else {
        routeStats.failed++;
      }
      byRoute.set(result.route, routeStats);

      // Count issues by severity
      result.axeResults.violations.forEach(violation => {
        const impact = violation.impact || 'minor';
        if (impact === 'critical') criticalIssues += violation.nodes.length;
        else if (impact === 'serious') majorIssues += violation.nodes.length;
        else minorIssues += violation.nodes.length;

        // Component stats
        violation.nodes.forEach(node => {
          const target = node.target[0];
          // Handle different selector types (string or CrossTreeSelector/ShadowDomSelector)
          const selector = typeof target === 'string' ? target : String(target);
          const component = selector.split(/[#\.\[\s]/)[0];
          byComponent.set(component, (byComponent.get(component) || 0) + 1);
        });
      });
    });

    return {
      totalTests,
      passed,
      failed,
      criticalIssues,
      majorIssues,
      minorIssues,
      byTheme,
      byRoute,
      byComponent
    };
  }

  private async sendToLoki(results: AccessibilityTestResult[], summary: any) {
    // Log overall summary
    this.logger.summary({
      totalElements: results.reduce((sum, r) => sum + (r.axeResults.passes.length + r.axeResults.violations.length), 0),
      evaluatedElements: results.reduce((sum, r) => sum + r.axeResults.violations.length, 0),
      issues: summary.criticalIssues + summary.majorIssues + summary.minorIssues,
      criticalIssues: summary.criticalIssues,
      evaluationTimeMs: results.reduce((sum, r) => sum + r.duration, 0),
      sessionId: `report-${Date.now()}`
    });

    // Log individual violations
    results.forEach(result => {
      result.axeResults.violations.forEach(violation => {
        violation.nodes.forEach(node => {
          this.logger.aria(
            `${violation.id}: ${violation.help}`,
            {
              selector: node.target.join(' '),
              issue: violation.description,
              elementInfo: {
                tagName: node.html.match(/<(\w+)/)?.[1] || 'unknown',
                html: node.html
              },
              fix: violation.help,
              page: result.route,
              sessionId: `test-${Date.now()}`
            }
          );
        });
      });

      // Log contrast failures
      result.contrastResults
        .filter(c => !c.meetsAA)
        .forEach(contrast => {
          this.logger.contrast(
            `Contrast ratio ${contrast.ratio.toFixed(2)}:1 fails WCAG requirements`,
            {
              selector: contrast.selector,
              ratio: contrast.ratio,
              requiredRatio: contrast.isLargeText ? 3 : 4.5,
              foreground: contrast.foreground,
              background: contrast.background,
              elementInfo: {
                tagName: contrast.selector.replace(/[#\.\[].*/, ''),
                text: contrast.element
              },
              page: result.route,
              theme: result.theme,
              sessionId: `test-${Date.now()}`
            }
          );
        });
    });
  }

  private async postGitHubComment(results: AccessibilityTestResult[], config: any) {
    const comment = this.markdownGenerator.generatePRComment(results);

    // In a real implementation, this would use the GitHub API
    console.log(`Would post GitHub comment to PR #${config.prNumber}:`, comment);
  }

  private async sendSlackNotification(summary: any, config: any) {
    const status = summary.criticalIssues > 0 ? ':x:' :
                  summary.failed > 0 ? ':warning:' : ':white_check_mark:';

    const message = {
      channel: config.channel,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${status} Accessibility Test Results`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Success Rate:*\n${((summary.passed / summary.totalTests) * 100).toFixed(1)}%`
            },
            {
              type: 'mrkdwn',
              text: `*Tests:*\nPassed: ${summary.passed}\nFailed: ${summary.failed}`
            }
          ]
        }
      ]
    };

    if (summary.criticalIssues > 0) {
      message.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:rotating_light: *${summary.criticalIssues} critical issues found!*`
        }
      });
    }

    // In a real implementation, this would send to Slack webhook
    console.log('Would send Slack notification:', message);
  }
}

export interface ReportOutputs {
  timestamp: Date;
  paths: {
    html?: string;
    json?: string;
    markdown?: string;
    cicd?: string;
  };
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    criticalIssues: number;
    majorIssues: number;
    minorIssues: number;
    byTheme: Map<string, { passed: number; failed: number }>;
    byRoute: Map<string, { passed: number; failed: number }>;
    byComponent: Map<string, number>;
  };
}
