import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContrastAnalyzer } from '../../src/engine/ContrastAnalyzer';
import type { ContrastEvaluation } from '../../src/types';

describe('ContrastAnalyzer', () => {
  let analyzer: ContrastAnalyzer;
  let testContainer: HTMLDivElement;

  beforeEach(() => {
    analyzer = new ContrastAnalyzer();

    // Create test container
    testContainer = document.createElement('div');
    testContainer.id = 'test-container';
    document.body.appendChild(testContainer);
  });

  afterEach(() => {
    analyzer.destroy();
    document.body.removeChild(testContainer);
  });

  describe('Color Extraction', () => {
    it('should extract text and background colors correctly', () => {
      const element = document.createElement('p');
      element.style.color = 'rgb(0, 0, 0)';
      element.style.backgroundColor = 'rgb(255, 255, 255)';
      element.textContent = 'Test text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      expect(result?.metadata.foreground).toBe('rgb(0, 0, 0)');
      expect(result?.metadata.background).toBe('rgb(255, 255, 255)');
    });

    it('should handle rgba colors', () => {
      const element = document.createElement('p');
      element.style.color = 'rgba(0, 0, 0, 0.87)';
      element.style.backgroundColor = 'rgba(255, 255, 255, 1)';
      element.textContent = 'Test text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      expect(result?.metadata.foreground).toMatch(/rgba?\(0,\s*0,\s*0/);
    });

    it('should inherit background color from parent', () => {
      testContainer.style.backgroundColor = 'rgb(240, 240, 240)';

      const element = document.createElement('p');
      element.style.color = 'rgb(50, 50, 50)';
      element.textContent = 'Test text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      expect(result?.metadata.background).toBe('rgb(240, 240, 240)');
    });

    it('should skip transparent text', () => {
      const element = document.createElement('p');
      element.style.color = 'transparent';
      element.style.backgroundColor = 'white';
      element.textContent = 'Test text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeNull();
    });
  });

  describe('Contrast Ratio Calculation', () => {
    it('should calculate perfect contrast ratio (21:1)', () => {
      const element = document.createElement('p');
      element.style.color = 'black';
      element.style.backgroundColor = 'white';
      element.textContent = 'Test text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      expect(result?.metadata.ratio).toBeCloseTo(21, 0);
    });

    it('should calculate low contrast ratio', () => {
      const element = document.createElement('p');
      element.style.color = '#777';
      element.style.backgroundColor = '#999';
      element.textContent = 'Test text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      expect(result?.metadata.ratio).toBeLessThan(3);
      expect(result?.severity).toBe('error');
    });

    it('should handle identical colors (1:1 ratio)', () => {
      const element = document.createElement('p');
      element.style.color = '#000';
      element.style.backgroundColor = '#000';
      element.textContent = 'Test text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      expect(result?.metadata.ratio).toBe(1);
      expect(result?.severity).toBe('error');
    });
  });

  describe('Text Size Detection', () => {
    it('should detect normal text size', () => {
      const element = document.createElement('p');
      element.style.fontSize = '16px';
      element.style.color = '#666';
      element.style.backgroundColor = 'white';
      element.textContent = 'Normal text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      expect(result?.metadata.largeText).toBe(false);
      expect(result?.metadata.requiredRatio).toBe(4.5); // AA requirement for normal text
    });

    it('should detect large text by font size', () => {
      const element = document.createElement('p');
      element.style.fontSize = '24px';
      element.style.color = '#666';
      element.style.backgroundColor = 'white';
      element.textContent = 'Large text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      expect(result?.metadata.largeText).toBe(true);
      expect(result?.metadata.requiredRatio).toBe(3); // AA requirement for large text
    });

    it('should detect large text by bold weight', () => {
      const element = document.createElement('p');
      element.style.fontSize = '18px';
      element.style.fontWeight = 'bold';
      element.style.color = '#666';
      element.style.backgroundColor = 'white';
      element.textContent = 'Bold text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      expect(result?.metadata.largeText).toBe(true);
    });

    it('should handle different font size units', () => {
      const element = document.createElement('p');
      element.style.fontSize = '1.5rem'; // Assuming 1rem = 16px, this is 24px
      element.style.color = '#666';
      element.style.backgroundColor = 'white';
      element.textContent = 'Large text';

      // Mock computed style to return px value
      const originalGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = ((elem: Element) => {
        const styles = originalGetComputedStyle(elem);
        if (elem === element) {
          return {
            ...styles,
            fontSize: '24px'
          };
        }
        return styles;
      }) as any;

      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      expect(result?.metadata.largeText).toBe(true);

      // Restore
      window.getComputedStyle = originalGetComputedStyle;
    });
  });

  describe('WCAG Compliance', () => {
    it('should pass WCAG AA for normal text with 4.5:1 ratio', () => {
      const element = document.createElement('p');
      element.style.fontSize = '16px';
      element.style.color = '#595959'; // ~4.5:1 against white
      element.style.backgroundColor = 'white';
      element.textContent = 'AA compliant text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      expect(result?.severity).toBe('info');
      expect(result?.message).toContain('contrast ratio');
    });

    it('should fail WCAG AA for normal text with low ratio', () => {
      const element = document.createElement('p');
      element.style.fontSize = '16px';
      element.style.color = '#999'; // ~2.8:1 against white
      element.style.backgroundColor = 'white';
      element.textContent = 'Low contrast text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      expect(result?.severity).toBe('error');
      expect(result?.wcagLevel).toBe('A');
      expect(result?.message).toContain('Insufficient contrast');
    });

    it('should pass WCAG AA for large text with 3:1 ratio', () => {
      const element = document.createElement('h1');
      element.style.fontSize = '32px';
      element.style.color = '#767676'; // ~3:1 against white
      element.style.backgroundColor = 'white';
      element.textContent = 'Large heading';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      expect(result?.severity).toBe('info');
    });

    it('should warn for borderline contrast', () => {
      const element = document.createElement('p');
      element.style.fontSize = '16px';
      element.style.color = '#737373'; // ~3.5:1 against white (between 3:1 and 4.5:1)
      element.style.backgroundColor = 'white';
      element.textContent = 'Borderline contrast';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      expect(result?.severity).toBe('warning');
      expect(result?.wcagLevel).toBe('AA');
    });
  });

  describe('Element Selector Generation', () => {
    it('should generate selector for element with ID', () => {
      const element = document.createElement('p');
      element.id = 'unique-paragraph';
      element.style.color = '#999';
      element.style.backgroundColor = 'white';
      element.textContent = 'Test';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      expect(result?.selector).toBe('#unique-paragraph');
    });

    it('should generate selector for element with classes', () => {
      const element = document.createElement('p');
      element.className = 'text-primary large-text';
      element.style.color = '#999';
      element.style.backgroundColor = 'white';
      element.textContent = 'Test';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      expect(result?.selector).toBe('p.text-primary.large-text');
    });

    it('should generate selector with nth-child for repeated elements', () => {
      // Add multiple paragraphs
      for (let i = 0; i < 3; i++) {
        const p = document.createElement('p');
        p.style.color = '#999';
        p.style.backgroundColor = 'white';
        p.textContent = `Paragraph ${i + 1}`;
        testContainer.appendChild(p);
      }

      const secondParagraph = testContainer.querySelectorAll('p')[1];
      const result = analyzer.analyzeElement(secondParagraph);

      expect(result).toBeTruthy();
      expect(result?.selector).toContain(':nth-child(2)');
    });
  });

  describe('Cache Management', () => {
    it('should cache contrast calculations', () => {
      const element = document.createElement('p');
      element.style.color = 'black';
      element.style.backgroundColor = 'white';
      element.textContent = 'Cached test';
      testContainer.appendChild(element);

      // First analysis
      const result1 = analyzer.analyzeElement(element);

      // Second analysis should use cache
      const result2 = analyzer.analyzeElement(element);

      expect(result1).toEqual(result2);
      expect(result1?.id).toBe(result2?.id); // Same result object
    });

    it('should clear cache on destroy', () => {
      const element = document.createElement('p');
      element.style.color = 'black';
      element.style.backgroundColor = 'white';
      element.textContent = 'Test';
      testContainer.appendChild(element);

      // Analyze and cache
      analyzer.analyzeElement(element);

      // Destroy and create new analyzer
      analyzer.destroy();
      analyzer = new ContrastAnalyzer();

      // Should create new result
      const result = analyzer.analyzeElement(element);
      expect(result).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle null elements gracefully', () => {
      expect(() => analyzer.analyzeElement(null as any)).not.toThrow();
      expect(analyzer.analyzeElement(null as any)).toBeNull();
    });

    it('should handle elements without computed styles', () => {
      const element = document.createElement('p');
      element.textContent = 'Test';
      // Not appended to DOM, so no computed styles

      const result = analyzer.analyzeElement(element);
      expect(result).toBeNull();
    });

    it('should handle malformed color values', () => {
      const element = document.createElement('p');
      element.style.color = 'invalid-color';
      element.style.backgroundColor = 'white';
      element.textContent = 'Test';
      testContainer.appendChild(element);

      // Browser will convert invalid color to default or computed value
      const result = analyzer.analyzeElement(element);

      // Should either handle gracefully or use computed value
      if (result) {
        expect(result.metadata.foreground).toBeTruthy();
      }
    });
  });

  describe('Real-world Scenarios', () => {
    it('should analyze button with hover state', () => {
      const button = document.createElement('button');
      button.className = 'btn btn-primary';
      button.style.color = '#fff';
      button.style.backgroundColor = '#007bff';
      button.textContent = 'Submit';
      testContainer.appendChild(button);

      const result = analyzer.analyzeElement(button);

      expect(result).toBeTruthy();
      if (result) {
        expect(result.metadata.ratio).toBeGreaterThan(3); // Should pass for large text
      }
    });

    it('should analyze link in paragraph', () => {
      const paragraph = document.createElement('p');
      paragraph.style.color = '#333';
      paragraph.style.backgroundColor = 'white';

      const link = document.createElement('a');
      link.href = '#';
      link.style.color = '#0066cc';
      link.textContent = 'Click here';

      paragraph.appendChild(document.createTextNode('Please '));
      paragraph.appendChild(link);
      paragraph.appendChild(document.createTextNode(' for more info.'));

      testContainer.appendChild(paragraph);

      const result = analyzer.analyzeElement(link);

      expect(result).toBeTruthy();
      expect(result?.metadata.background).toBe('rgb(255, 255, 255)'); // Inherited
    });

    it('should analyze text with gradient background', () => {
      const element = document.createElement('div');
      element.style.color = 'white';
      element.style.backgroundImage = 'linear-gradient(to right, #000, #333)';
      element.style.padding = '20px';
      element.textContent = 'Gradient text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      // Should handle gradient by using computed backgroundColor or skip
      expect(result).toBeDefined();
    });
  });
});
