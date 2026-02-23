import type { AccessibilityTestResult, ContrastTestResult } from './types';
import type { AxeResults } from 'axe-core';

export interface ReportData {
  results: AccessibilityTestResult[];
  timestamp: Date;
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

export class HtmlReportGenerator {
  generateReport(data: ReportData): string {
    const { results, timestamp, summary } = data;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessibility Report - ${timestamp.toLocaleDateString()}</title>
  <style>
    :root {
      --color-pass: #10b981;
      --color-fail: #ef4444;
      --color-warning: #f59e0b;
      --color-info: #3b82f6;
      --color-critical: #dc2626;
      --color-major: #f97316;
      --color-minor: #fbbf24;
      --bg-primary: #ffffff;
      --bg-secondary: #f3f4f6;
      --text-primary: #111827;
      --text-secondary: #6b7280;
      --border-color: #e5e7eb;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: var(--text-primary);
      background: var(--bg-secondary);
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    .header {
      background: var(--bg-primary);
      border-radius: 0.5rem;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin: 2rem 0;
    }

    .summary-card {
      background: var(--bg-primary);
      padding: 1.5rem;
      border-radius: 0.5rem;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .summary-card h3 {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin-bottom: 0.5rem;
    }

    .summary-card .value {
      font-size: 2rem;
      font-weight: 600;
    }

    .summary-card.pass .value { color: var(--color-pass); }
    .summary-card.fail .value { color: var(--color-fail); }
    .summary-card.critical .value { color: var(--color-critical); }
    .summary-card.major .value { color: var(--color-major); }
    .summary-card.minor .value { color: var(--color-minor); }

    .charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 2rem;
      margin: 2rem 0;
    }

    .chart-container {
      background: var(--bg-primary);
      padding: 1.5rem;
      border-radius: 0.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .chart-container h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
    }

    .bar-chart {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .bar-item {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .bar-label {
      flex: 0 0 150px;
      font-size: 0.875rem;
    }

    .bar-container {
      flex: 1;
      height: 24px;
      background: var(--bg-secondary);
      border-radius: 0.25rem;
      overflow: hidden;
      position: relative;
    }

    .bar-fill {
      height: 100%;
      background: var(--color-info);
      transition: width 0.3s ease;
    }

    .bar-value {
      position: absolute;
      right: 0.5rem;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.75rem;
      font-weight: 600;
    }

    .violations-section {
      margin: 2rem 0;
    }

    .violation-card {
      background: var(--bg-primary);
      padding: 1.5rem;
      border-radius: 0.5rem;
      margin-bottom: 1rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .violation-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .severity-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: white;
    }

    .severity-badge.critical { background: var(--color-critical); }
    .severity-badge.serious { background: var(--color-major); }
    .severity-badge.moderate { background: var(--color-warning); }
    .severity-badge.minor { background: var(--color-minor); }

    .violation-description {
      color: var(--text-secondary);
      margin-bottom: 1rem;
    }

    .affected-elements {
      background: var(--bg-secondary);
      padding: 1rem;
      border-radius: 0.25rem;
      margin-top: 1rem;
    }

    .element-item {
      font-family: monospace;
      font-size: 0.875rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--border-color);
    }

    .element-item:last-child {
      border-bottom: none;
    }

    .contrast-examples {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
      margin: 2rem 0;
    }

    .contrast-example {
      background: var(--bg-primary);
      padding: 1rem;
      border-radius: 0.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .contrast-preview {
      padding: 1rem;
      margin: 0.5rem 0;
      border-radius: 0.25rem;
      text-align: center;
      font-weight: 500;
    }

    .contrast-details {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 0.5rem;
      font-size: 0.875rem;
    }

    .contrast-ratio {
      font-weight: 600;
    }

    .contrast-ratio.pass { color: var(--color-pass); }
    .contrast-ratio.fail { color: var(--color-fail); }

    .footer {
      text-align: center;
      color: var(--text-secondary);
      margin-top: 3rem;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Accessibility Report</h1>
      <p>Generated on ${timestamp.toLocaleString()}</p>
      <p>Tinyland.dev - WCAG 2.1 Compliance Testing</p>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <h3>Total Tests</h3>
        <div class="value">${summary.totalTests}</div>
      </div>
      <div class="summary-card pass">
        <h3>Passed</h3>
        <div class="value">${summary.passed}</div>
      </div>
      <div class="summary-card fail">
        <h3>Failed</h3>
        <div class="value">${summary.failed}</div>
      </div>
      <div class="summary-card">
        <h3>Success Rate</h3>
        <div class="value">${((summary.passed / summary.totalTests) * 100).toFixed(1)}%</div>
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-card critical">
        <h3>Critical Issues</h3>
        <div class="value">${summary.criticalIssues}</div>
      </div>
      <div class="summary-card major">
        <h3>Major Issues</h3>
        <div class="value">${summary.majorIssues}</div>
      </div>
      <div class="summary-card minor">
        <h3>Minor Issues</h3>
        <div class="value">${summary.minorIssues}</div>
      </div>
    </div>

    <div class="charts">
      <div class="chart-container">
        <h2>Issues by Theme</h2>
        <div class="bar-chart">
          ${this.generateThemeChart(summary.byTheme)}
        </div>
      </div>

      <div class="chart-container">
        <h2>Top Components with Issues</h2>
        <div class="bar-chart">
          ${this.generateComponentChart(summary.byComponent)}
        </div>
      </div>
    </div>

    <div class="violations-section">
      <h2>Accessibility Violations</h2>
      ${this.generateViolationsSection(results)}
    </div>

    <div class="contrast-section">
      <h2>Contrast Failures</h2>
      <div class="contrast-examples">
        ${this.generateContrastExamples(results)}
      </div>
    </div>

    <div class="footer">
      <p>This report was automatically generated by the Tinyland.dev accessibility testing suite.</p>
      <p>For more information about WCAG 2.1 compliance, visit <a href="https://www.w3.org/WAI/WCAG21/quickref/">WCAG Quick Reference</a></p>
    </div>
  </div>

  <script>
    // Animate progress bars on load
    window.addEventListener('load', () => {
      const bars = document.querySelectorAll('.bar-fill');
      bars.forEach(bar => {
        const width = bar.style.width;
        bar.style.width = '0';
        setTimeout(() => {
          bar.style.width = width;
        }, 100);
      });
    });

    // Add interactive filtering
    document.querySelectorAll('.severity-badge').forEach(badge => {
      badge.style.cursor = 'pointer';
      badge.addEventListener('click', (e) => {
        const severity = e.target.classList[1];
        const violations = document.querySelectorAll('.violation-card');
        violations.forEach(v => {
          const hasSeverity = v.querySelector('.severity-badge.' + severity);
          v.style.display = hasSeverity ? 'block' : 'none';
        });
      });
    });
  </script>
</body>
</html>`;
  }

  private generateThemeChart(themeData: Map<string, { passed: number; failed: number }>): string {
    const items: string[] = [];
    themeData.forEach((data, theme) => {
      const total = data.passed + data.failed;
      const percentage = (data.failed / total) * 100;
      items.push(`
        <div class="bar-item">
          <div class="bar-label">${theme}</div>
          <div class="bar-container">
            <div class="bar-fill" style="width: ${percentage}%; background: var(--color-fail)"></div>
            <div class="bar-value">${data.failed}/${total}</div>
          </div>
        </div>
      `);
    });
    return items.join('');
  }

  private generateComponentChart(componentData: Map<string, number>): string {
    const sorted = Array.from(componentData.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    const maxValue = sorted[0]?.[1] || 1;
    
    return sorted.map(([component, count]) => `
      <div class="bar-item">
        <div class="bar-label">${component}</div>
        <div class="bar-container">
          <div class="bar-fill" style="width: ${(count / maxValue) * 100}%"></div>
          <div class="bar-value">${count}</div>
        </div>
      </div>
    `).join('');
  }

  private generateViolationsSection(results: AccessibilityTestResult[]): string {
    const violations = new Map<string, {
      description: string;
      impact: string;
      count: number;
      elements: Set<string>;
      help: string;
      helpUrl: string;
    }>();

    results.forEach(result => {
      result.axeResults.violations.forEach(violation => {
        const existing = violations.get(violation.id) || {
          description: violation.description,
          impact: violation.impact || 'minor',
          count: 0,
          elements: new Set<string>(),
          help: violation.help,
          helpUrl: violation.helpUrl
        };
        
        existing.count += violation.nodes.length;
        violation.nodes.forEach(node => {
          existing.elements.add(node.target.join(' '));
        });
        
        violations.set(violation.id, existing);
      });
    });

    const sorted = Array.from(violations.entries())
      .sort((a, b) => {
        const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
        return (impactOrder[a[1].impact as keyof typeof impactOrder] || 3) - 
               (impactOrder[b[1].impact as keyof typeof impactOrder] || 3);
      });

    return sorted.map(([id, data]) => `
      <div class="violation-card">
        <div class="violation-header">
          <span class="severity-badge ${data.impact}">${data.impact.toUpperCase()}</span>
          <h3>${id}</h3>
          <span>Found ${data.count} times</span>
        </div>
        <p class="violation-description">${data.description}</p>
        <p><strong>Fix:</strong> ${data.help}</p>
        <p><a href="${data.helpUrl}" target="_blank">Learn more</a></p>
        <div class="affected-elements">
          <h4>Affected Elements (showing first 5):</h4>
          ${Array.from(data.elements).slice(0, 5).map(el => 
            `<div class="element-item">${this.escapeHtml(el)}</div>`
          ).join('')}
          ${data.elements.size > 5 ? `<div class="element-item">... and ${data.elements.size - 5} more</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  private generateContrastExamples(results: AccessibilityTestResult[]): string {
    const contrastFailures: ContrastTestResult[] = [];
    
    results.forEach(result => {
      result.contrastResults
        .filter(c => !c.meetsAA)
        .forEach(c => contrastFailures.push(c));
    });

    
    const uniqueFailures = new Map<string, ContrastTestResult>();
    contrastFailures.forEach(failure => {
      const key = `${failure.foreground}-${failure.background}`;
      if (!uniqueFailures.has(key) || failure.ratio < uniqueFailures.get(key)!.ratio) {
        uniqueFailures.set(key, failure);
      }
    });

    return Array.from(uniqueFailures.values())
      .slice(0, 12)
      .map(failure => `
        <div class="contrast-example">
          <h4>${failure.selector}</h4>
          <div class="contrast-preview" style="color: ${failure.foreground}; background: ${failure.background}">
            ${failure.element || 'Sample Text'}
          </div>
          <div class="contrast-details">
            <span>Ratio: <span class="contrast-ratio fail">${failure.ratio.toFixed(2)}:1</span></span>
            <span>Required: ${failure.isLargeText ? '3:1' : '4.5:1'}</span>
          </div>
          <div class="contrast-details">
            <span>FG: ${failure.foreground}</span>
            <span>BG: ${failure.background}</span>
          </div>
        </div>
      `).join('');
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}
