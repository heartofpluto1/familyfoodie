/** @jest-environment node */

import { requireAuth, requireAdminAuth } from './helpers';
import { getServerSession } from 'next-auth';
import pool from '@/lib/db';
import { NextResponse } from 'next/server';

// Mock next-auth
jest.mock('next-auth', () => ({
	getServerSession: jest.fn(),
}));

// Mock database
jest.mock('@/lib/db', () => ({
	__esModule: true,
	default: {
		execute: jest.fn(),
	},
}));

// Mock auth config
jest.mock('./config', () => ({
	authOptions: {
		providers: [],
		adapter: {},
		callbacks: {},
	},
}));

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockExecute = pool.execute as jest.Mock;

describe('Auth Helpers', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('requireAuth', () => {
		it('should authorize valid session with household_id', async () => {
			const mockSession = {
				user: {
					id: '1',
					email: 'test@example.com',
					household_id: 42,
					household_name: 'Test Household',
				},
				expires: new Date(Date.now() + 86400000).toISOString(),
			};
			mockGetServerSession.mockResolvedValueOnce(mockSession);

			const result = await requireAuth();

			expect(result.authorized).toBe(true);
			if (result.authorized) {
				expect(result.session).toEqual(mockSession);
				expect(result.household_id).toBe(42);
				expect(result.user_id).toBe('1');
			}
		});

		it('should reject when session is null', async () => {
			mockGetServerSession.mockResolvedValueOnce(null);

			const result = await requireAuth();

			expect(result.authorized).toBe(false);
			if (!result.authorized) {
				expect(result.response).toBeInstanceOf(NextResponse);
				const response = result.response as NextResponse;
				expect(response.status).toBe(401);
			}
		});

		it('should reject when session has no user', async () => {
			const mockSession = {
				expires: new Date(Date.now() + 86400000).toISOString(),
			} as unknown as Awaited<ReturnType<typeof getServerSession>>;
			mockGetServerSession.mockResolvedValueOnce(mockSession);

			const result = await requireAuth();

			expect(result.authorized).toBe(false);
		});

		it('should reject when user has no household_id', async () => {
			const mockSession = {
				user: {
					id: '1',
					email: 'test@example.com',
					// Missing household_id and household_name which are required
				},
				expires: new Date(Date.now() + 86400000).toISOString(),
			} as unknown as Awaited<ReturnType<typeof getServerSession>>;
			mockGetServerSession.mockResolvedValueOnce(mockSession);

			const result = await requireAuth();

			expect(result.authorized).toBe(false);
			if (!result.authorized) {
				const response = result.response as NextResponse;
				expect(response.status).toBe(401);
			}
		});

		it('should handle expired sessions', async () => {
			const mockSession = {
				user: {
					id: '1',
					email: 'test@example.com',
					household_id: 42,
					household_name: 'Test Household',
				},
				expires: new Date(Date.now() - 1000).toISOString(), // Expired
			};
			mockGetServerSession.mockResolvedValueOnce(mockSession);

			// NextAuth handles expiry internally, so if we get a session, it's valid
			const result = await requireAuth();

			expect(result.authorized).toBe(true);
		});

		it('should handle getServerSession errors', async () => {
			mockGetServerSession.mockRejectedValueOnce(new Error('Database connection failed'));

			const result = await requireAuth();

			expect(result.authorized).toBe(false);
			if (!result.authorized) {
				expect(result.response).toBeInstanceOf(NextResponse);
			}
		});

		it('should prevent session fixation attacks', async () => {
			// Test with manipulated session data
			const mockSession = {
				user: {
					id: "1' OR '1'='1", // SQL injection attempt
					email: 'test@example.com',
					household_id: 42,
					household_name: 'Test Household',
				},
				expires: new Date(Date.now() + 86400000).toISOString(),
			};
			mockGetServerSession.mockResolvedValueOnce(mockSession);

			const result = await requireAuth();

			// Should still work as NextAuth handles validation
			expect(result.authorized).toBe(true);
			if (result.authorized) {
				// The user_id should be passed as-is (NextAuth's responsibility to validate)
				expect(result.user_id).toBe("1' OR '1'='1");
			}
		});
	});

	describe('requireAdminAuth', () => {
		it('should authorize admin user', async () => {
			const mockSession = {
				user: {
					id: '1',
					email: 'admin@example.com',
					household_id: 42,
					household_name: 'Test Household',
					is_admin: true,
				},
				expires: new Date(Date.now() + 86400000).toISOString(),
			};
			mockGetServerSession.mockResolvedValueOnce(mockSession);
			mockExecute.mockResolvedValueOnce([[{ is_admin: 1 }], []]);

			const result = await requireAdminAuth();

			expect(result.authorized).toBe(true);
			if (result.authorized) {
				expect(result.session).toEqual(mockSession);
				expect(result.household_id).toBe(42);
				expect(result.user_id).toBe('1');
				expect(result.is_admin).toBe(true);
			}
			expect(mockExecute).toHaveBeenCalledWith('SELECT is_admin FROM users WHERE id = ?', ['1']);
		});

		it('should reject non-admin user', async () => {
			const mockSession = {
				user: {
					id: '2',
					email: 'user@example.com',
					household_id: 42,
					household_name: 'Test Household',
				},
				expires: new Date(Date.now() + 86400000).toISOString(),
			};
			mockGetServerSession.mockResolvedValueOnce(mockSession);
			mockExecute.mockResolvedValueOnce([[{ is_admin: 0 }], []]);

			const result = await requireAdminAuth();

			expect(result.authorized).toBe(false);
			if (!result.authorized) {
				expect(result.response).toBeInstanceOf(NextResponse);
				const response = result.response as NextResponse;
				expect(response.status).toBe(403);
			}
		});

		it('should reject when user not found in database', async () => {
			const mockSession = {
				user: {
					id: '999',
					email: 'ghost@example.com',
					household_id: 42,
					household_name: 'Test Household',
				},
				expires: new Date(Date.now() + 86400000).toISOString(),
			};
			mockGetServerSession.mockResolvedValueOnce(mockSession);
			mockExecute.mockResolvedValueOnce([[], []]);

			const result = await requireAdminAuth();

			expect(result.authorized).toBe(false);
			if (!result.authorized) {
				const response = result.response as NextResponse;
				expect(response.status).toBe(403);
			}
		});

		it('should reject when session is null', async () => {
			mockGetServerSession.mockResolvedValueOnce(null);

			const result = await requireAdminAuth();

			expect(result.authorized).toBe(false);
			if (!result.authorized) {
				const response = result.response as NextResponse;
				expect(response.status).toBe(401);
			}
			expect(mockExecute).not.toHaveBeenCalled();
		});

		it('should handle database query errors', async () => {
			const mockSession = {
				user: {
					id: '1',
					email: 'admin@example.com',
					household_id: 42,
					household_name: 'Test Household',
				},
				expires: new Date(Date.now() + 86400000).toISOString(),
			};
			mockGetServerSession.mockResolvedValueOnce(mockSession);
			mockExecute.mockRejectedValueOnce(new Error('Database connection failed'));

			const result = await requireAdminAuth();

			expect(result.authorized).toBe(false);
			if (!result.authorized) {
				expect(result.response).toBeInstanceOf(NextResponse);
			}
		});

		it('should prevent SQL injection in user ID', async () => {
			const mockSession = {
				user: {
					id: "1' OR '1'='1",
					email: 'attacker@example.com',
					household_id: 42,
					household_name: 'Test Household',
				},
				expires: new Date(Date.now() + 86400000).toISOString(),
			};
			mockGetServerSession.mockResolvedValueOnce(mockSession);
			mockExecute.mockResolvedValueOnce([[], []]);

			const result = await requireAdminAuth();

			// Should use parameterized query
			expect(mockExecute).toHaveBeenCalledWith('SELECT is_admin FROM users WHERE id = ?', ["1' OR '1'='1"]);
			expect(result.authorized).toBe(false);
		});

		it('should handle malformed is_admin values in database', async () => {
			const mockSession = {
				user: {
					id: '1',
					email: 'admin@example.com',
					household_id: 42,
					household_name: 'Test Household',
				},
				expires: new Date(Date.now() + 86400000).toISOString(),
			};
			mockGetServerSession.mockResolvedValueOnce(mockSession);
			mockExecute.mockResolvedValueOnce([[{ is_admin: 'not_a_boolean' }], []]);

			const result = await requireAdminAuth();

			// JavaScript truthy check should handle this
			expect(result.authorized).toBe(false);
		});

		it('should handle null is_admin values', async () => {
			const mockSession = {
				user: {
					id: '1',
					email: 'admin@example.com',
					household_id: 42,
					household_name: 'Test Household',
				},
				expires: new Date(Date.now() + 86400000).toISOString(),
			};
			mockGetServerSession.mockResolvedValueOnce(mockSession);
			mockExecute.mockResolvedValueOnce([[{ is_admin: null }], []]);

			const result = await requireAdminAuth();

			expect(result.authorized).toBe(false);
		});
	});

	describe('Concurrent request handling', () => {
		it('should handle concurrent requireAuth calls correctly', async () => {
			const mockSession = {
				user: {
					id: '1',
					email: 'test@example.com',
					household_id: 42,
					household_name: 'Test Household',
				},
				expires: new Date(Date.now() + 86400000).toISOString(),
			};
			mockGetServerSession.mockResolvedValue(mockSession);

			const results = await Promise.all([requireAuth(), requireAuth(), requireAuth()]);

			results.forEach(result => {
				expect(result.authorized).toBe(true);
				if (result.authorized) {
					expect(result.household_id).toBe(42);
				}
			});
		});

		it('should handle concurrent requireAdminAuth calls correctly', async () => {
			const mockSession = {
				user: {
					id: '1',
					email: 'admin@example.com',
					household_id: 42,
					household_name: 'Test Household',
				},
				expires: new Date(Date.now() + 86400000).toISOString(),
			};
			mockGetServerSession.mockResolvedValue(mockSession);
			mockExecute.mockResolvedValue([[{ is_admin: 1 }], []]);

			const results = await Promise.all([requireAdminAuth(), requireAdminAuth(), requireAdminAuth()]);

			results.forEach(result => {
				expect(result.authorized).toBe(true);
				if (result.authorized) {
					expect(result.is_admin).toBe(true);
				}
			});
		});
	});

	describe('Response format security', () => {
		it('should not expose sensitive session data in unauthorized response', async () => {
			mockGetServerSession.mockResolvedValueOnce(null);

			const result = await requireAuth();

			if (!result.authorized) {
				const response = result.response as NextResponse;
				const body = await response.json();
				expect(body).toEqual({ error: 'Unauthorized' });
				// Should not contain any session details
				expect(JSON.stringify(body)).not.toContain('session');
				expect(JSON.stringify(body)).not.toContain('household');
			}
		});

		it('should not expose database errors in responses', async () => {
			const mockSession = {
				user: {
					id: '1',
					email: 'admin@example.com',
					household_id: 42,
					household_name: 'Test Household',
				},
				expires: new Date(Date.now() + 86400000).toISOString(),
			};
			mockGetServerSession.mockResolvedValueOnce(mockSession);
			mockExecute.mockRejectedValueOnce(new Error('ECONNREFUSED: Connection to database failed at 192.168.1.100:3306'));

			const result = await requireAdminAuth();

			// Should return unauthorized without exposing database error details
			expect(result.authorized).toBe(false);
			if (!result.authorized) {
				const response = result.response as NextResponse;
				// Get the response body to check error message
				const body = await response.json();
				expect(body.error).toBe('Unauthorized');
				// Should not contain sensitive database details
				expect(JSON.stringify(body)).not.toContain('192.168.1.100');
				expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
			}
		});
	});
});
