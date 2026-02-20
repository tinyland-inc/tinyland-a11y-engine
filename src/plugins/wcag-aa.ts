/**
 * WCAG 2.1 Level AA Compliance Plugin
 */

import type { EvaluationPlugin, EvaluationRule, EvaluationContext } from '../types';

const plugin: EvaluationPlugin = {
  id: 'wcag-aa',
  name: 'WCAG 2.1 Level AA',
  version: '1.0.0',
  rules: [
    {
      id: 'wcag-aa-img-alt',
      name: 'Images must have alt text',
      description: 'All images must have alternative text for screen readers',
      category: 'Images',
      severity: 'error',
      wcagCriteria: ['1.1.1'],
      selector: 'img',
      evaluate: async (element: Element) => {
        const img = element as HTMLImageElement;
        const alt = img.getAttribute('alt');
        
        if (alt === null) {
          return {
            severity: 'error',
            message: 'Image missing alt attribute',
            category: 'Images',
            wcagCriteria: ['1.1.1'],
            details: {
              src: img.src
            }
          };
        }
        
        if (alt.trim() === '' && !img.getAttribute('role')?.includes('presentation')) {
          return {
            severity: 'warning',
            message: 'Image has empty alt text',
            category: 'Images',
            wcagCriteria: ['1.1.1'],
            details: {
              src: img.src
            }
          };
        }
        
        return null;
      }
    },
    
    {
      id: 'wcag-aa-link-text',
      name: 'Links must have discernible text',
      description: 'All links must have text that describes their purpose',
      category: 'Links',
      severity: 'error',
      wcagCriteria: ['2.4.4'],
      selector: 'a[href]',
      evaluate: async (element: Element) => {
        const link = element as HTMLAnchorElement;
        const text = link.textContent?.trim() || '';
        const ariaLabel = link.getAttribute('aria-label');
        const ariaLabelledby = link.getAttribute('aria-labelledby');
        
        if (!text && !ariaLabel && !ariaLabelledby) {
          return {
            severity: 'error',
            message: 'Link has no discernible text',
            category: 'Links',
            wcagCriteria: ['2.4.4'],
            details: {
              href: link.href
            }
          };
        }
        
        if (text && /^(click here|read more|more|link)$/i.test(text)) {
          return {
            severity: 'warning',
            message: 'Link text is not descriptive',
            category: 'Links',
            wcagCriteria: ['2.4.4'],
            details: {
              text,
              href: link.href
            }
          };
        }
        
        return null;
      }
    },
    
    {
      id: 'wcag-aa-form-labels',
      name: 'Form inputs must have labels',
      description: 'All form inputs must have associated labels',
      category: 'Forms',
      severity: 'error',
      wcagCriteria: ['1.3.1', '3.3.2'],
      selector: 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea',
      evaluate: async (element: Element) => {
        const input = element as HTMLInputElement;
        const id = input.id;
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledby = input.getAttribute('aria-labelledby');
        const title = input.getAttribute('title');
        
        // Check for associated label
        let hasLabel = false;
        if (id) {
          hasLabel = !!document.querySelector(`label[for="${id}"]`);
        }
        
        // Check if input is wrapped in label
        if (!hasLabel) {
          hasLabel = !!input.closest('label');
        }
        
        if (!hasLabel && !ariaLabel && !ariaLabelledby && !title) {
          return {
            severity: 'error',
            message: 'Form input missing label',
            category: 'Forms',
            wcagCriteria: ['1.3.1', '3.3.2'],
            details: {
              type: input.type,
              name: input.name
            }
          };
        }
        
        return null;
      }
    },
    
    {
      id: 'wcag-aa-heading-order',
      name: 'Headings must be in sequential order',
      description: 'Heading levels should not skip (e.g., h1 to h3)',
      category: 'Structure',
      severity: 'warning',
      wcagCriteria: ['1.3.1'],
      selector: 'h1, h2, h3, h4, h5, h6',
      evaluate: async (element: Element, context: EvaluationContext) => {
        const heading = element as HTMLHeadingElement;
        const level = parseInt(heading.tagName.charAt(1));
        
        // Find previous heading
        const allHeadings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const currentIndex = allHeadings.indexOf(heading);
        
        if (currentIndex > 0) {
          const prevHeading = allHeadings[currentIndex - 1];
          const prevLevel = parseInt(prevHeading.tagName.charAt(1));
          
          if (level > prevLevel + 1) {
            return {
              severity: 'warning',
              message: `Heading level skipped from h${prevLevel} to h${level}`,
              category: 'Structure',
              wcagCriteria: ['1.3.1'],
              details: {
                currentLevel: level,
                previousLevel: prevLevel
              }
            };
          }
        }
        
        return null;
      }
    },
    
    {
      id: 'wcag-aa-button-name',
      name: 'Buttons must have accessible names',
      description: 'All buttons must have text or aria-label',
      category: 'Interactive',
      severity: 'error',
      wcagCriteria: ['4.1.2'],
      selector: 'button, [role="button"]',
      evaluate: async (element: Element) => {
        const button = element as HTMLButtonElement;
        const text = button.textContent?.trim() || '';
        const ariaLabel = button.getAttribute('aria-label');
        const ariaLabelledby = button.getAttribute('aria-labelledby');
        const title = button.getAttribute('title');
        
        // Check for icon buttons with SVG
        const hasSvgIcon = button.querySelector('svg');
        
        if (!text && !ariaLabel && !ariaLabelledby && !title) {
          return {
            severity: 'error',
            message: hasSvgIcon 
              ? 'Icon button missing accessible name' 
              : 'Button missing accessible name',
            category: 'Interactive',
            wcagCriteria: ['4.1.2'],
            details: {
              hasIcon: hasSvgIcon !== null
            }
          };
        }
        
        return null;
      }
    },
    
    {
      id: 'wcag-aa-lang-attr',
      name: 'Page must have lang attribute',
      description: 'HTML element must have a valid lang attribute',
      category: 'Page',
      severity: 'error',
      wcagCriteria: ['3.1.1'],
      selector: 'html',
      evaluate: async (element: Element) => {
        const html = element as HTMLHtmlElement;
        const lang = html.getAttribute('lang');
        
        if (!lang) {
          return {
            severity: 'error',
            message: 'Page missing lang attribute',
            category: 'Page',
            wcagCriteria: ['3.1.1']
          };
        }
        
        // Basic validation of lang code
        if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(lang)) {
          return {
            severity: 'warning',
            message: 'Page lang attribute may be invalid',
            category: 'Page',
            wcagCriteria: ['3.1.1'],
            details: {
              lang
            }
          };
        }
        
        return null;
      }
    }
  ]
};

export default plugin;