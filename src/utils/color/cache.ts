/**
 * LRU Cache for expensive color operations
 * Provides performance optimization for repeated color calculations
 */

export class ColorCache<K, V> {
	private cache = new Map<K, V>();
	private readonly maxSize: number;

	constructor(maxSize = 1000) {
		this.maxSize = maxSize;
	}

	get(key: K): V | undefined {
		const value = this.cache.get(key);
		if (value !== undefined) {
			// Move to end (most recently used)
			this.cache.delete(key);
			this.cache.set(key, value);
		}
		return value;
	}

	set(key: K, value: V): void {
		if (this.cache.has(key)) {
			this.cache.delete(key);
		} else if (this.cache.size >= this.maxSize) {
			// Remove oldest (first entry)
			const firstKey = this.cache.keys().next().value as K;
			this.cache.delete(firstKey);
		}
		this.cache.set(key, value);
	}

	has(key: K): boolean {
		return this.cache.has(key);
	}

	clear(): void {
		this.cache.clear();
	}

	get size(): number {
		return this.cache.size;
	}

	/**
	 * Get cache statistics
	 */
	getStats(): {
		size: number;
		maxSize: number;
		utilizationPercent: number;
	} {
		return {
			size: this.cache.size,
			maxSize: this.maxSize,
			utilizationPercent: (this.cache.size / this.maxSize) * 100
		};
	}
}

/**
 * Singleton caches for common operations
 * These are shared across the application for maximum cache efficiency
 */

/** Cache for parsed colors (string → RGB) */
export const parseCache = new ColorCache<string, any>(1000);

/** Cache for color conversions (string → RGB) */
export const conversionCache = new ColorCache<string, any>(500);

/** Cache for luminance calculations (RGB key → luminance) */
export const luminanceCache = new ColorCache<string, number>(500);

/** Cache for contrast ratios (color1|color2 → ratio) */
export const contrastCache = new ColorCache<string, number>(500);

/**
 * Clear all color caches
 * Useful for memory management in long-running tests or when theme changes
 */
export function clearAllCaches(): void {
	parseCache.clear();
	conversionCache.clear();
	luminanceCache.clear();
	contrastCache.clear();
}

/**
 * Get statistics for all caches
 */
export function getAllCacheStats() {
	return {
		parseCache: parseCache.getStats(),
		conversionCache: conversionCache.getStats(),
		luminanceCache: luminanceCache.getStats(),
		contrastCache: contrastCache.getStats()
	};
}
