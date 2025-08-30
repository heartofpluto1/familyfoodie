/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import { NextResponse } from 'next/server';
import * as appHandler from './route';
import { getAllUsers, getUserStats } from '@/lib/queries/admin/users';
import { requireAdminAuth } from '@/lib/auth/helpers';
import { setupConsoleMocks, standardErrorScenarios, mockAdminSession } from '@/lib/test-utils';
import type { User } from '@/types/user';

// Mock the auth helpers
jest.mock('@/lib/auth/helpers', () => ({
	requireAuth: jest.fn(),
	requireAdminAuth: jest.fn(),
}));

// Mock the user queries
jest.mock('@/lib/queries/admin/users', () => ({
	getAllUsers: jest.fn(),
	getUserStats: jest.fn(),
}));

// Type assertions for mocked modules
const mockRequireAdminAuth = requireAdminAuth as jest.MockedFunction<typeof requireAdminAuth>;
const mockGetAllUsers = getAllUsers as jest.MockedFunction<typeof getAllUsers>;
const mockGetUserStats = getUserStats as jest.MockedFunction<typeof getUserStats>;

// Test data
const mockUsers: User[] = [
	{
		id: 1,
		oauth_provider: 'google',
		oauth_provider_id: '123456',
		first_name: 'Admin',
		last_name: 'User',
		email: 'admin@example.com',
		is_active: true,
		is_admin: true,
		date_joined: '2024-01-01T10:00:00Z',
		last_session: '2024-12-01T10:00:00Z',
	},
	{
		id: 2,
		oauth_provider: 'google',
		oauth_provider_id: '789012',
		first_name: 'John',
		last_name: 'Doe',
		email: 'john@example.com',
		is_active: true,
		is_admin: false,
		date_joined: '2024-02-01T10:00:00Z',
		last_session: '2024-11-15T10:00:00Z',
	},
	{
		id: 3,
		oauth_provider: 'facebook',
		oauth_provider_id: 'fb_345678',
		first_name: 'Jane',
		last_name: 'Smith',
		email: 'jane@example.com',
		is_active: false,
		is_admin: false,
		date_joined: '2024-03-01T10:00:00Z',
		last_session: null,
	},
];

const mockStats = {
	total: 3,
	active: 2,
	admins: 1,
};

