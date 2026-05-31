export interface BrowserA11yRuntimeActions {
	initialize(): Promise<void> | void;
	testConnection(): Promise<boolean> | boolean;
	evaluate(): Promise<void> | void;
	flush(): Promise<void> | void;
	recoverConnection(): Promise<void> | void;
	isCircuitBreakerOpen(): boolean;
}

export interface BrowserA11yRuntimeOptions {
	logPrefix?: string;
	headlessEvaluationIntervalMs?: number;
	flushIntervalMs?: number;
	uiEvaluationIntervalMs?: number;
	circuitBreakerRecoveryIntervalMs?: number;
	healthCheckIntervalMs?: number;
}

const DEFAULT_OPTIONS = {
	logPrefix: '[A11y Monitor]',
	headlessEvaluationIntervalMs: 10_000,
	flushIntervalMs: 30_000,
	uiEvaluationIntervalMs: 5_000,
	circuitBreakerRecoveryIntervalMs: 5 * 60_000,
	healthCheckIntervalMs: 60_000,
} satisfies Required<BrowserA11yRuntimeOptions>;

export function createBrowserA11yRuntime(
	actions: BrowserA11yRuntimeActions,
	options: BrowserA11yRuntimeOptions = {},
) {
	const config = { ...DEFAULT_OPTIONS, ...options };

	return {
		startHeadlessTelemetry() {
			console.info(
				`${config.logPrefix} Starting headless telemetry mode (UI disabled, telemetry active)`,
			);

			void actions.initialize();

			const headlessEvalInterval = setInterval(() => {
				console.debug(`${config.logPrefix} Running headless evaluation`);
				void actions.evaluate();
			}, config.headlessEvaluationIntervalMs);

			const flushInterval = setInterval(() => {
				void actions.flush();
			}, config.flushIntervalMs);

			return () => {
				console.info(`${config.logPrefix} Stopping headless telemetry (cleanup)`);
				clearInterval(headlessEvalInterval);
				clearInterval(flushInterval);
			};
		},

		startAutomaticEvaluation() {
			console.info(
				`${config.logPrefix} Starting automatic evaluation (every ${config.uiEvaluationIntervalMs}ms)`,
			);

			const evalInterval = setInterval(() => {
				console.debug(`${config.logPrefix} Running scheduled evaluation`);
				void actions.evaluate();
			}, config.uiEvaluationIntervalMs);

			return () => {
				console.info(`${config.logPrefix} Stopping automatic evaluation (cleanup)`);
				clearInterval(evalInterval);
			};
		},

		startCircuitBreakerRecovery() {
			console.info(`${config.logPrefix} Starting circuit breaker recovery monitor`);

			const circuitBreakerInterval = setInterval(() => {
				if (!actions.isCircuitBreakerOpen()) {
					return;
				}

				console.log(`${config.logPrefix} Testing connection during circuit breaker timeout`);
				void actions.recoverConnection();
			}, config.circuitBreakerRecoveryIntervalMs);

			return () => {
				console.info(`${config.logPrefix} Stopping circuit breaker monitor (cleanup)`);
				clearInterval(circuitBreakerInterval);
			};
		},

		startHealthChecks() {
			console.info(
				`${config.logPrefix} Starting periodic health checks (every ${config.healthCheckIntervalMs}ms)`,
			);

			const healthCheckInterval = setInterval(() => {
				console.log(`${config.logPrefix} Running periodic health check`);
				void actions.testConnection();
			}, config.healthCheckIntervalMs);

			return () => {
				console.info(`${config.logPrefix} Stopping health checks (cleanup)`);
				clearInterval(healthCheckInterval);
			};
		},

		startNetworkRecovery() {
			const handleOnline = () => {
				console.info(`${config.logPrefix} Browser came back online, attempting recovery`);
				void actions.recoverConnection();
			};

			window.addEventListener('online', handleOnline);

			return () => {
				window.removeEventListener('online', handleOnline);
			};
		},
	};
}
