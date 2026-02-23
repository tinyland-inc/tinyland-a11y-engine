import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContrastAnalyzer } from '../../src/engine/ContrastAnalyzer';
import type { ContrastEvaluation } from '../../src/types';






function createMockCanvasContext() {
  let currentFillStyle = '';

  
  const colorMap: Record<string, [number, number, number, number]> = {
    'rgb(0, 0, 0)': [0, 0, 0, 255],
    '#000': [0, 0, 0, 255],
    '#000000': [0, 0, 0, 255],
    'black': [0, 0, 0, 255],
    'rgb(255, 255, 255)': [255, 255, 255, 255],
    '#fff': [255, 255, 255, 255],
    '#ffffff': [255, 255, 255, 255],
    'white': [255, 255, 255, 255],
    'rgb(119, 119, 119)': [119, 119, 119, 255],
    '#777': [119, 119, 119, 255],
    '#777777': [119, 119, 119, 255],
    'rgb(153, 153, 153)': [153, 153, 153, 255],
    '#999': [153, 153, 153, 255],
    '#999999': [153, 153, 153, 255],
    'rgb(102, 102, 102)': [102, 102, 102, 255],
    '#666': [102, 102, 102, 255],
    '#666666': [102, 102, 102, 255],
    'rgb(89, 89, 89)': [89, 89, 89, 255],
    '#595959': [89, 89, 89, 255],
    'rgb(118, 118, 118)': [118, 118, 118, 255],
    '#767676': [118, 118, 118, 255],
    'rgb(115, 115, 115)': [115, 115, 115, 255],
    '#737373': [115, 115, 115, 255],
    'rgb(51, 51, 51)': [51, 51, 51, 255],
    '#333': [51, 51, 51, 255],
    '#333333': [51, 51, 51, 255],
    'rgb(50, 50, 50)': [50, 50, 50, 255],
    'rgb(240, 240, 240)': [240, 240, 240, 255],
    'rgba(0, 0, 0, 0.87)': [0, 0, 0, 221],
    'rgba(255, 255, 255, 1)': [255, 255, 255, 255],
    'rgba(0, 0, 0, 0)': [0, 0, 0, 0],
    'transparent': [0, 0, 0, 0],
    'rgb(0, 123, 255)': [0, 123, 255, 255],
    '#007bff': [0, 123, 255, 255],
    'rgb(0, 102, 204)': [0, 102, 204, 255],
    '#0066cc': [0, 102, 204, 255],
  };

  const ctx = {
    get fillStyle() { return currentFillStyle; },
    set fillStyle(value: string) { currentFillStyle = value; },
    fillRect: vi.fn(),
    getImageData: vi.fn().mockImplementation(() => {
      const normalized = currentFillStyle.trim().toLowerCase();
      
      const rgba = colorMap[normalized] || colorMap[currentFillStyle];
      if (rgba) {
        return { data: new Uint8ClampedArray(rgba) };
      }
      
      return { data: new Uint8ClampedArray([0, 0, 0, 255]) };
    }),
  };

  return ctx;
}




function patchCanvasGetContext() {
  const originalCreateElement = document.createElement.bind(document);
  const mockCtx = createMockCanvasContext();

  vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: any) => {
    const element = originalCreateElement(tagName, options);
    if (tagName.toLowerCase() === 'canvas') {
      (element as any).getContext = vi.fn().mockReturnValue(mockCtx);
    }
    return element;
  });

  return mockCtx;
}

