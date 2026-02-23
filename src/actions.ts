




import type { Action } from 'svelte/action';
import {
  validateContrast,
  validateFocusIndicator,
  type ValidationResult,
  type ValidationOptions
} from './validators.js';
import { getEffectiveBackgroundColor, type RGB, rgbToHex, getContrastRatio, hexToRgb } from './contrast.js';




function validateElementContrast(
  element: HTMLElement,
  options: ValidationOptions = {}
): ValidationResult {
  const styles = window.getComputedStyle(element);
  const foreground = styles.color;
  const background = getEffectiveBackgroundColor(element);
  const bgHex = rgbToHex(background);

  return validateContrast(foreground, bgHex, {
    wcagLevel: options.level,
    isLargeText: options.largeText
  });
}


export type { ValidationOptions } from './validators.js';

export interface ContrastActionOptions extends ValidationOptions {
  


  showIndicators?: boolean;
  
  


  autoFix?: boolean;
  
  


  onValidate?: (result: ValidationResult) => void;
  
  


  checkOn?: string[];
  
  


  debounce?: number;
  
  


  errorClass?: string;
  
  


  successClass?: string;
  
  


  showReportOnHover?: boolean;
}




export const contrastCheck: Action<HTMLElement, ContrastActionOptions> = (
  node: HTMLElement,
  options: ContrastActionOptions = {}
) => {
  const {
    showIndicators = true,
    autoFix = false,
    onValidate,
    checkOn = ['load', 'resize', 'mutation'],
    debounce = 100,
    errorClass = 'contrast-error',
    successClass = 'contrast-success',
    showReportOnHover = true
  } = options;
  
  let indicatorElement: HTMLElement | null = null;
  let reportElement: HTMLElement | null = null;
  let validationTimeout: number | null = null;
  let observer: MutationObserver | null = null;
  
  
  const createIndicator = () => {
    if (!showIndicators) return;
    
    indicatorElement = document.createElement('div');
    indicatorElement.className = 'contrast-indicator';
    indicatorElement.setAttribute('role', 'status');
    indicatorElement.setAttribute('aria-live', 'polite');
    indicatorElement.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      width: 24px;
      height: 24px;
      pointer-events: none;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      border-radius: 50%;
      transition: all 0.2s ease;
    `;
    
    
    const position = node.style.position;
    if (!position || position === 'static') {
      node.style.position = 'relative';
    }
    
    node.appendChild(indicatorElement);
  };
  
  
  const createReport = (result: ValidationResult) => {
    if (!showReportOnHover || !indicatorElement) return;
    
    reportElement = document.createElement('div');
    reportElement.className = 'contrast-report';
    reportElement.setAttribute('role', 'tooltip');
    reportElement.style.cssText = `
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 8px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.5;
      white-space: nowrap;
      z-index: 10000;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    `;
    
    const ratio = result.metadata?.ratio ?? 0;
    const content = `
      <strong>Contrast Ratio: ${ratio.toFixed(2)}:1</strong><br>
      ${result.valid ? '✅ Passes' : '❌ Fails'} WCAG ${options.level || 'AA'}<br>
      ${result.errors.join('<br>')}
    `;
    
    reportElement.innerHTML = content;
    indicatorElement.appendChild(reportElement);
    
    
    indicatorElement.style.pointerEvents = 'auto';
    indicatorElement.addEventListener('mouseenter', () => {
      if (reportElement) reportElement.style.opacity = '1';
    });
    indicatorElement.addEventListener('mouseleave', () => {
      if (reportElement) reportElement.style.opacity = '0';
    });
  };
  
  
  const updateIndicator = (result: ValidationResult) => {
    if (!indicatorElement) return;
    
    if (result.valid) {
      indicatorElement.innerHTML = '✓';
      indicatorElement.style.background = '#4ade80';
      indicatorElement.style.color = '#166534';
      indicatorElement.setAttribute('aria-label', 'Contrast check passed');
    } else {
      indicatorElement.innerHTML = '!';
      indicatorElement.style.background = '#f87171';
      indicatorElement.style.color = '#991b1b';
      indicatorElement.setAttribute('aria-label', `Contrast check failed: ${result.errors[0] || 'Unknown error'}`);
    }
    
    
    if (reportElement) {
      reportElement.remove();
      reportElement = null;
    }
    createReport(result);
  };
  
  
  const applyAutoFix = (result: ValidationResult) => {
    if (!autoFix || result.valid) return;
    
    const background = getEffectiveBackgroundColor(node);
    const currentColor = window.getComputedStyle(node).color;
    
    
    const targetRatio = options.largeText ? 3 : 4.5;
    
    
    const isDarkBg = (background.r + background.g + background.b) / 3 < 128;
    
    if (isDarkBg) {
      
      node.style.color = '#ffffff';
    } else {
      
      node.style.color = '#000000';
    }
    
    
    setTimeout(() => validate(), 50);
  };
  
  
  const validate = () => {
    const result = validateElementContrast(node, options);
    
    
    node.classList.toggle(errorClass, !result.valid);
    node.classList.toggle(successClass, result.valid);
    
    
    updateIndicator(result);
    
    
    applyAutoFix(result);
    
    
    onValidate?.(result);
  };
  
  
  const debouncedValidate = () => {
    if (validationTimeout) clearTimeout(validationTimeout);
    validationTimeout = window.setTimeout(validate, debounce);
  };
  
  
  const handleResize = () => debouncedValidate();
  const handleMutation = () => debouncedValidate();
  
  
  createIndicator();
  
  if (checkOn.includes('load')) {
    
    setTimeout(validate, 0);
  }
  
  if (checkOn.includes('resize')) {
    window.addEventListener('resize', handleResize);
  }
  
  if (checkOn.includes('mutation')) {
    observer = new MutationObserver(handleMutation);
    observer.observe(node, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      childList: true,
      subtree: true
    });
  }
  
  
  return {
    update(newOptions: ContrastActionOptions) {
      Object.assign(options, newOptions);
      validate();
    },
    destroy() {
      if (validationTimeout) clearTimeout(validationTimeout);
      if (indicatorElement) indicatorElement.remove();
      if (reportElement) reportElement.remove();
      if (observer) observer.disconnect();
      
      window.removeEventListener('resize', handleResize);
      
      
      node.classList.remove(errorClass, successClass);
    }
  };
};




export const focusCheck: Action<HTMLElement, ValidationOptions> = (
  node: HTMLElement,
  options: ValidationOptions = {}
) => {
  let isValid = true;
  let indicatorElement: HTMLElement | null = null;
  
  const createIndicator = () => {
    indicatorElement = document.createElement('div');
    indicatorElement.className = 'focus-indicator-check';
    indicatorElement.style.cssText = `
      position: absolute;
      top: -8px;
      right: -8px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      display: none;
    `;
    
    const position = node.style.position;
    if (!position || position === 'static') {
      node.style.position = 'relative';
    }
    
    node.appendChild(indicatorElement);
  };
  
  const validate = () => {
    const result = validateFocusIndicator(node, {
      wcagLevel: options.level,
      isLargeText: options.largeText
    });
    isValid = result.valid;
    
    if (indicatorElement) {
      indicatorElement.style.display = 'block';
      indicatorElement.style.background = isValid ? '#4ade80' : '#f87171';
      
      setTimeout(() => {
        if (indicatorElement) indicatorElement.style.display = 'none';
      }, 2000);
    }
  };
  
  const handleFocus = () => validate();
  const handleBlur = () => {
    if (indicatorElement) indicatorElement.style.display = 'none';
  };
  
  createIndicator();
  
  node.addEventListener('focus', handleFocus);
  node.addEventListener('blur', handleBlur);
  
  return {
    destroy() {
      if (indicatorElement) indicatorElement.remove();
      node.removeEventListener('focus', handleFocus);
      node.removeEventListener('blur', handleBlur);
    }
  };
};




export const hoverCheck: Action<HTMLElement, ValidationOptions> = (
  node: HTMLElement,
  options: ValidationOptions = {}
) => {
  let timeoutId: number | null = null;
  
  const validate = () => {
    
    const result = validateElementContrast(node, options);

    if (!result.valid) {
      console.warn('Hover contrast issue:', result.errors[0] || 'Unknown error');
    }
  };
  
  const handleMouseEnter = () => {
    timeoutId = window.setTimeout(validate, 100);
  };
  
  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  node.addEventListener('mouseenter', handleMouseEnter);
  node.addEventListener('mouseleave', handleMouseLeave);
  
  return {
    destroy() {
      if (timeoutId) clearTimeout(timeoutId);
      node.removeEventListener('mouseenter', handleMouseEnter);
      node.removeEventListener('mouseleave', handleMouseLeave);
    }
  };
};




export const accessibilityCheck: Action<HTMLElement, {
  contrast?: ContrastActionOptions | false;
  focus?: ValidationOptions | false;
  hover?: ValidationOptions | false;
}> = (node: HTMLElement, options = {}) => {
  const actions: Array<{ destroy?: () => void }> = [];

  if (options.contrast !== false) {
    const result = contrastCheck(node, options.contrast || {});
    if (result) actions.push(result);
  }

  if (options.focus !== false && node.tabIndex >= 0) {
    const result = focusCheck(node, options.focus || {});
    if (result) actions.push(result);
  }

  if (options.hover !== false) {
    const result = hoverCheck(node, options.hover || {});
    if (result) actions.push(result);
  }

  return {
    destroy() {
      actions.forEach(action => action.destroy?.());
    }
  };
};




export const contrastMonitor: Action<HTMLElement, {
  selector?: string;
  options?: ValidationOptions;
  reportInterval?: number;
}> = (node: HTMLElement, params = {}) => {
  const {
    selector = '*',
    options = {},
    reportInterval = 5000
  } = params;
  
  let intervalId: number | null = null;
  let observer: MutationObserver | null = null;
  
  const checkAllElements = () => {
    const elements = node.querySelectorAll(selector);
    const results = new Map<Element, ValidationResult>();
    let passCount = 0;
    let failCount = 0;
    
    elements.forEach(element => {
      if (element instanceof HTMLElement && 
          window.getComputedStyle(element).color !== 'rgba(0, 0, 0, 0)') {
        const result = validateElementContrast(element, options);
        results.set(element, result);
        
        if (result.valid) {
          passCount++;
        } else {
          failCount++;
          const firstError = result.errors[0];
          const errorMsg = typeof firstError === 'string' ? firstError : firstError?.message || 'Unknown error';
          element.setAttribute('data-contrast-error', errorMsg);
        }
      }
    });
    
    
    console.log(`Contrast Check Summary: ${passCount} passed, ${failCount} failed`);
    
    
    node.dispatchEvent(new CustomEvent('contrastReport', {
      detail: { results, passCount, failCount }
    }));
  };
  
  
  checkAllElements();
  
  
  if (reportInterval > 0) {
    intervalId = window.setInterval(checkAllElements, reportInterval);
  }
  
  
  observer = new MutationObserver(() => {
    checkAllElements();
  });
  
  observer.observe(node, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });
  
  return {
    destroy() {
      if (intervalId) clearInterval(intervalId);
      if (observer) observer.disconnect();
      
      
      const elements = node.querySelectorAll('[data-contrast-error]');
      elements.forEach(el => el.removeAttribute('data-contrast-error'));
    }
  };
};
