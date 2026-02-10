import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KeyboardNavigationValidator } from '../../src/validators/KeyboardNavigationValidator';
import type { EvaluationResult } from '../../src/types';

describe('KeyboardNavigationValidator', () => {
  let validator: KeyboardNavigationValidator;
  let testContainer: HTMLDivElement;

  beforeEach(() => {
    validator = new KeyboardNavigationValidator();
    testContainer = document.createElement('div');
    testContainer.id = 'test-container';
    document.body.appendChild(testContainer);
  });

  afterEach(() => {
    document.body.removeChild(testContainer);
  });

  describe('Focusable Elements Detection', () => {
    it('should identify standard focusable elements', () => {
      testContainer.innerHTML = `
        <a href="#">Link</a>
        <button>Button</button>
        <input type="text" />
        <select><option>Option</option></select>
        <textarea></textarea>
        <div tabindex="0">Focusable div</div>
      `;

      const results = validator.validate(testContainer);
      const focusableCount = testContainer.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ).length;

      expect(results.some(r =>
        r.message.includes(`Found ${focusableCount} focusable elements`)
      )).toBe(true);
    });

    it('should ignore elements with tabindex="-1"', () => {
      testContainer.innerHTML = `
        <button>Visible Button</button>
        <button tabindex="-1">Hidden from tab order</button>
        <div tabindex="0">Focusable</div>
        <div tabindex="-1">Not focusable</div>
      `;

      const results = validator.validate(testContainer);
      const focusableElements = testContainer.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      expect(focusableElements.length).toBe(2); // Only button and div with tabindex="0"
    });

    it('should detect disabled form elements', () => {
      testContainer.innerHTML = `
        <input type="text" />
        <input type="text" disabled />
        <button>Active</button>
        <button disabled>Disabled</button>
        <select disabled><option>Option</option></select>
      `;

      const results = validator.validate(testContainer);
      const disabledCount = testContainer.querySelectorAll('[disabled]').length;

      if (disabledCount > 0) {
        expect(results.some(r =>
          r.message.includes('disabled') && r.severity === 'info'
        )).toBe(true);
      }
    });
  });

  describe('Tab Order Issues', () => {
    it('should flag positive tabindex values', () => {
      testContainer.innerHTML = `
        <button tabindex="1">First</button>
        <button tabindex="2">Second</button>
        <button>Normal</button>
        <input tabindex="3" />
      `;

      const results = validator.validate(testContainer);
      const positiveTabindexResults = results.filter(r =>
        r.message.includes('positive tabindex') && r.severity === 'warning'
      );

      expect(positiveTabindexResults).toHaveLength(3); // 3 elements with positive tabindex
      expect(positiveTabindexResults[0].wcagCriteria).toBe('2.4.3');
    });

    it('should accept tabindex="0" and tabindex="-1"', () => {
      testContainer.innerHTML = `
        <div tabindex="0">Focusable in normal order</div>
        <div tabindex="-1">Programmatically focusable only</div>
      `;

      const results = validator.validate(testContainer);
      const tabindexWarnings = results.filter(r =>
        r.message.includes('positive tabindex')
      );

      expect(tabindexWarnings).toHaveLength(0);
    });

    it('should detect non-sequential tab order', () => {
      testContainer.innerHTML = `
        <button tabindex="5">Skip to 5</button>
        <button tabindex="1">First</button>
        <button tabindex="10">Jump to 10</button>
      `;

      const results = validator.validate(testContainer);
      expect(results.some(r =>
        r.message.includes('non-sequential tab order') ||
        r.message.includes('positive tabindex')
      )).toBe(true);
    });
  });

  describe('Focus Indicators', () => {
    it('should detect missing focus outlines', () => {
      // Create style element to remove focus outline
      const style = document.createElement('style');
      style.textContent = `
        .no-focus-outline:focus {
          outline: none !important;
          box-shadow: none !important;
        }
      `;
      document.head.appendChild(style);

      testContainer.innerHTML = `
        <button class="no-focus-outline">No focus indicator</button>
        <button>Normal button</button>
        <a href="#" class="no-focus-outline">Link without focus</a>
      `;

      const results = validator.validate(testContainer);
      const focusIndicatorIssues = results.filter(r =>
        r.message.includes('focus indicator') && r.severity === 'error'
      );

      expect(focusIndicatorIssues.length).toBeGreaterThan(0);
      expect(focusIndicatorIssues[0].wcagCriteria).toBe('2.4.7');

      // Cleanup
      document.head.removeChild(style);
    });

    it('should accept custom focus indicators', () => {
      const style = document.createElement('style');
      style.textContent = `
        .custom-focus:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.5);
        }
      `;
      document.head.appendChild(style);

      testContainer.innerHTML = `
        <button class="custom-focus">Custom focus style</button>
      `;

      const results = validator.validate(testContainer);
      const focusErrors = results.filter(r =>
        r.selector.includes('.custom-focus') &&
        r.message.includes('focus indicator') &&
        r.severity === 'error'
      );

      // Should not error if box-shadow is present
      expect(focusErrors).toHaveLength(0);

      // Cleanup
      document.head.removeChild(style);
    });
  });

  describe('Keyboard Traps', () => {
    it('should detect potential keyboard traps in modals', () => {
      testContainer.innerHTML = `
        <div role="dialog" aria-modal="true">
          <button>Action 1</button>
          <button>Action 2</button>
          <!-- No close button or escape mechanism -->
        </div>
      `;

      const results = validator.validate(testContainer);
      expect(results.some(r =>
        r.message.includes('keyboard trap') &&
        r.severity === 'warning'
      )).toBe(true);
    });

    it('should pass modal with proper escape mechanism', () => {
      testContainer.innerHTML = `
        <div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <h2 id="dialog-title">Modal Title</h2>
          <button>Action</button>
          <button aria-label="Close dialog">&times;</button>
        </div>
      `;

      const results = validator.validate(testContainer);
      const trapWarnings = results.filter(r =>
        r.message.includes('keyboard trap')
      );

      // Should not warn if close button exists
      expect(trapWarnings.length).toBe(0);
    });
  });

  describe('Interactive Elements', () => {
    it('should flag non-semantic clickable elements', () => {
      testContainer.innerHTML = `
        <div onclick="handleClick()">Clickable div</div>
        <span onclick="doSomething()" class="clickable">Clickable span</span>
        <p onclick="action()">Clickable paragraph</p>
      `;

      const results = validator.validate(testContainer);
      const clickableNonInteractive = results.filter(r =>
        r.message.includes('click handler') &&
        r.message.includes('non-interactive') &&
        r.severity === 'error'
      );

      expect(clickableNonInteractive).toHaveLength(3);
      expect(clickableNonInteractive[0].wcagCriteria).toBe('4.1.2');
    });

    it('should accept semantic interactive elements with click handlers', () => {
      testContainer.innerHTML = `
        <button onclick="handleClick()">Button</button>
        <a href="#" onclick="preventDefault(event)">Link</a>
        <input type="button" onclick="submit()" value="Submit" />
      `;

      const results = validator.validate(testContainer);
      const nonSemanticErrors = results.filter(r =>
        r.message.includes('non-interactive element with click handler')
      );

      expect(nonSemanticErrors).toHaveLength(0);
    });

    it('should check for keyboard support on custom controls', () => {
      testContainer.innerHTML = `
        <div role="button" onclick="handleClick()">Custom button without keyboard</div>
        <div role="button" tabindex="0" onclick="handleClick()" onkeydown="handleKey(event)">Proper custom button</div>
      `;

      const results = validator.validate(testContainer);

      // First custom button should error (no tabindex)
      expect(results.some(r =>
        r.selector.includes('Custom button without keyboard') &&
        r.severity === 'error'
      )).toBe(true);

      // Second should pass
      const properButtonErrors = results.filter(r =>
        r.selector.includes('Proper custom button') &&
        r.severity === 'error'
      );
      expect(properButtonErrors).toHaveLength(0);
    });
  });

  describe('Skip Links', () => {
    it('should check for skip navigation links', () => {
      testContainer.innerHTML = `
        <header>
          <nav>
            <a href="#home">Home</a>
            <a href="#about">About</a>
          </nav>
        </header>
        <main id="main">Content</main>
      `;

      const results = validator.validate(testContainer);
      expect(results.some(r =>
        r.message.includes('skip') &&
        r.message.includes('navigation') &&
        r.severity === 'warning'
      )).toBe(true);
    });

    it('should detect existing skip links', () => {
      testContainer.innerHTML = `
        <a href="#main" class="skip-link">Skip to main content</a>
        <header>
          <nav>Navigation</nav>
        </header>
        <main id="main">Content</main>
      `;

      const results = validator.validate(testContainer);
      const skipLinkWarnings = results.filter(r =>
        r.message.includes('No skip navigation link found')
      );

      expect(skipLinkWarnings).toHaveLength(0);
    });
  });

  describe('Form Navigation', () => {
    it('should check form field navigation', () => {
      testContainer.innerHTML = `
        <form>
          <input type="text" placeholder="Name" />
          <input type="email" placeholder="Email" />
          <textarea placeholder="Message"></textarea>
          <button type="submit">Submit</button>
        </form>
      `;

      const results = validator.validate(testContainer);

      // Form fields without labels should be flagged
      expect(results.some(r =>
        r.message.includes('label') &&
        r.severity === 'error'
      )).toBe(true);
    });

    it('should validate proper form structure', () => {
      testContainer.innerHTML = `
        <form>
          <label for="name">Name:</label>
          <input type="text" id="name" />

          <label for="email">Email:</label>
          <input type="email" id="email" />

          <button type="submit">Submit</button>
        </form>
      `;

      const results = validator.validate(testContainer);
      const formErrors = results.filter(r =>
        r.type === 'keyboard' &&
        r.severity === 'error' &&
        r.message.includes('form')
      );

      expect(formErrors).toHaveLength(0);
    });
  });

  describe('Focus Management', () => {
    it('should detect focus order issues with floating elements', () => {
      testContainer.innerHTML = `
        <div style="position: relative;">
          <button>First button</button>
          <div style="position: absolute; top: -50px;">
            <button>Floating button appears first visually</button>
          </div>
          <button>Last button</button>
        </div>
      `;

      const results = validator.validate(testContainer);
      expect(results.some(r =>
        r.message.includes('focus order') ||
        r.message.includes('visual order')
      )).toBe(true);
    });

    it('should check for focus management in dynamic content', () => {
      testContainer.innerHTML = `
        <div role="tablist">
          <button role="tab" aria-selected="true" tabindex="0">Tab 1</button>
          <button role="tab" aria-selected="false" tabindex="-1">Tab 2</button>
          <button role="tab" aria-selected="false" tabindex="-1">Tab 3</button>
        </div>
        <div role="tabpanel">Panel 1</div>
      `;

      const results = validator.validate(testContainer);

      // Should recognize proper ARIA tab pattern
      const tabErrors = results.filter(r =>
        r.selector.includes('[role="tab"]') &&
        r.severity === 'error'
      );

      expect(tabErrors).toHaveLength(0);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should validate navigation menu keyboard support', () => {
      testContainer.innerHTML = `
        <nav>
          <ul>
            <li><a href="/">Home</a></li>
            <li>
              <a href="#" aria-haspopup="true" aria-expanded="false">Products</a>
              <ul class="submenu">
                <li><a href="/products/1">Product 1</a></li>
                <li><a href="/products/2">Product 2</a></li>
              </ul>
            </li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </nav>
      `;

      const results = validator.validate(testContainer);

      // Check for dropdown keyboard support
      expect(results.some(r =>
        r.message.includes('dropdown') ||
        r.message.includes('submenu')
      )).toBe(true);
    });

    it('should validate complex form with fieldsets', () => {
      testContainer.innerHTML = `
        <form>
          <fieldset>
            <legend>Personal Information</legend>
            <label for="fname">First Name:</label>
            <input type="text" id="fname" required />

            <label for="lname">Last Name:</label>
            <input type="text" id="lname" required />
          </fieldset>

          <fieldset>
            <legend>Preferences</legend>
            <input type="checkbox" id="newsletter" />
            <label for="newsletter">Subscribe to newsletter</label>
          </fieldset>

          <button type="submit">Submit</button>
        </form>
      `;

      const results = validator.validate(testContainer);
      const severeErrors = results.filter(r => r.severity === 'error');

      // Well-structured form should have minimal errors
      expect(severeErrors.length).toBe(0);
    });
  });
});
