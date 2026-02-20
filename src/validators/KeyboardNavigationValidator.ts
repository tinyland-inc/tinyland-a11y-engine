import type { EvaluationResult } from '../types';

export class KeyboardNavigationValidator {
  private idCounter = 0;

  validate(container: HTMLElement = document.body): EvaluationResult[] {
    const results: EvaluationResult[] = [];
    
    // Check focusable elements
    this.validateFocusableElements(container, results);
    
    // Check tab order
    this.validateTabOrder(container, results);
    
    // Check focus indicators
    this.validateFocusIndicators(container, results);
    
    // Check for keyboard traps
    this.validateKeyboardTraps(container, results);
    
    // Check interactive elements
    this.validateInteractiveElements(container, results);
    
    // Check skip links
    this.validateSkipLinks(container, results);
    
    // Check form navigation
    this.validateFormNavigation(container, results);
    
    return results;
  }

  private validateFocusableElements(container: HTMLElement, results: EvaluationResult[]) {
    const focusableSelector = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = container.querySelectorAll(focusableSelector);
    
    // Report count
    results.push({
      id: this.generateId(),
      timestamp: Date.now(),
      type: 'keyboard',
      severity: 'info',
      wcagLevel: 'A',
      wcagCriteria: '2.1.1',
      selector: container === document.body ? 'body' : this.getSelector(container),
      message: `Found ${focusableElements.length} focusable elements`
    });

    // Check for disabled elements
    const disabledElements = container.querySelectorAll('[disabled]');
    if (disabledElements.length > 0) {
      results.push({
        id: this.generateId(),
        timestamp: Date.now(),
        type: 'keyboard',
        severity: 'info',
        wcagLevel: 'A',
        wcagCriteria: '2.1.1',
        selector: '[disabled]',
        message: `${disabledElements.length} disabled elements found`
      });
    }
  }

  private validateTabOrder(container: HTMLElement, results: EvaluationResult[]) {
    const elementsWithTabindex = container.querySelectorAll('[tabindex]');
    
    elementsWithTabindex.forEach(element => {
      const tabindex = parseInt(element.getAttribute('tabindex') || '0');
      
      if (tabindex > 0) {
        results.push({
          id: this.generateId(),
          timestamp: Date.now(),
          type: 'keyboard',
          severity: 'warning',
          wcagLevel: 'A',
          wcagCriteria: '2.4.3',
          selector: this.getSelector(element),
          message: `Element has positive tabindex (${tabindex}), which can disrupt natural tab order`,
          metadata: { tabindex }
        });
      }
    });
  }

  private validateFocusIndicators(container: HTMLElement, results: EvaluationResult[]) {
    const interactiveElements = container.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    interactiveElements.forEach(element => {
      const styles = window.getComputedStyle(element as HTMLElement);
      const focusElement = element as HTMLElement;
      
      // Create a temporary focus state check
      const originalTabIndex = focusElement.getAttribute('tabindex');
      if (!originalTabIndex) {
        focusElement.setAttribute('tabindex', '-1');
      }
      
      focusElement.focus();
      const focusStyles = window.getComputedStyle(focusElement);
      
      // Check for focus indicators
      const hasOutline = focusStyles.outlineStyle !== 'none' && focusStyles.outlineWidth !== '0px';
      const hasBoxShadow = focusStyles.boxShadow !== 'none';
      const hasBorderChange = styles.border !== focusStyles.border;
      
      focusElement.blur();
      
      // Restore original tabindex
      if (!originalTabIndex) {
        focusElement.removeAttribute('tabindex');
      }
      
      if (!hasOutline && !hasBoxShadow && !hasBorderChange) {
        results.push({
          id: this.generateId(),
          timestamp: Date.now(),
          type: 'keyboard',
          severity: 'error',
          wcagLevel: 'AA',
          wcagCriteria: '2.4.7',
          selector: this.getSelector(element),
          message: 'Element appears to lack visible focus indicator'
        });
      }
    });
  }

  private validateKeyboardTraps(container: HTMLElement, results: EvaluationResult[]) {
    // Check for modal dialogs without escape mechanisms
    const modals = container.querySelectorAll('[role="dialog"][aria-modal="true"]');

    modals.forEach(modal => {
      // Use standard CSS selectors (`:has-text()` is not a valid CSS pseudo-class)
      const closeButtons = modal.querySelectorAll(
        'button[aria-label*="close" i], button[aria-label*="cancel" i], button[aria-label*="Close"], button[aria-label*="Cancel"]'
      );

      // Also check for buttons with close-related text content
      let hasCloseButton = closeButtons.length > 0;
      if (!hasCloseButton) {
        const allButtons = modal.querySelectorAll('button');
        for (const btn of allButtons) {
          const text = btn.textContent?.trim().toLowerCase() || '';
          const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
          if (text === '\u00d7' || text === 'close' || text === 'cancel' ||
              text === 'x' || ariaLabel.includes('close') || ariaLabel.includes('cancel')) {
            hasCloseButton = true;
            break;
          }
        }
      }

      if (!hasCloseButton) {
        results.push({
          id: this.generateId(),
          timestamp: Date.now(),
          type: 'keyboard',
          severity: 'warning',
          wcagLevel: 'A',
          wcagCriteria: '2.1.2',
          selector: this.getSelector(modal),
          message: 'Modal dialog may create keyboard trap - no visible close button found'
        });
      }
    });
  }