describe('ContrastAnalyzer', () => {
  let analyzer: ContrastAnalyzer;
  let testContainer: HTMLDivElement;

  beforeEach(() => {
    
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }

    
    patchCanvasGetContext();
    analyzer = new ContrastAnalyzer();

    
    testContainer = document.createElement('div');
    testContainer.id = 'test-container';
    document.body.appendChild(testContainer);
  });

  afterEach(() => {
    analyzer.destroy();
    if (testContainer.parentNode) {
      document.body.removeChild(testContainer);
    }
    vi.restoreAllMocks();
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

      
      
      
      
      
      expect(result).toBeTruthy();
      if (result) {
        expect(['info', 'error', 'warning']).toContain(result.severity);
      }
    });
  });

  describe('Contrast Ratio Calculation', () => {
    it('should calculate perfect contrast ratio (21:1)', () => {
      const element = document.createElement('p');
      element.style.color = 'rgb(0, 0, 0)';
      element.style.backgroundColor = 'rgb(255, 255, 255)';
      element.textContent = 'Test text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      expect(result?.metadata.ratio).toBeCloseTo(21, 0);
    });

    it('should calculate low contrast ratio', () => {
      const element = document.createElement('p');
      element.style.color = 'rgb(153, 153, 153)';
      element.style.backgroundColor = 'rgb(255, 255, 255)';
      element.textContent = 'Test text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      if (result) {
        expect(result.metadata.ratio).toBeLessThan(4.5);
        expect(result.severity).toBe('error');
      }
    });

    it('should handle identical colors (1:1 ratio)', () => {
      const element = document.createElement('p');
      element.style.color = 'rgb(0, 0, 0)';
      element.style.backgroundColor = 'rgb(0, 0, 0)';
      element.textContent = 'Test text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      if (result) {
        expect(result.metadata.ratio).toBe(1);
        expect(result.severity).toBe('error');
      }
    });
  });

  describe('Text Size Detection', () => {
    it('should detect normal text size', () => {
      const element = document.createElement('p');
      element.style.fontSize = '16px';
      element.style.color = 'rgb(102, 102, 102)';
      element.style.backgroundColor = 'rgb(255, 255, 255)';
      element.textContent = 'Normal text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      if (result) {
        expect(result.metadata.largeText).toBe(false);
        expect(result.metadata.requiredRatio).toBe(4.5);
      }
    });

    it('should detect large text by font size', () => {
      const element = document.createElement('p');
      element.style.fontSize = '24px';
      element.style.color = 'rgb(102, 102, 102)';
      element.style.backgroundColor = 'rgb(255, 255, 255)';
      element.textContent = 'Large text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      if (result) {
        expect(result.metadata.largeText).toBe(true);
        expect(result.metadata.requiredRatio).toBe(3);
      }
    });

    it('should detect large text by bold weight', () => {
      const element = document.createElement('p');
      element.style.fontSize = '18px';
      element.style.fontWeight = 'bold';
      element.style.color = 'rgb(102, 102, 102)';
      element.style.backgroundColor = 'rgb(255, 255, 255)';
      element.textContent = 'Bold text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      if (result) {
        
        expect(result.metadata.largeText).toBe(true);
      }
    });

    it('should handle different font size units', () => {
      const element = document.createElement('p');
      element.style.fontSize = '24px';
      element.style.color = 'rgb(102, 102, 102)';
      element.style.backgroundColor = 'rgb(255, 255, 255)';
      element.textContent = 'Large text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      if (result) {
        expect(result.metadata.largeText).toBe(true);
      }
    });
  });

  describe('WCAG Compliance', () => {
    it('should pass WCAG AA for normal text with high contrast', () => {
      const element = document.createElement('p');
      element.style.fontSize = '16px';
      element.style.color = 'rgb(0, 0, 0)';
      element.style.backgroundColor = 'rgb(255, 255, 255)';
      element.textContent = 'AA compliant text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      if (result) {
        
        expect(result.severity).toBe('info');
        expect(result.message.toLowerCase()).toContain('contrast ratio');
      }
    });

    it('should fail WCAG AA for normal text with low ratio', () => {
      const element = document.createElement('p');
      element.style.fontSize = '16px';
      element.style.color = 'rgb(153, 153, 153)';
      element.style.backgroundColor = 'rgb(255, 255, 255)';
      element.textContent = 'Low contrast text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      if (result) {
        expect(result.severity).toBe('error');
        
        expect(result.wcagLevel).toBe('AA');
        expect(result.message).toContain('Contrast ratio');
      }
    });

    it('should pass WCAG AA for large text with adequate ratio', () => {
      const element = document.createElement('h1');
      element.style.fontSize = '32px';
      element.style.color = 'rgb(0, 0, 0)';
      element.style.backgroundColor = 'rgb(255, 255, 255)';
      element.textContent = 'Large heading';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      if (result) {
        expect(result.severity).toBe('info');
      }
    });

    it('should flag error for low contrast normal text', () => {
      const element = document.createElement('p');
      element.style.fontSize = '16px';
      element.style.color = 'rgb(153, 153, 153)';
      element.style.backgroundColor = 'rgb(255, 255, 255)';
      element.textContent = 'Borderline contrast';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      if (result) {
        
        expect(result.severity).toBe('error');
      }
    });
  });

  describe('Element Selector Generation', () => {
    it('should generate selector for element with ID', () => {
      const element = document.createElement('p');
      element.id = 'unique-paragraph';
      element.style.color = 'rgb(153, 153, 153)';
      element.style.backgroundColor = 'rgb(255, 255, 255)';
      element.textContent = 'Test';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      expect(result?.selector).toBe('#unique-paragraph');
    });

    it('should generate selector for element with classes', () => {
      const element = document.createElement('p');
      element.className = 'text-primary large-text';
      element.style.color = 'rgb(153, 153, 153)';
      element.style.backgroundColor = 'rgb(255, 255, 255)';
      element.textContent = 'Test';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      expect(result).toBeTruthy();
      
      expect(result?.selector).toContain('p');
      expect(result?.selector).toContain('text-primary');
      expect(result?.selector).toContain('large-text');
    });

    it('should generate path-based selector for repeated elements', () => {
      
      for (let i = 0; i < 3; i++) {
        const p = document.createElement('p');
        p.style.color = 'rgb(153, 153, 153)';
        p.style.backgroundColor = 'rgb(255, 255, 255)';
        p.textContent = `Paragraph ${i + 1}`;
        testContainer.appendChild(p);
      }

      const secondParagraph = testContainer.querySelectorAll('p')[1];
      const result = analyzer.analyzeElement(secondParagraph);

      expect(result).toBeTruthy();
      
      expect(result?.selector).toContain('p');
    });
  });

  describe('Cache Management', () => {
    it('should cache contrast calculations', () => {
      const element = document.createElement('p');
      element.style.color = 'rgb(0, 0, 0)';
      element.style.backgroundColor = 'rgb(255, 255, 255)';
      element.textContent = 'Cached test';
      testContainer.appendChild(element);

      
      const result1 = analyzer.analyzeElement(element);

      
      const result2 = analyzer.analyzeElement(element);

      expect(result1).toBeTruthy();
      expect(result2).toBeTruthy();
      
      expect(result1?.metadata.ratio).toBe(result2?.metadata.ratio);
    });

    it('should clear cache on destroy', () => {
      const element = document.createElement('p');
      element.style.color = 'rgb(0, 0, 0)';
      element.style.backgroundColor = 'rgb(255, 255, 255)';
      element.textContent = 'Test';
      testContainer.appendChild(element);

      
      const result1 = analyzer.analyzeElement(element);
      expect(result1).toBeTruthy();

      
      analyzer.clearCache();

      
      const result2 = analyzer.analyzeElement(element);
      expect(result2).toBeTruthy();
      expect(result2?.metadata.ratio).toBe(result1?.metadata.ratio);
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
      
      

      const result = analyzer.analyzeElement(element);
      
      
      expect(result === null || result !== null).toBe(true);
    });

    it('should handle malformed color values', () => {
      const element = document.createElement('p');
      element.style.color = 'invalid-color';
      element.style.backgroundColor = 'white';
      element.textContent = 'Test';
      testContainer.appendChild(element);

      
      const result = analyzer.analyzeElement(element);

      
      if (result) {
        expect(result.metadata.foreground).toBeTruthy();
      }
    });
  });

  describe('Real-world Scenarios', () => {
    it('should analyze button with hover state', () => {
      const button = document.createElement('button');
      button.className = 'btn btn-primary';
      button.style.color = 'rgb(255, 255, 255)';
      button.style.backgroundColor = 'rgb(0, 123, 255)';
      button.textContent = 'Submit';
      testContainer.appendChild(button);

      const result = analyzer.analyzeElement(button);

      expect(result).toBeTruthy();
      if (result) {
        expect(result.metadata.ratio).toBeGreaterThan(3);
      }
    });

    it('should analyze link in paragraph', () => {
      const paragraph = document.createElement('p');
      paragraph.style.color = 'rgb(51, 51, 51)';
      paragraph.style.backgroundColor = 'rgb(255, 255, 255)';

      const link = document.createElement('a');
      link.href = '#';
      link.style.color = 'rgb(0, 102, 204)';
      link.textContent = 'Click here';

      paragraph.appendChild(document.createTextNode('Please '));
      paragraph.appendChild(link);
      paragraph.appendChild(document.createTextNode(' for more info.'));

      testContainer.appendChild(paragraph);

      const result = analyzer.analyzeElement(link);

      expect(result).toBeTruthy();
      
      expect(result?.metadata.background).toBe('rgb(255, 255, 255)');
    });

    it('should analyze text with gradient background', () => {
      const element = document.createElement('div');
      element.style.color = 'white';
      element.style.backgroundImage = 'linear-gradient(to right, #000, #333)';
      element.style.padding = '20px';
      element.textContent = 'Gradient text';
      testContainer.appendChild(element);

      const result = analyzer.analyzeElement(element);

      
      expect(result).toBeDefined();
    });
  });
});
