




export class ColorCache<K, V> {
	private cache = new Map<K, V>();
	private readonly maxSize: number;

	constructor(maxSize = 1000) {
		this.maxSize = maxSize;
	}

	get(key: K): V | undefined {
		const value = this.cache.get(key);
		if (value !== undefined) {
			
			this.cache.delete(key);
			this.cache.set(key, value);
		}
		return value;
	}

	set(key: K, value: V): void {
		if (this.cache.has(key)) {
			this.cache.delete(key);
		} else if (this.cache.size >= this.maxSize) {
			
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







export const parseCache = new ColorCache<string, any>(1000);


export const conversionCache = new ColorCache<string, any>(500);


export const luminanceCache = new ColorCache<string, number>(500);


export const contrastCache = new ColorCache<string, number>(500);





export function clearAllCaches(): void {
	parseCache.clear();
	conversionCache.clear();
	luminanceCache.clear();
	contrastCache.clear();
}




export function getAllCacheStats() {
	return {
		parseCache: parseCache.getStats(),
		conversionCache: conversionCache.getStats(),
		luminanceCache: luminanceCache.getStats(),
		contrastCache: contrastCache.getStats()
	};
}
