/**
 * Contrast calculation utilities for accessibility testing
 * Provides WCAG-compliant color contrast calculations
 *
 * NOTE: This is the test-local implementation used by property-based tests.
 * It re-exports from the package's contrast module.
 */

export type { RGB } from '../../src/contrast';
export {
  hexToRgb,
  rgbToHex,
  getRelativeLuminance,
  getContrastRatio,
  checkContrast,
  alphaBlend,
  simulateColorBlindness,
  isLightColor,
} from '../../src/contrast';