  private validateInteractiveElements(container: HTMLElement, results: EvaluationResult[]) {
    // Find elements with click handlers that aren't semantic interactive elements
    const allElements = container.querySelectorAll('*');
    
    allElements.forEach(element => {
      const hasClickHandler = element.hasAttribute('onclick') || 
        (element as HTMLElement).onclick !== null;
      
      const isInteractive = element.matches(
        'a[href], button, input, select, textarea, [role="button"], [role="link"]'
      );
      
      if (hasClickHandler && !isInteractive) {
        results.push({
          id: this.generateId(),
          timestamp: Date.now(),
          type: 'keyboard',
          severity: 'error',
          wcagLevel: 'A',
          wcagCriteria: '4.1.2',
          selector: this.getSelector(element),
          message: 'Non-interactive element with click handler - should be a button or have appropriate ARIA role'
        });
      }
      
      // Check custom controls for keyboard support
      if (element.hasAttribute('role') && 
          ['button', 'link', 'tab', 'menuitem'].includes(element.getAttribute('role') || '')) {
        
        const hasTabindex = element.hasAttribute('tabindex');
        const hasKeyHandler = element.hasAttribute('onkeydown') || 
          element.hasAttribute('onkeyup') || 
          element.hasAttribute('onkeypress');
        
        if (!hasTabindex) {
          results.push({
            id: this.generateId(),
            timestamp: Date.now(),
            type: 'keyboard',
            severity: 'error',
            wcagLevel: 'A',
            wcagCriteria: '2.1.1',
            selector: this.getSelector(element),
            message: `Custom ${element.getAttribute('role')} lacks tabindex for keyboard access`
          });
        }
      }
    });
  }

  private validateSkipLinks(container: HTMLElement, results: EvaluationResult[]) {
    // Only check at document level
    if (container !== document.body) return;

    // Find skip links by class name (`:has-text()` is not a valid CSS pseudo-class)
    const skipLinksByClass = document.querySelectorAll('a[href^="#"][class*="skip"]');

    // Also check for links whose text content includes "skip"
    let hasSkipLink = skipLinksByClass.length > 0;
    if (!hasSkipLink) {
      const allHashLinks = document.querySelectorAll('a[href^="#"]');
      for (const link of allHashLinks) {
        if (link.textContent?.toLowerCase().includes('skip')) {
          hasSkipLink = true;
          break;
        }
      }
    }

    const hasNavigation = document.querySelector('nav, [role="navigation"]');

    if (hasNavigation && !hasSkipLink) {
      // Look for any link to main content
      const mainContentLinks = document.querySelectorAll('a[href="#main"], a[href="#content"]');
      
      if (mainContentLinks.length === 0) {
        results.push({
          id: this.generateId(),
          timestamp: Date.now(),
          type: 'keyboard',
          severity: 'warning',
          wcagLevel: 'A',
          wcagCriteria: '2.4.1',
          selector: 'body',
          message: 'No skip navigation link found - consider adding skip to main content link'
        });
      }
    }
  }

  private validateFormNavigation(container: HTMLElement, results: EvaluationResult[]) {
    const formInputs = container.querySelectorAll(
      'input:not([type="hidden"]), select, textarea'
    );
    
    formInputs.forEach(input => {
      const inputElement = input as HTMLInputElement;
      
      // Check for labels
      const hasLabel = inputElement.labels && inputElement.labels.length > 0;
      const hasAriaLabel = input.hasAttribute('aria-label');
      const hasAriaLabelledBy = input.hasAttribute('aria-labelledby');
      const hasTitle = input.hasAttribute('title');
      const hasPlaceholder = input.hasAttribute('placeholder');
      
      if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
        results.push({
          id: this.generateId(),
          timestamp: Date.now(),
          type: 'keyboard',
          severity: 'error',
          wcagLevel: 'A',
          wcagCriteria: '1.3.1',
          selector: this.getSelector(input),
          message: 'Form field lacks accessible label',
          metadata: {
            hasPlaceholder,
            inputType: inputElement.type
          }
        });
      }
    });
    
    // Check for submit buttons in forms
    const forms = container.querySelectorAll('form');
    forms.forEach(form => {
      const submitButtons = form.querySelectorAll(
        'button[type="submit"], input[type="submit"], button:not([type="button"])'
      );
      
      if (submitButtons.length === 0) {
        results.push({
          id: this.generateId(),
          timestamp: Date.now(),
          type: 'keyboard',
          severity: 'warning',
          wcagLevel: 'A',
          wcagCriteria: '2.1.1',
          selector: this.getSelector(form),
          message: 'Form lacks clear submit button'
        });
      }
    });
  }

  private getSelector(element: Element): string {
    if (element.id) {
      return `#${element.id}`;
    }
    
    let selector = element.tagName.toLowerCase();
    
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }
    
    // Add nth-child if needed
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(element);
      if (siblings.filter(s => s.tagName === element.tagName).length > 1) {
        selector += `:nth-child(${index + 1})`;
      }
    }
    
    return selector;
  }

  private generateId(): string {
    return `keyboard-${Date.now()}-${this.idCounter++}`;
  }
}