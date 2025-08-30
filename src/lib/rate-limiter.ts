// lib/rate-limiter.ts
interface RateLimitData {
	attempts: number;
	resetTime: number;
	blockedUntil?: number;
}

class RateLimiter {
	private attempts = new Map<string, RateLimitData>();

	// Configuration
	private readonly MAX_ATTEMPTS = 5; // Max attempts per window
	private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
	private readonly BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes block
	private readonly PROGRESSIVE_DELAYS = [1000, 2000, 5000, 10000]; // Progressive delays in ms

	private getClientKey(request: Request): string {
		// Use multiple identifiers for better tracking
		const forwarded = request.headers.get('x-forwarded-for');
		const realIp = request.headers.get('x-real-ip');
		const ip = forwarded?.split(',')[0] || realIp || 'unknown';

		// You could also include username if available for per-user limiting
		return `login:${ip}`;
	}

	private cleanupOldEntries(): void {
		const now = Date.now();
		for (const [key, data] of this.attempts.entries()) {
			if (now > data.resetTime && (!data.blockedUntil || now > data.blockedUntil)) {
				this.attempts.delete(key);
			}
		}
	}

	async checkLimit(request: Request): Promise<{
		allowed: boolean;
		retryAfter?: number;
		remainingAttempts?: number;
		message?: string;
	}> {
		this.cleanupOldEntries();

		const key = this.getClientKey(request);
		const now = Date.now();
		const data = this.attempts.get(key);

		// If blocked, check if block period has expired
		if (data?.blockedUntil) {
			if (now < data.blockedUntil) {
				const retryAfter = Math.ceil((data.blockedUntil - now) / 1000);
				return {
					allowed: false,
					retryAfter,
					message: `Account temporarily locked due to security restrictions. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
				};
			}
			// Block has expired, reset the entry
			this.attempts.delete(key);
			this.attempts.set(key, {
				attempts: 0,
				resetTime: now + this.WINDOW_MS,
			});
			return {
				allowed: true,
				remainingAttempts: this.MAX_ATTEMPTS - 1,
			};
		}

		// If no previous attempts or window expired, allow
		if (!data || now > data.resetTime) {
			this.attempts.set(key, {
				attempts: 0,
				resetTime: now + this.WINDOW_MS,
			});
			return {
				allowed: true,
				remainingAttempts: this.MAX_ATTEMPTS - 1,
			};
		}

		// Check if within limits
		if (data.attempts < this.MAX_ATTEMPTS) {
			return {
				allowed: true,
				remainingAttempts: this.MAX_ATTEMPTS - data.attempts - 1,
			};
		}

		// Exceeded limits - block the IP
		const blockedUntil = now + this.BLOCK_DURATION_MS;
		this.attempts.set(key, {
			...data,
			blockedUntil,
		});

		const retryAfter = Math.ceil(this.BLOCK_DURATION_MS / 1000);
		return {
			allowed: false,
			retryAfter,
			message: `Account temporarily locked due to security restrictions. Locked for ${Math.ceil(retryAfter / 60)} minutes.`,
		};
	}

	async recordAttempt(request: Request, success: boolean): Promise<void> {
		const key = this.getClientKey(request);
		const now = Date.now();
		const data = this.attempts.get(key);

		if (success) {
			// Clear attempts on successful login
			this.attempts.delete(key);
			return;
		}

		// Record failed attempt
		if (!data || now > data.resetTime) {
			this.attempts.set(key, {
				attempts: 1,
				resetTime: now + this.WINDOW_MS,
			});
		} else {
			const newAttempts = data.attempts + 1;
			const shouldBlock = newAttempts >= this.MAX_ATTEMPTS;

			this.attempts.set(key, {
				...data,
				attempts: newAttempts,
				blockedUntil: shouldBlock ? now + this.BLOCK_DURATION_MS : data.blockedUntil,
			});
		}
	}

	async getProgressiveDelay(request: Request): Promise<number> {
		const key = this.getClientKey(request);
		const data = this.attempts.get(key);

		if (!data) return 0;

		const delayIndex = Math.min(data.attempts - 1, this.PROGRESSIVE_DELAYS.length - 1);
		return delayIndex >= 0 ? this.PROGRESSIVE_DELAYS[delayIndex] : 0;
	}
}

// Export singleton instance
export const rateLimiter = new RateLimiter();
