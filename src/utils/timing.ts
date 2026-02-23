



export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T {
  let timeout: number | null = null;
  let lastArgs: any[] | null = null;
  let lastCallTime = 0;

  const throttled = function(this: any, ...args: any[]) {
    const now = Date.now();
    const remaining = wait - (now - lastCallTime);

    lastArgs = args;

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      lastCallTime = now;
      return func.apply(this, args);
    } else if (!timeout) {
      timeout = window.setTimeout(() => {
        lastCallTime = Date.now();
        timeout = null;
        if (lastArgs) {
          throttled.apply(this, lastArgs);
        }
      }, remaining);
    }
  };

  return throttled as T;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): T {
  let timeout: number | null = null;

  const debounced = function(this: any, ...args: any[]) {
    const later = () => {
      timeout = null;
      if (!immediate) {
        func.apply(this, args);
      }
    };

    const callNow = immediate && !timeout;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = window.setTimeout(later, wait);

    if (callNow) {
      func.apply(this, args);
    }
  };

  return debounced as T;
}
