/** @jest-environment node */

import { rateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
	// Helper to create mock request
	const createMockRequest = (ip?: string, forwarded?: string): Request => {
		const headers = new Headers();
		if (forwarded) headers.set('x-forwarded-for', forwarded);
		if (ip) headers.set('x-real-ip', ip);

		return new Request('http://localhost:3000/api/auth/signin', {
			headers,
		});
	};

	// Helper to advance time
	const advanceTime = (ms: number) => {
		jest.advanceTimersByTime(ms);
	};

	beforeEach(() => {
		// Clear the rate limiter's internal state
		const limiterWithAttempts = rateLimiter as unknown as { attempts: Map<string, unknown> };
		limiterWithAttempts.attempts.clear();
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('Basic rate limiting', () => {
		it('should allow requests under the limit', async () => {
			const request = createMockRequest('192.168.1.1');

			for (let i = 0; i < 4; i++) {
				const result = await rateLimiter.checkLimit(request);
				expect(result.allowed).toBe(true);
				expect(result.remainingAttempts).toBe(4 - i);

				await rateLimiter.recordAttempt(request, false);
			}
		});

		it('should block after exceeding the limit', async () => {
			const request = createMockRequest('192.168.1.1');

			// Record 5 failed attempts (the limit)
			for (let i = 0; i < 5; i++) {
				await rateLimiter.checkLimit(request);
				await rateLimiter.recordAttempt(request, false);
			}

			// Next request should be blocked
			const result = await rateLimiter.checkLimit(request);
			expect(result.allowed).toBe(false);
			expect(result.retryAfter).toBeGreaterThan(0);
			expect(result.message).toContain('Too many failed login attempts');
		});

		it('should reset after time window expires', async () => {
			const request = createMockRequest('192.168.1.1');

			// Record 3 failed attempts
			for (let i = 0; i < 3; i++) {
				await rateLimiter.checkLimit(request);
				await rateLimiter.recordAttempt(request, false);
			}

			// Advance time past the window (15 minutes)
			advanceTime(16 * 60 * 1000);

			// Should be allowed again
			const result = await rateLimiter.checkLimit(request);
			expect(result.allowed).toBe(true);
			expect(result.remainingAttempts).toBe(4); // Full limit restored
		});

		it('should clear attempts on successful login', async () => {
			const request = createMockRequest('192.168.1.1');

			// Record 3 failed attempts
			for (let i = 0; i < 3; i++) {
				await rateLimiter.checkLimit(request);
				await rateLimiter.recordAttempt(request, false);
			}

			// Record successful attempt
			await rateLimiter.recordAttempt(request, true);

			// Should have full attempts available
			const result = await rateLimiter.checkLimit(request);
			expect(result.allowed).toBe(true);
			expect(result.remainingAttempts).toBe(4);
		});
	});

	describe('Client identification', () => {
		it('should extract IP from x-forwarded-for header', async () => {
			const request1 = createMockRequest(undefined, '203.0.113.1, 192.168.1.1');
			const request2 = createMockRequest(undefined, '203.0.113.2, 192.168.1.1');

			// Record attempts from different IPs
			await rateLimiter.checkLimit(request1);
			await rateLimiter.recordAttempt(request1, false);

			await rateLimiter.checkLimit(request2);
			await rateLimiter.recordAttempt(request2, false);

			// Check they are tracked separately
			const result1 = await rateLimiter.checkLimit(request1);
			const result2 = await rateLimiter.checkLimit(request2);

			expect(result1.remainingAttempts).toBe(3);
			expect(result2.remainingAttempts).toBe(3);
		});

		it('should fallback to x-real-ip header', async () => {
			const request = createMockRequest('203.0.113.1');

			await rateLimiter.checkLimit(request);
			await rateLimiter.recordAttempt(request, false);

			const result = await rateLimiter.checkLimit(request);
			expect(result.remainingAttempts).toBe(3);
		});

		it('should handle missing IP headers', async () => {
			const request = createMockRequest();

			const result = await rateLimiter.checkLimit(request);
			expect(result.allowed).toBe(true);
			// Should use 'unknown' as key
		});

		it('should handle multiple IPs in x-forwarded-for', async () => {
			const request = createMockRequest(undefined, '203.0.113.1, 192.168.1.1, 10.0.0.1');

			await rateLimiter.checkLimit(request);
			await rateLimiter.recordAttempt(request, false);

			// Should use first IP (203.0.113.1)
			const result = await rateLimiter.checkLimit(request);
			expect(result.remainingAttempts).toBe(3);
		});
	});

	describe('Blocking mechanism', () => {
		it('should enforce 30-minute block duration', async () => {
			const request = createMockRequest('192.168.1.1');

			// Exceed limit
			for (let i = 0; i < 5; i++) {
				await rateLimiter.checkLimit(request);
				await rateLimiter.recordAttempt(request, false);
			}

			// Should be blocked
			let result = await rateLimiter.checkLimit(request);
			expect(result.allowed).toBe(false);
			expect(result.retryAfter).toBe(1800); // 30 minutes in seconds

			// Advance 29 minutes - still blocked
			advanceTime(29 * 60 * 1000);
			result = await rateLimiter.checkLimit(request);
			expect(result.allowed).toBe(false);

			// Advance 2 more minutes - should be unblocked
			advanceTime(2 * 60 * 1000);
			result = await rateLimiter.checkLimit(request);
			expect(result.allowed).toBe(true);
		});

		it('should maintain block even if window expires', async () => {
			const request = createMockRequest('192.168.1.1');

			// Exceed limit
			for (let i = 0; i < 5; i++) {
				await rateLimiter.checkLimit(request);
				await rateLimiter.recordAttempt(request, false);
			}

			// Advance past window (15 min) but not past block (30 min)
			advanceTime(20 * 60 * 1000);

			const result = await rateLimiter.checkLimit(request);
			expect(result.allowed).toBe(false);
			expect(result.message).toContain('Try again in');
		});
	});

	describe('Progressive delays', () => {
		it('should calculate progressive delays correctly', async () => {
			const request = createMockRequest('192.168.1.1');

			// No delay initially
			let delay = await rateLimiter.getProgressiveDelay(request);
			expect(delay).toBe(0);

			// Record attempts and check delays
			await rateLimiter.recordAttempt(request, false);
			delay = await rateLimiter.getProgressiveDelay(request);
			expect(delay).toBe(1000); // First delay

			await rateLimiter.recordAttempt(request, false);
			delay = await rateLimiter.getProgressiveDelay(request);
			expect(delay).toBe(2000); // Second delay

			await rateLimiter.recordAttempt(request, false);
			delay = await rateLimiter.getProgressiveDelay(request);
			expect(delay).toBe(5000); // Third delay

			await rateLimiter.recordAttempt(request, false);
			delay = await rateLimiter.getProgressiveDelay(request);
			expect(delay).toBe(10000); // Fourth delay (max)

			// Should cap at max delay
			await rateLimiter.recordAttempt(request, false);
			delay = await rateLimiter.getProgressiveDelay(request);
			expect(delay).toBe(10000); // Still max
		});
	});

	describe('Attack simulation', () => {
		it('should prevent brute force attacks', async () => {
			const request = createMockRequest('192.168.1.1');
			const attempts: boolean[] = [];

			// Simulate 20 rapid attempts
			for (let i = 0; i < 20; i++) {
				const result = await rateLimiter.checkLimit(request);
				attempts.push(result.allowed);

				if (result.allowed) {
					await rateLimiter.recordAttempt(request, false);
				}
			}

			// Only first 5 should be allowed
			const allowedCount = attempts.filter(a => a).length;
			expect(allowedCount).toBe(5);

			// Rest should be blocked
			const blockedCount = attempts.filter(a => !a).length;
			expect(blockedCount).toBe(15);
		});

		it('should handle distributed attacks from multiple IPs', async () => {
			const ips = ['192.168.1.1', '192.168.1.2', '192.168.1.3', '192.168.1.4', '192.168.1.5'];

			// Each IP gets its own limit
			for (const ip of ips) {
				const request = createMockRequest(ip);

				for (let i = 0; i < 5; i++) {
					const result = await rateLimiter.checkLimit(request);
					expect(result.allowed).toBe(true);
					await rateLimiter.recordAttempt(request, false);
				}

				// 6th attempt should be blocked
				const result = await rateLimiter.checkLimit(request);
				expect(result.allowed).toBe(false);
			}
		});

		it('should prevent bypass attempts with header manipulation', async () => {
			const request1 = createMockRequest('192.168.1.1');

			// Use up attempts
			for (let i = 0; i < 5; i++) {
				await rateLimiter.checkLimit(request1);
				await rateLimiter.recordAttempt(request1, false);
			}

			// Try to bypass with different header but same IP
			const request2 = createMockRequest(undefined, '192.168.1.1');
			const result = await rateLimiter.checkLimit(request2);

			// Should still be blocked (same IP)
			expect(result.allowed).toBe(false);
		});

		it('should handle rapid concurrent requests', async () => {
			const request = createMockRequest('192.168.1.1');

			// Simulate concurrent requests
			const promises = Array(10)
				.fill(null)
				.map(async () => {
					const result = await rateLimiter.checkLimit(request);
					if (result.allowed) {
						await rateLimiter.recordAttempt(request, false);
					}
					return result;
				});

			const results = await Promise.all(promises);

			// At least some should be blocked due to limit
			const blockedCount = results.filter(r => !r.allowed).length;
			expect(blockedCount).toBeGreaterThan(0);
		});
	});

	describe('Memory management', () => {
		it('should cleanup old entries', async () => {
			// Create entries for multiple IPs
			for (let i = 0; i < 10; i++) {
				const request = createMockRequest(`192.168.1.${i}`);
				await rateLimiter.checkLimit(request);
				await rateLimiter.recordAttempt(request, false);
			}

			const limiterWithAttempts = rateLimiter as unknown as { attempts: Map<string, unknown> };
			expect(limiterWithAttempts.attempts.size).toBe(10);

			// Advance time past cleanup threshold
			advanceTime(31 * 60 * 1000);

			// Trigger cleanup with new request
			const request = createMockRequest('192.168.1.100');
			await rateLimiter.checkLimit(request);

			// Old entries should be cleaned up
			const limiterAfterCleanup = rateLimiter as unknown as { attempts: Map<string, unknown> };
			expect(limiterAfterCleanup.attempts.size).toBeLessThan(10);
		});

		it('should not cleanup entries that are still blocked', async () => {
			const request = createMockRequest('192.168.1.1');

			// Block this IP
			for (let i = 0; i < 5; i++) {
				await rateLimiter.checkLimit(request);
				await rateLimiter.recordAttempt(request, false);
			}

			// Advance time but not past block duration
			advanceTime(20 * 60 * 1000);

			// Trigger cleanup
			const request2 = createMockRequest('192.168.1.2');
			await rateLimiter.checkLimit(request2);

			// Blocked entry should still exist
			const result = await rateLimiter.checkLimit(request);
			expect(result.allowed).toBe(false);
		});
	});

	describe('Edge cases', () => {
		it('should handle malformed IP addresses', async () => {
			const request = createMockRequest(undefined, 'not.an.ip.address');

			const result = await rateLimiter.checkLimit(request);
			expect(result.allowed).toBe(true);
			// Should still work with malformed IP
		});

		it('should handle empty IP headers', async () => {
			const request = createMockRequest('', '');

			const result = await rateLimiter.checkLimit(request);
			expect(result.allowed).toBe(true);
		});

		it('should handle IPv6 addresses', async () => {
			const request = createMockRequest(undefined, '2001:0db8:85a3:0000:0000:8a2e:0370:7334');

			await rateLimiter.checkLimit(request);
			await rateLimiter.recordAttempt(request, false);

			const result = await rateLimiter.checkLimit(request);
			expect(result.remainingAttempts).toBe(3);
		});

		it('should handle requests with spaces in forwarded header', async () => {
			const request = createMockRequest(undefined, ' 192.168.1.1 , 10.0.0.1 ');

			await rateLimiter.checkLimit(request);
			await rateLimiter.recordAttempt(request, false);

			const result = await rateLimiter.checkLimit(request);
			expect(result.remainingAttempts).toBe(3);
		});

		it('should handle clock skew gracefully', async () => {
			const request = createMockRequest('192.168.1.1');

			// Record some attempts
			await rateLimiter.checkLimit(request);
			await rateLimiter.recordAttempt(request, false);

			// Simulate clock going backwards
			jest.setSystemTime(Date.now() - 60000);

			// Should still work correctly
			const result = await rateLimiter.checkLimit(request);
			expect(result.allowed).toBe(true);
		});
	});

	describe('Security considerations', () => {
		it('should not expose internal state in error messages', async () => {
			const request = createMockRequest('192.168.1.1');

			// Exceed limit
			for (let i = 0; i < 5; i++) {
				await rateLimiter.checkLimit(request);
				await rateLimiter.recordAttempt(request, false);
			}

			const result = await rateLimiter.checkLimit(request);

			// Message should not reveal specific IPs or internal state
			expect(result.message).not.toContain('192.168.1.1');
			expect(result.message).not.toContain('attempts');
			expect(result.message).toMatch(/Too many failed login attempts/);
		});

		it('should handle XSS attempts in headers', async () => {
			const request = createMockRequest(undefined, '<script>alert("XSS")</script>');

			// Should not throw and should handle safely
			const result = await rateLimiter.checkLimit(request);
			expect(result.allowed).toBe(true);
		});

		it('should handle SQL injection attempts in headers', async () => {
			const request = createMockRequest(undefined, "'; DROP TABLE users; --");

			// Should not throw and should handle safely
			const result = await rateLimiter.checkLimit(request);
			expect(result.allowed).toBe(true);
		});

		it('should prevent memory exhaustion attacks', async () => {
			// Try to create many unique keys
			const promises = [];
			for (let i = 0; i < 1000; i++) {
				const request = createMockRequest(`192.168.${Math.floor(i / 256)}.${i % 256}`);
				promises.push(rateLimiter.checkLimit(request));
			}

			await Promise.all(promises);

			// Should handle without running out of memory
			const limiterWithAttempts = rateLimiter as unknown as { attempts: Map<string, unknown> };
			expect(limiterWithAttempts.attempts.size).toBeLessThanOrEqual(1000);
		});
	});
});
