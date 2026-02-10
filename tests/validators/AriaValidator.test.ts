import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AriaValidator } from '../../src/validators/AriaValidator';
import type { EvaluationResult } from '../../src/types';

describe('AriaValidator', () => {
  let validator: AriaValidator;
  let testContainer: HTMLDivElement;

  beforeEach(() => {
    validator = new AriaValidator();
    testContainer = document.createElement('div');
    testContainer.id = 'test-container';
    document.body.appendChild(testContainer);
  });

  afterEach(() => {
    document.body.removeChild(testContainer);
  });

  describe('ARIA Labels and Descriptions', () => {
    it('should validate aria-label on interactive elements', () => {
      testContainer.innerHTML = `
        <button aria-label="Save document">&#x1F4BE;</button>
        <button>No label</button>
        <input type="text" aria-label="Enter your name" />
        <div role="button" aria-label="Custom button">Click me</div>
      `;

      const results = validator.validate(testContainer);

      // Button without text or aria-label should error
      expect(results.some(r =>
        r.selector.includes('button') &&
        r.message.includes('No label') &&
        r.severity === 'error'
      )).toBe(true);
    });

    it('should validate aria-labelledby references', () => {
      testContainer.innerHTML = `
        <h2 id="dialog-title">Settings</h2>
        <div role="dialog" aria-labelledby="dialog-title">Dialog content</div>
        <input aria-labelledby="missing-label" />
        <span id="field-label">Email</span>
        <input aria-labelledby="field-label" type="email" />
      `;

      const results = validator.validate(testContainer);

      // Should error on missing reference
      expect(results.some(r =>
        r.message.includes('missing-label') &&
        r.message.includes('does not exist') &&
        r.severity === 'error'
      )).toBe(true);

      // Should not error on valid reference
      const validReferenceErrors = results.filter(r =>
        r.message.includes('field-label') &&
        r.severity === 'error'
      );
      expect(validReferenceErrors).toHaveLength(0);
    });

    it('should validate aria-describedby references', () => {
      testContainer.innerHTML = `
        <input type="password" aria-describedby="password-help" />
        <span id="password-help">Must be at least 8 characters</span>

        <button aria-describedby="non-existent">Action</button>
      `;

      const results = validator.validate(testContainer);

      expect(results.some(r =>
        r.message.includes('non-existent') &&
        r.message.includes('does not exist') &&
        r.severity === 'error'
      )).toBe(true);
    });

    it('should handle multiple ID references', () => {
      testContainer.innerHTML = `
        <span id="label1">First Name</span>
        <span id="label2">(Required)</span>
        <input aria-labelledby="label1 label2" />

        <input aria-labelledby="label1 missing-id label2" />
      `;

      const results = validator.validate(testContainer);

      // Should error on partially missing references
      expect(results.some(r =>
        r.message.includes('missing-id') &&
        r.severity === 'error'
      )).toBe(true);
    });
  });

  describe('ARIA Roles', () => {
    it('should validate valid ARIA roles', () => {
      testContainer.innerHTML = `
        <div role="button">Valid button</div>
        <div role="invalid-role">Invalid role</div>
        <nav role="navigation">Redundant but valid</nav>
        <div role="presentation">Presentational</div>
      `;

      const results = validator.validate(testContainer);

      expect(results.some(r =>
        r.message.includes('invalid-role') &&
        r.message.includes('not a valid ARIA role') &&
        r.severity === 'error'
      )).toBe(true);
    });

    it('should check required attributes for roles', () => {
      testContainer.innerHTML = `
        <div role="checkbox">Missing aria-checked</div>
        <div role="checkbox" aria-checked="false">Valid checkbox</div>

        <div role="slider">Missing value attributes</div>
        <div role="slider" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100">Valid slider</div>
      `;

      const results = validator.validate(testContainer);

      // Checkbox without aria-checked
      expect(results.some(r =>
        r.message.includes('checkbox') &&
        r.message.includes('aria-checked') &&
        r.severity === 'error'
      )).toBe(true);

      // Slider without value attributes
      expect(results.some(r =>
        r.message.includes('slider') &&
        r.message.includes('aria-valuenow') &&
        r.severity === 'error'
      )).toBe(true);
    });

    it('should validate role nesting rules', () => {
      testContainer.innerHTML = `
        <div role="list">
          <div role="listitem">Valid item</div>
          <div role="button">Invalid child</div>
        </div>

        <div role="menu">
          <div role="menuitem">Valid menu item</div>
          <div role="listitem">Wrong item type</div>
        </div>
      `;

      const results = validator.validate(testContainer);

      // Button inside list
      expect(results.some(r =>
        r.message.includes('button') &&
        r.message.includes('not allowed inside') &&
        r.message.includes('list')
      )).toBe(true);

      // Listitem inside menu
      expect(results.some(r =>
        r.message.includes('listitem') &&
        r.message.includes('not allowed inside') &&
        r.message.includes('menu')
      )).toBe(true);
    });
  });

  describe('ARIA States and Properties', () => {
    it('should validate aria-expanded on collapsible elements', () => {
      testContainer.innerHTML = `
        <button aria-expanded="true">Expanded</button>
        <button aria-expanded="false">Collapsed</button>
        <button aria-expanded="invalid">Invalid value</button>
        <button aria-haspopup="true">Missing expanded</button>
      `;

      const results = validator.validate(testContainer);

      // Invalid value for aria-expanded
      expect(results.some(r =>
        r.message.includes('aria-expanded') &&
        r.message.includes('invalid') &&
        r.severity === 'error'
      )).toBe(true);

      // Element with popup but no expanded state
      expect(results.some(r =>
        r.message.includes('aria-haspopup') &&
        r.message.includes('aria-expanded') &&
        r.severity === 'warning'
      )).toBe(true);
    });

    it('should validate aria-hidden usage', () => {
      testContainer.innerHTML = `
        <div aria-hidden="true">
          <button>Interactive element inside hidden container</button>
        </div>

        <button aria-hidden="true">Hidden interactive element</button>

        <div aria-hidden="false">Visible content</div>
      `;

      const results = validator.validate(testContainer);

      // Interactive elements inside aria-hidden
      expect(results.some(r =>
        r.message.includes('Interactive element') &&
        r.message.includes('aria-hidden') &&
        r.severity === 'error'
      )).toBe(true);

      // aria-hidden on interactive element
      expect(results.some(r =>
        r.selector.includes('button[aria-hidden="true"]') &&
        r.severity === 'error'
      )).toBe(true);
    });

    it('should validate aria-live regions', () => {
      testContainer.innerHTML = `
        <div aria-live="polite">Status updates</div>
        <div aria-live="assertive">Important alerts</div>
        <div aria-live="off">Silent region</div>
        <div aria-live="invalid">Invalid value</div>

        <div role="alert">Implicit assertive</div>
        <div role="status">Implicit polite</div>
      `;

      const results = validator.validate(testContainer);

      // Invalid aria-live value
      expect(results.some(r =>
        r.message.includes('aria-live') &&
        r.message.includes('invalid') &&
        r.severity === 'error'
      )).toBe(true);
    });
  });

  describe('Landmark Roles', () => {
    it('should check for proper landmark structure', () => {
      testContainer.innerHTML = `
        <header role="banner">Header</header>
        <nav role="navigation">Nav</nav>
        <main role="main">
          <section role="region" aria-labelledby="section-title">
            <h2 id="section-title">Section</h2>
          </section>
          <section role="region">Unlabeled region</section>
        </main>
        <footer role="contentinfo">Footer</footer>
      `;

      const results = validator.validate(testContainer);

      // Region without label
      expect(results.some(r =>
        r.message.includes('region') &&
        r.message.includes('label') &&
        r.severity === 'warning'
      )).toBe(true);
    });

    it('should detect duplicate landmarks', () => {
      testContainer.innerHTML = `
        <nav aria-label="Main">Main nav</nav>
        <nav aria-label="Secondary">Secondary nav</nav>
        <nav>Unlabeled nav</nav>
        <nav>Another unlabeled nav</nav>
      `;

      const results = validator.validate(testContainer);

      // Multiple unlabeled navigation landmarks
      expect(results.some(r =>
        r.message.includes('Multiple') &&
        r.message.includes('navigation') &&
        r.message.includes('landmarks') &&
        r.severity === 'warning'
      )).toBe(true);
    });
  });

  describe('Form Controls', () => {
    it('should validate form control ARIA attributes', () => {
      testContainer.innerHTML = `
        <input type="email" aria-required="true" />
        <input type="text" aria-invalid="true" aria-describedby="error-msg" />
        <span id="error-msg">Please enter a valid value</span>

        <input type="text" aria-invalid="spelling" />
        <input type="text" aria-invalid="invalid-value" />
      `;

      const results = validator.validate(testContainer);

      // Invalid aria-invalid value
      expect(results.some(r =>
        r.message.includes('aria-invalid') &&
        r.message.includes('invalid-value') &&
        r.severity === 'error'
      )).toBe(true);
    });

    it('should check for proper error messaging', () => {
      testContainer.innerHTML = `
        <input type="text" aria-invalid="true" />
        <input type="text" aria-invalid="true" aria-errormessage="error1" />
        <span id="error1" role="alert">Error message</span>
      `;

      const results = validator.validate(testContainer);

      // aria-invalid without error message
      expect(results.some(r =>
        r.message.includes('aria-invalid') &&
        r.message.includes('error message') &&
        r.severity === 'warning'
      )).toBe(true);
    });
  });

  describe('Complex Widgets', () => {
    it('should validate tablist pattern', () => {
      testContainer.innerHTML = `
        <div role="tablist">
          <button role="tab" aria-selected="true" aria-controls="panel1">Tab 1</button>
          <button role="tab" aria-selected="false" aria-controls="panel2">Tab 2</button>
          <button role="tab">Tab without controls</button>
        </div>
        <div role="tabpanel" id="panel1">Panel 1</div>
        <div role="tabpanel" id="panel2" aria-hidden="true">Panel 2</div>
      `;

      const results = validator.validate(testContainer);

      // Tab without aria-controls
      expect(results.some(r =>
        r.message.includes('tab') &&
        r.message.includes('aria-controls') &&
        r.severity === 'error'
      )).toBe(true);

      // Tab without aria-selected
      expect(results.some(r =>
        r.message.includes('tab') &&
        r.message.includes('aria-selected') &&
        r.severity === 'error'
      )).toBe(true);
    });

    it('should validate combobox pattern', () => {
      testContainer.innerHTML = `
        <input role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="listbox1" />
        <ul role="listbox" id="listbox1">
          <li role="option">Option 1</li>
          <li role="option" aria-selected="true">Option 2</li>
        </ul>

        <input role="combobox" />
      `;

      const results = validator.validate(testContainer);

      // Combobox without required attributes
      expect(results.some(r =>
        r.message.includes('combobox') &&
        r.message.includes('aria-expanded') &&
        r.severity === 'error'
      )).toBe(true);
    });
  });

  describe('Best Practices', () => {
    it('should warn about redundant ARIA', () => {
      testContainer.innerHTML = `
        <button role="button">Redundant role</button>
        <nav role="navigation">Redundant role</nav>
        <main role="main">Redundant role</main>
        <img src="test.jpg" role="img" alt="Test" />
      `;

      const results = validator.validate(testContainer);

      // Redundant role warnings
      const redundantWarnings = results.filter(r =>
        r.message.includes('redundant') &&
        r.severity === 'warning'
      );

      expect(redundantWarnings.length).toBeGreaterThan(0);
    });

    it('should check for ARIA on non-semantic elements', () => {
      testContainer.innerHTML = `
        <div onclick="handleClick()">Clickable div without role</div>
        <span tabindex="0">Focusable span without role</span>
        <div role="button" tabindex="0" onclick="handleClick()">Proper ARIA button</div>
      `;

      const results = validator.validate(testContainer);

      // Interactive div without role
      expect(results.some(r =>
        r.message.includes('interactive') &&
        r.message.includes('semantic') &&
        r.severity === 'warning'
      )).toBe(true);

      // Focusable element without role
      expect(results.some(r =>
        r.message.includes('focusable') &&
        r.message.includes('role') &&
        r.severity === 'warning'
      )).toBe(true);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should validate modal dialog pattern', () => {
      testContainer.innerHTML = `
        <div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <h2 id="dialog-title">Confirm Action</h2>
          <p id="dialog-desc">Are you sure you want to proceed?</p>
          <button>Cancel</button>
          <button>Confirm</button>
        </div>
      `;

      const results = validator.validate(testContainer);

      // Check if aria-describedby is recommended
      expect(results.some(r =>
        r.message.includes('aria-describedby') &&
        r.severity === 'info'
      )).toBe(true);
    });

    it('should validate navigation menu with dropdowns', () => {
      testContainer.innerHTML = `
        <nav>
          <ul role="menubar">
            <li role="none">
              <button role="menuitem" aria-haspopup="true" aria-expanded="false">File</button>
              <ul role="menu" aria-hidden="true">
                <li role="menuitem">New</li>
                <li role="menuitem">Open</li>
                <li role="separator"></li>
                <li role="menuitem">Exit</li>
              </ul>
            </li>
          </ul>
        </nav>
      `;

      const results = validator.validate(testContainer);
      const severeErrors = results.filter(r => r.severity === 'error');

      // Well-formed menu should have minimal errors
      expect(severeErrors.length).toBe(0);
    });
  });
});
