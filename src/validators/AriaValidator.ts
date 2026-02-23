




import type { EvaluationResult } from '../types';

export interface AriaValidationOptions {
  checkRoles?: boolean;
  checkLabels?: boolean;
  checkStates?: boolean;
  checkProperties?: boolean;
  checkLandmarks?: boolean;
}

export class AriaValidator {
  private options: AriaValidationOptions;

  constructor(options: AriaValidationOptions = {}) {
    this.options = {
      checkRoles: true,
      checkLabels: true,
      checkStates: true,
      checkProperties: true,
      checkLandmarks: true,
      ...options
    };
  }

  


  validate(container: Element): EvaluationResult[] {
    const results: EvaluationResult[] = [];
    const elements = container.querySelectorAll('[role], [aria-label], [aria-labelledby], [aria-describedby], [aria-hidden], [aria-expanded], [aria-pressed], [aria-selected], [aria-checked]');

    elements.forEach((element, index) => {
      const issues = this.validateElement(element);
      if (issues.length > 0) {
        results.push({
          id: `aria-${index}`,
          type: 'aria',
          severity: 'warning',
          message: issues.join('; '),
          selector: this.getSelector(element),
          wcagLevel: 'AA',
          wcagCriteria: '4.1.2',
          details: {
            element: element.tagName.toLowerCase(),
            issues
          }
        });
      }
    });

    return results;
  }

  


  private validateElement(element: Element): string[] {
    const issues: string[] = [];
    const role = element.getAttribute('role');

    
    if (role && this.options.checkRoles) {
      if (!this.isValidRole(role)) {
        issues.push(`Invalid ARIA role: ${role}`);
      }
    }

    
    if (this.options.checkLabels) {
      if (this.isInteractiveElement(element) && !this.hasAccessibleName(element)) {
        issues.push('Interactive element missing accessible name (aria-label or aria-labelledby)');
      }
    }

    
    if (this.options.checkStates) {
      const stateIssues = this.validateAriaStates(element);
      issues.push(...stateIssues);
    }

    
    if (this.options.checkProperties && role) {
      const propIssues = this.validateRoleProperties(element, role);
      issues.push(...propIssues);
    }

    return issues;
  }

  


  private isValidRole(role: string): boolean {
    const validRoles = [
      'alert', 'alertdialog', 'application', 'article', 'banner', 'button',
      'cell', 'checkbox', 'columnheader', 'combobox', 'complementary',
      'contentinfo', 'definition', 'dialog', 'directory', 'document',
      'feed', 'figure', 'form', 'grid', 'gridcell', 'group', 'heading',
      'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main', 'marquee',
      'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
      'navigation', 'none', 'note', 'option', 'presentation', 'progressbar',
      'radio', 'radiogroup', 'region', 'row', 'rowgroup', 'rowheader',
      'scrollbar', 'search', 'searchbox', 'separator', 'slider', 'spinbutton',
      'status', 'switch', 'tab', 'table', 'tablist', 'tabpanel', 'term',
      'textbox', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem'
    ];
    return validRoles.includes(role);
  }

  


  private isInteractiveElement(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');

    const interactiveTags = ['button', 'a', 'input', 'select', 'textarea'];
    const interactiveRoles = ['button', 'link', 'checkbox', 'radio', 'textbox', 'combobox', 'slider', 'switch', 'menuitem'];

    return interactiveTags.includes(tagName) ||
           (role !== null && interactiveRoles.includes(role));
  }

  


  private hasAccessibleName(element: Element): boolean {
    
    if (element.hasAttribute('aria-label') && element.getAttribute('aria-label')?.trim()) {
      return true;
    }

    
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement && labelElement.textContent?.trim()) {
        return true;
      }
    }

    
    if (element.textContent?.trim()) {
      return true;
    }

    
    if (element.hasAttribute('title') && element.getAttribute('title')?.trim()) {
      return true;
    }

    
    if (element.tagName.toLowerCase() === 'input') {
      const id = element.getAttribute('id');
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label && label.textContent?.trim()) {
          return true;
        }
      }
    }

    return false;
  }

  


  private validateAriaStates(element: Element): string[] {
    const issues: string[] = [];
    const booleanStates = ['aria-hidden', 'aria-expanded', 'aria-pressed', 'aria-selected', 'aria-checked', 'aria-disabled', 'aria-required'];

    for (const state of booleanStates) {
      const value = element.getAttribute(state);
      if (value !== null && !['true', 'false', 'mixed'].includes(value)) {
        issues.push(`Invalid ${state} value: "${value}" (expected true, false, or mixed)`);
      }
    }

    return issues;
  }

  


  private validateRoleProperties(element: Element, role: string): string[] {
    const issues: string[] = [];

    
    const requiredProps: Record<string, string[]> = {
      'checkbox': ['aria-checked'],
      'combobox': ['aria-expanded'],
      'heading': ['aria-level'],
      'meter': ['aria-valuenow'],
      'option': ['aria-selected'],
      'progressbar': ['aria-valuenow'],
      'radio': ['aria-checked'],
      'scrollbar': ['aria-controls', 'aria-valuenow'],
      'slider': ['aria-valuenow'],
      'spinbutton': ['aria-valuenow'],
      'switch': ['aria-checked']
    };

    const required = requiredProps[role];
    if (required) {
      for (const prop of required) {
        if (!element.hasAttribute(prop)) {
          issues.push(`Role "${role}" requires ${prop} attribute`);
        }
      }
    }

    return issues;
  }

  


  private getSelector(element: Element): string {
    const id = element.id;
    if (id) {
      return `#${id}`;
    }

    const tagName = element.tagName.toLowerCase();
    const classList = Array.from(element.classList).join('.');

    return classList ? `${tagName}.${classList}` : tagName;
  }
}




export function createAriaValidator(options?: AriaValidationOptions): AriaValidator {
  return new AriaValidator(options);
}