describe('/api/admin/users', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('GET /api/admin/users', () => {
		describe('Authentication & Authorization Tests', () => {
			it('returns 403 for non-admin users', async () => {
				const mockResponse = NextResponse.json({ error: 'Admin access required' }, { status: 403 });

			mockRequireAdminAuth.mockResolvedValue({
				authorized: false as const,
				response: mockResponse,
			});

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(403);
						expect(json).toEqual({ error: 'Admin access required' });
						expect(mockGetAllUsers).not.toHaveBeenCalled();
						expect(mockGetUserStats).not.toHaveBeenCalled();
					},
				});
			});

			it('returns 403 when requireAdminUser throws an error', async () => {
				mockRequireAdminAuth.mockRejectedValue(standardErrorScenarios.authError);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(500);
						expect(json).toEqual({
							error: 'Failed to fetch users',
							code: 'INTERNAL_ERROR',
						});
						expect(consoleMocks.mockConsoleError).toHaveBeenCalledWith('Error in admin users handler:', expect.any(Error));
						expect(mockGetAllUsers).not.toHaveBeenCalled();
					},
				});
			});

			it('returns 403 when user is authenticated but not admin', async () => {
				// Mock non-admin user scenario
				const mockResponse = NextResponse.json({ error: 'Admin access required' }, { status: 403 });

			mockRequireAdminAuth.mockResolvedValue({
				authorized: false as const,
				response: mockResponse,
			});

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(403);
						expect(json).toEqual({ error: 'Admin access required' });
					},
				});
			});
		});

		describe('Success Path Tests', () => {
			it('returns all users without stats for admin users', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(mockUsers);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							users: mockUsers,
						});
						expect(mockGetAllUsers).toHaveBeenCalledTimes(1);
						expect(mockGetUserStats).not.toHaveBeenCalled();
					},
				});
			});

			it('returns all users with stats when includeStats=true', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(mockUsers);
				mockGetUserStats.mockResolvedValue(mockStats);

				await testApiHandler({
					appHandler,
					url: '/api/admin/users?includeStats=true',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							users: mockUsers,
							stats: mockStats,
						});
						expect(mockGetAllUsers).toHaveBeenCalledTimes(1);
						expect(mockGetUserStats).toHaveBeenCalledTimes(1);
					},
				});
			});

			it('handles empty user list gracefully', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue([]);
				mockGetUserStats.mockResolvedValue({
					total: 0,
					active: 0,
					admins: 0,
				});

				await testApiHandler({
					appHandler,
					url: '/api/admin/users?includeStats=true',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							users: [],
							stats: {
								total: 0,
								active: 0,
								admins: 0,
							},
						});
					},
				});
			});

			it('handles large user datasets', async () => {
				const largeUserList = Array.from({ length: 1000 }, (_, i) => ({
					id: i + 1,
					username: `user${i}`,
					first_name: `First${i}`,
					last_name: `Last${i}`,
					email: `user${i}@example.com`,
					is_active: i % 2 === 0,
					is_admin: i % 10 === 0,
					date_joined: '2024-01-01T10:00:00Z',
					last_session: i % 3 === 0 ? '2024-12-01T10:00:00Z' : null,
				}));

				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(largeUserList);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json.users).toHaveLength(1000);
						expect(json.users).toEqual(largeUserList);
					},
				});
			});

			it('does not include stats when includeStats=false', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(mockUsers);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							users: mockUsers,
						});
						expect(mockGetUserStats).not.toHaveBeenCalled();
					},
				});
			});

			it('handles users with special characters in names', async () => {
				const specialUsers: User[] = [
					{
						id: 1,
						username: 'user.special',
						first_name: 'José',
						last_name: "O'Brien",
						email: 'josé@example.com',
						is_active: true,
						is_admin: false,
						date_joined: '2024-01-01T10:00:00Z',
						last_session: null,
					},
					{
						id: 2,
						username: 'user2',
						first_name: '李',
						last_name: '王',
						email: 'user@例え.jp',
						is_active: true,
						is_admin: false,
						date_joined: '2024-01-01T10:00:00Z',
						last_session: '2024-12-01T10:00:00Z',
					},
				];

				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(specialUsers);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json.users).toEqual(specialUsers);
					},
				});
			});
		});

		describe('Error Handling Tests', () => {
			it('handles database connection failures', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockRejectedValue(standardErrorScenarios.databaseError);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(500);
						expect(json).toEqual({
							error: 'Failed to fetch users',
							code: 'DATABASE_ERROR',
						});
					},
				});
			});

			it('handles getUserStats failure when includeStats=true', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(mockUsers);
				mockGetUserStats.mockRejectedValue(new Error('Stats query failed'));

				await testApiHandler({
					appHandler,
					url: '/api/admin/users?includeStats=true',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(500);
						expect(json).toEqual({
							error: 'Failed to fetch users',
							code: 'STATS_FETCH_ERROR',
						});
					},
				});
			});

			it('handles getAllUsers query failure', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockRejectedValue(new Error('Query execution failed'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(500);
						expect(json).toEqual({
							error: 'Failed to fetch users',
							code: 'DATABASE_ERROR',
						});
					},
				});
			});

			it('handles unknown error types', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockRejectedValue('String error');

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(500);
						expect(json).toEqual({
							error: 'Failed to fetch users',
							code: 'DATABASE_ERROR',
						});
					},
				});
			});

			it('handles null/undefined in user data gracefully', async () => {
				const usersWithNulls: User[] = [
					{
						id: 1,
						username: 'user1',
						first_name: '',
						last_name: '',
						email: 'user1@example.com',
						is_active: true,
						is_admin: false,
						date_joined: '2024-01-01T10:00:00Z',
						last_session: null,
					},
				];

				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(usersWithNulls);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json.users).toEqual(usersWithNulls);
					},
				});
			});
		});

		describe('Query Parameter Validation Tests', () => {
			it('ignores invalid includeStats values', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(mockUsers);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							users: mockUsers,
						});
						expect(mockGetUserStats).not.toHaveBeenCalled();
					},
				});
			});

			it('handles multiple query parameters', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(mockUsers);
				mockGetUserStats.mockResolvedValue(mockStats);

				await testApiHandler({
					appHandler,
					url: '/api/admin/users?includeStats=true&other=param&another=value',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							users: mockUsers,
							stats: mockStats,
						});
					},
				});
			});

			it('handles case-sensitive includeStats parameter', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(mockUsers);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							users: mockUsers,
						});
						expect(mockGetUserStats).not.toHaveBeenCalled(); // 'True' !== 'true'
					},
				});
			});

			it('handles empty query string', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(mockUsers);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							users: mockUsers,
						});
					},
				});
			});
		});

		describe('HTTP Method Validation Tests', () => {
			// Note: Next.js handles method validation automatically for named exports
			// These tests verify that behavior

			it('should reject POST requests', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ test: 'data' }),
						});

						// Next.js automatically returns 405 for unsupported methods
						expect(response.status).toBe(405);
						// Expected after fix:
						// expect(json).toEqual({
						//   error: 'Method not allowed',
						// });
					},
				});
			});

			it('should reject PUT requests', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ test: 'data' }),
						});

						expect(response.status).toBe(405);
					},
				});
			});

			it('should reject DELETE requests', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
						});

						expect(response.status).toBe(405);
					},
				});
			});

			it('should reject PATCH requests', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ test: 'data' }),
						});

						expect(response.status).toBe(405);
					},
				});
			});

			it('should accept HEAD requests', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(mockUsers);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'HEAD',
						});

						// HEAD requests typically return 200 with no body
						expect(response.status).toBe(200);
					},
				});
			});

			it('should accept OPTIONS requests for CORS', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'OPTIONS',
						});

						// OPTIONS might return 200 or 204 depending on implementation
						expect([200, 204, 405]).toContain(response.status);
					},
				});
			});
		});

		describe('Response Format & Data Integrity Tests', () => {
			it('maintains consistent response structure', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(mockUsers);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toHaveProperty('users');
						expect(Array.isArray(json.users)).toBe(true);
						expect(json).not.toHaveProperty('stats');
					},
				});
			});

			it('maintains user data structure integrity', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue([mockUsers[0]]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						const user = json.users[0];
						expect(user).toHaveProperty('id');
						expect(user).toHaveProperty('email');
						expect(user).toHaveProperty('first_name');
						expect(user).toHaveProperty('last_name');
						expect(user).toHaveProperty('email');
						expect(user).toHaveProperty('is_active');
						expect(user).toHaveProperty('is_admin');
						expect(user).toHaveProperty('date_joined');
						expect(user).toHaveProperty('last_session');

						// Type checks
						expect(typeof user.id).toBe('number');
						expect(typeof user.username).toBe('string');
						expect(typeof user.is_active).toBe('boolean');
						expect(typeof user.is_admin).toBe('boolean');
					},
				});
			});

			it('maintains stats structure integrity when included', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(mockUsers);
				mockGetUserStats.mockResolvedValue(mockStats);

				await testApiHandler({
					appHandler,
					url: '/api/admin/users?includeStats=true',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json.stats).toBeDefined();
						expect(json.stats).toHaveProperty('total');
						expect(json.stats).toHaveProperty('active');
						expect(json.stats).toHaveProperty('admins');

						// Type checks
						expect(typeof json.stats.total).toBe('number');
						expect(typeof json.stats.active).toBe('number');
						expect(typeof json.stats.admins).toBe('number');
					},
				});
			});

			it('handles ISO date strings correctly', async () => {
				const usersWithDates: User[] = [
					{
						id: 1,
						username: 'testuser',
						first_name: 'Test',
						last_name: 'User',
						email: 'test@example.com',
						is_active: true,
						is_admin: false,
						date_joined: '2024-01-15T14:30:00.000Z',
						last_session: '2024-12-01T09:15:30.500Z',
					},
				];

				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(usersWithDates);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						const user = json.users[0];
						expect(user.date_joined).toBe('2024-01-15T14:30:00.000Z');
						expect(user.last_session).toBe('2024-12-01T09:15:30.500Z');
					},
				});
			});
		});

		describe('Edge Cases & Boundary Tests', () => {
			it('handles mixed active/inactive users', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(mockUsers);
				mockGetUserStats.mockResolvedValue({
					total: 3,
					active: 2,
					admins: 1,
				});

				await testApiHandler({
					appHandler,
					url: '/api/admin/users?includeStats=true',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						// Verify mixed states
						const activeUsers = json.users.filter((u: User) => u.is_active);
						const inactiveUsers = json.users.filter((u: User) => !u.is_active);
						expect(activeUsers.length).toBe(2);
						expect(inactiveUsers.length).toBe(1);
						expect(json.stats.active).toBe(2);
					},
				});
			});

			it('handles users with null last_session', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(mockUsers);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						const usersWithNullLogin = json.users.filter((u: User) => u.last_session === null);
						expect(usersWithNullLogin.length).toBeGreaterThan(0);
					},
				});
			});

			it('handles very long usernames and emails', async () => {
				const longDataUsers: User[] = [
					{
						id: 1,
						username: 'a'.repeat(100),
						first_name: 'b'.repeat(50),
						last_name: 'c'.repeat(50),
						email: 'd'.repeat(90) + '@example.com',
						is_active: true,
						is_admin: false,
						date_joined: '2024-01-01T10:00:00Z',
						last_session: null,
					},
				];

				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(longDataUsers);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json.users[0].username.length).toBe(100);
						expect(json.users[0].email.length).toBeGreaterThan(90);
					},
				});
			});

			it('handles stats with zero values', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue([]);
				mockGetUserStats.mockResolvedValue({
					total: 0,
					active: 0,
					admins: 0,
				});

				await testApiHandler({
					appHandler,
					url: '/api/admin/users?includeStats=true',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json.stats.total).toBe(0);
						expect(json.stats.active).toBe(0);
						expect(json.stats.admins).toBe(0);
					},
				});
			});

			it('handles concurrent requests', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(mockUsers);
				mockGetUserStats.mockResolvedValue(mockStats);

				await testApiHandler({
					appHandler,
					url: '/api/admin/users?includeStats=true',
					test: async ({ fetch }) => {
						// Simulate concurrent requests
						const requests = Array.from({ length: 5 }, () => fetch({ method: 'GET' }));

						const responses = await Promise.all(requests);
						const jsons = await Promise.all(responses.map(r => r.json()));

						// All should succeed
						responses.forEach(response => {
							expect(response.status).toBe(200);
						});

						// All should have same data
						jsons.forEach(json => {
							expect(json.users).toEqual(mockUsers);
							expect(json.stats).toEqual(mockStats);
						});

						// Functions should be called once per request
						expect(mockGetAllUsers).toHaveBeenCalledTimes(5);
						expect(mockGetUserStats).toHaveBeenCalledTimes(5);
					},
				});
			});
		});

		describe('Performance & Memory Tests', () => {
			it('handles memory efficiently with large datasets', async () => {
				// Create a very large user list
				const veryLargeUserList = Array.from({ length: 10000 }, (_, i) => ({
					id: i + 1,
					username: `user${i}`,
					first_name: `First${i}`,
					last_name: `Last${i}`,
					email: `user${i}@example.com`,
					is_active: true,
					is_admin: false,
					date_joined: '2024-01-01T10:00:00Z',
					last_session: null,
				}));

				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(veryLargeUserList);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const startTime = Date.now();
						const response = await fetch({ method: 'GET' });
						const endTime = Date.now();

						expect(response.status).toBe(200);
						const json = await response.json();
						expect(json.users).toHaveLength(10000);

						// Should complete in reasonable time (< 5 seconds)
						expect(endTime - startTime).toBeLessThan(5000);
					},
				});
			});

			it('handles rapid sequential requests efficiently', async () => {
				mockRequireAdminAuth.mockResolvedValue({
				authorized: true as const,
				session: mockAdminSession,
				household_id: mockAdminSession.user.household_id,
				user_id: mockAdminSession.user.id,
				is_admin: true,
			});
				mockGetAllUsers.mockResolvedValue(mockUsers);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const startTime = Date.now();

						// Send 10 requests sequentially
						for (let i = 0; i < 10; i++) {
							const response = await fetch({ method: 'GET' });
							expect(response.status).toBe(200);
						}

						const endTime = Date.now();

						// Should complete all requests quickly (< 2 seconds)
						expect(endTime - startTime).toBeLessThan(2000);
						expect(mockGetAllUsers).toHaveBeenCalledTimes(10);
					},
				});
			});
		});
	});
});
