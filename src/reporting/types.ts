/**
 * Types for accessibility reporting
 * These are duplicated from tests/accessibility/config.ts to avoid cross-boundary imports
 */

import type { AxeResults } from 'axe-core';

// Available themes to test
export const THEMES = [
  'stonewall',
  'gold-nouveau',
  'modern-navy',
  'rocket',
  'skeleton',
  'crimson',
  'hamlindigo',
  'sahara',
  'seafoam',
  'vintage',
  'wintry'
] as const;

export type Theme = typeof THEMES[number];

// Routes to test for accessibility
export const ROUTES = [
  '/',
  '/about',
  '/contact',
  '/accessibility',
  '/posts',
  '/resources',
  '/members',
  '/events',
  '/calendar',
  '/profile',
  '/blog/welcome-to-stonewall-underground',
  '/blog/supporting-trans-youth',
  '/admin/login',
  '/admin/dashboard',
  '/admin/posts',
  '/admin/events',
  '/admin/files'
] as const;

export type Route = typeof ROUTES[number];

// Helper type for test results
export interface AccessibilityTestResult {
  theme: Theme;
  route: Route;
  axeResults: AxeResults;
  contrastResults: ContrastTestResult[];
  visualResults?: VisualTestResult;
  timestamp: Date;
  duration: number;
}

export interface ContrastTestResult {
  selector: string;
  foreground: string;
  background: string;
  ratio: number;
  fontSize: string;
  fontWeight: string;
  isLargeText: boolean;
  meetsAA: boolean;
  meetsAAA: boolean;
  element: string;
}

export interface VisualTestResult {
  baselineImage: string;
  currentImage: string;
  diffImage?: string;
  diffPixels: number;
  diffPercentage: number;
  passed: boolean;
}
