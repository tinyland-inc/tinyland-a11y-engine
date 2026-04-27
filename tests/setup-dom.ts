/**
 * Package-local Vitest DOM setup for Bazel and standalone execution.
 */
import { Window } from 'happy-dom';

const window = new Window({ url: 'http://localhost' });
const document = window.document;

const domGlobals: Record<string, unknown> = {
  window,
  document,
};

Object.defineProperty(globalThis, 'navigator', {
  value: window.navigator,
  writable: true,
  configurable: true,
});

const domElements: Record<string, unknown> = {
  HTMLElement: window.HTMLElement,
  HTMLDivElement: window.HTMLDivElement,
  HTMLButtonElement: window.HTMLButtonElement,
  HTMLInputElement: window.HTMLInputElement,
  HTMLAnchorElement: window.HTMLAnchorElement,
  HTMLFormElement: window.HTMLFormElement,
  HTMLImageElement: window.HTMLImageElement,
  SVGElement: window.SVGElement,
  Element: window.Element,
  Node: window.Node,
  Event: window.Event,
  CustomEvent: window.CustomEvent,
  MouseEvent: window.MouseEvent,
  KeyboardEvent: window.KeyboardEvent,
  MutationObserver: window.MutationObserver,
  IntersectionObserver: window.IntersectionObserver,
  localStorage: window.localStorage,
  sessionStorage: window.sessionStorage,
  getComputedStyle: window.getComputedStyle.bind(window),
  matchMedia: window.matchMedia.bind(window),
  DeviceMotionEvent:
    window.DeviceMotionEvent ??
    class DeviceMotionEvent extends Event {
      acceleration = null;
      accelerationIncludingGravity = null;
      rotationRate = null;
      interval = 0;

      constructor(type: string, init?: DeviceMotionEventInit) {
        super(type, init);
        Object.assign(this, init);
      }
    },
  DeviceOrientationEvent:
    window.DeviceOrientationEvent ??
    class DeviceOrientationEvent extends Event {
      alpha = null;
      beta = null;
      gamma = null;
      absolute = false;

      constructor(type: string, init?: DeviceOrientationEventInit) {
        super(type, init);
        Object.assign(this, init);
      }
    },
  URL: window.URL,
  URLSearchParams: window.URLSearchParams,
  DOMParser: window.DOMParser,
  XMLSerializer: window.XMLSerializer,
  WheelEvent:
    window.WheelEvent ??
    class WheelEvent extends Event {
      deltaX = 0;
      deltaY = 0;
      deltaZ = 0;
      deltaMode = 0;

      constructor(type: string, init?: WheelEventInit) {
        super(type, init);
        Object.assign(this, init);
      }
    },
  TouchEvent:
    window.TouchEvent ??
    class TouchEvent extends Event {
      touches: Touch[] = [];
      changedTouches: Touch[] = [];
      targetTouches: Touch[] = [];

      constructor(type: string, init?: TouchEventInit) {
        super(type, init);
        Object.assign(this, init);
      }
    },
  ResizeObserver:
    window.ResizeObserver ??
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}

      constructor(_cb: ResizeObserverCallback) {}
    },
};

Object.assign(globalThis, domGlobals, domElements);

Object.defineProperty(globalThis, 'requestAnimationFrame', {
  get() {
    return window.requestAnimationFrame;
  },
  set(value) {
    window.requestAnimationFrame = value;
  },
  configurable: true,
});

Object.defineProperty(globalThis, 'cancelAnimationFrame', {
  get() {
    return window.cancelAnimationFrame;
  },
  set(value) {
    window.cancelAnimationFrame = value;
  },
  configurable: true,
});
