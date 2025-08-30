/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import { NextResponse } from 'next/server';
import * as appHandler from './route';
import { requireAdminAuth } from '@/lib/auth/helpers';
import { getUserById, updateUser, deleteUser } from '@/lib/queries/admin/users';
import { setupConsoleMocks, standardErrorScenarios, mockAdminSession } from '@/lib/test-utils';
import type { User, UserUpdate } from '@/types/user';

// Mock the auth helpers
jest.mock('@/lib/auth/helpers', () => ({
	requireAdminAuth: jest.fn(),
}));

// Mock the user queries
jest.mock('@/lib/queries/admin/users', () => ({
	getUserById: jest.fn(),
	updateUser: jest.fn(),
	deleteUser: jest.fn(),
}));

// Type assertions for mocked modules
const mockRequireAdminAuth = requireAdminAuth as jest.MockedFunction<typeof requireAdminAuth>;
const mockGetUserById = getUserById as jest.MockedFunction<typeof getUserById>;
const mockUpdateUser = updateUser as jest.MockedFunction<typeof updateUser>;
const mockDeleteUser = deleteUser as jest.MockedFunction<typeof deleteUser>;

// Test data
const mockUser: User = {
	id: 1,
	oauth_provider: 'google',
	oauth_provider_id: '12345',
	email: 'test@example.com',
	first_name: 'Test',
	last_name: 'User',
	is_active: true,
	is_admin: false,
	date_joined: '2024-01-01T00:00:00Z',
	last_session: '2024-01-02T00:00:00Z',
};

describe('/api/admin/users/[id]', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();
	});

	afterEach(() => {
		consoleMocks.cleanup();
	});

	describe('GET /api/admin/users/[id]', () => {
		describe('Authentication & Authorization', () => {
			it('returns 403 for non-admin users', async () => {
				const mockResponse = NextResponse.json({ error: 'Admin access required' }, { status: 403 });

				mockRequireAdminAuth.mockResolvedValue({
					authorized: false as const,
					response: mockResponse,
				});

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(403);
						expect(json).toEqual({ error: 'Admin access required' });
						expect(mockGetUserById).not.toHaveBeenCalled();
					},
				});
			});

			it('handles authentication errors gracefully', async () => {
				const mockResponse = NextResponse.json({ error: 'Authentication failed' }, { status: 500 });

				mockRequireAdminAuth.mockResolvedValue({
					authorized: false as const,
					response: mockResponse,
				});

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(500);
						expect(json).toEqual({ error: 'Authentication failed' });
					},
				});
			});
		});

		describe('Input Validation', () => {
			it('returns 400 for invalid user ID', async () => {
				mockRequireAdminAuth.mockResolvedValue({
					authorized: true as const,
					session: mockAdminSession,
					household_id: mockAdminSession.user.household_id,
					user_id: mockAdminSession.user.id,
					is_admin: true,
				});

				await testApiHandler({
					appHandler,
					params: { id: 'invalid' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(400);
						expect(json).toEqual({ error: 'Invalid user ID' });
						expect(mockGetUserById).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Success Cases', () => {
			it('returns user data for valid ID', async () => {
				mockRequireAdminAuth.mockResolvedValue({
					authorized: true as const,
					session: mockAdminSession,
					household_id: mockAdminSession.user.household_id,
					user_id: mockAdminSession.user.id,
					is_admin: true,
				});
				mockGetUserById.mockResolvedValue(mockUser);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({ user: mockUser });
						expect(mockGetUserById).toHaveBeenCalledWith(1);
					},
				});
			});

			it('returns 404 for non-existent user', async () => {
				mockRequireAdminAuth.mockResolvedValue({
					authorized: true as const,
					session: mockAdminSession,
					household_id: mockAdminSession.user.household_id,
					user_id: mockAdminSession.user.id,
					is_admin: true,
				});
				mockGetUserById.mockResolvedValue(null);

				await testApiHandler({
					appHandler,
					params: { id: '999' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(404);
						expect(json).toEqual({ error: 'User not found' });
						expect(mockGetUserById).toHaveBeenCalledWith(999);
					},
				});
			});
		});

		describe('Error Handling', () => {
			it('handles database errors gracefully', async () => {
				mockRequireAdminAuth.mockResolvedValue({
					authorized: true as const,
					session: mockAdminSession,
					household_id: mockAdminSession.user.household_id,
					user_id: mockAdminSession.user.id,
					is_admin: true,
				});
				mockGetUserById.mockRejectedValue(standardErrorScenarios.databaseError);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(500);
						expect(json).toEqual({ error: 'Failed to fetch user' });
					},
				});
			});
		});
	});

	describe('PATCH /api/admin/users/[id]', () => {
		const updateData: UserUpdate = {
			first_name: 'Updated',
			last_name: 'Name',
			is_active: false,
		};

		describe('Authentication & Authorization', () => {
			it('returns 403 for non-admin users', async () => {
				const mockResponse = NextResponse.json({ error: 'Admin access required' }, { status: 403 });

				mockRequireAdminAuth.mockResolvedValue({
					authorized: false as const,
					response: mockResponse,
				});

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(updateData),
						});
						const json = await response.json();

						expect(response.status).toBe(403);
						expect(json).toEqual({ error: 'Admin access required' });
						expect(mockUpdateUser).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Input Validation', () => {
			it('returns 400 for invalid user ID', async () => {
				mockRequireAdminAuth.mockResolvedValue({
					authorized: true as const,
					session: mockAdminSession,
					household_id: mockAdminSession.user.household_id,
					user_id: mockAdminSession.user.id,
					is_admin: true,
				});

				await testApiHandler({
					appHandler,
					params: { id: 'invalid' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(updateData),
						});
						const json = await response.json();

						expect(response.status).toBe(400);
						expect(json).toEqual({ error: 'Invalid user ID' });
						expect(mockUpdateUser).not.toHaveBeenCalled();
					},
				});
			});

			it('returns 400 when trying to modify own admin status', async () => {
				mockRequireAdminAuth.mockResolvedValue({
					authorized: true as const,
					session: mockAdminSession,
					household_id: mockAdminSession.user.household_id,
					user_id: mockAdminSession.user.id,
					is_admin: true,
				});

				await testApiHandler({
					appHandler,
					params: { id: mockAdminSession.user.id },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ is_admin: false }),
						});
						const json = await response.json();

						expect(response.status).toBe(400);
						expect(json).toEqual({ error: 'Cannot modify your own privileges' });
						expect(mockUpdateUser).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Success Cases', () => {
			it('updates user successfully', async () => {
				mockRequireAdminAuth.mockResolvedValue({
					authorized: true as const,
					session: mockAdminSession,
					household_id: mockAdminSession.user.household_id,
					user_id: mockAdminSession.user.id,
					is_admin: true,
				});
				mockUpdateUser.mockResolvedValue(true);
				mockGetUserById.mockResolvedValue({ ...mockUser, ...updateData, id: 2 });

				await testApiHandler({
					appHandler,
					params: { id: '2' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(updateData),
						});
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							message: 'User updated successfully',
							user: { ...mockUser, ...updateData, id: 2 },
						});
						expect(mockUpdateUser).toHaveBeenCalledWith(2, updateData);
						expect(mockGetUserById).toHaveBeenCalledWith(2);
					},
				});
			});

			it('returns 404 for non-existent user', async () => {
				mockRequireAdminAuth.mockResolvedValue({
					authorized: true as const,
					session: mockAdminSession,
					household_id: mockAdminSession.user.household_id,
					user_id: mockAdminSession.user.id,
					is_admin: true,
				});
				mockUpdateUser.mockResolvedValue(false);

				await testApiHandler({
					appHandler,
					params: { id: '999' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(updateData),
						});
						const json = await response.json();

						expect(response.status).toBe(404);
						expect(json).toEqual({ error: 'User not found' });
						expect(mockUpdateUser).toHaveBeenCalledWith(999, updateData);
					},
				});
			});
		});

		describe('Error Handling', () => {
			it('handles database errors gracefully', async () => {
				mockRequireAdminAuth.mockResolvedValue({
					authorized: true as const,
					session: mockAdminSession,
					household_id: mockAdminSession.user.household_id,
					user_id: mockAdminSession.user.id,
					is_admin: true,
				});
				mockUpdateUser.mockRejectedValue(standardErrorScenarios.databaseError);

				await testApiHandler({
					appHandler,
					params: { id: '2' }, // Use different user ID to avoid self-modification check
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(updateData),
						});
						const json = await response.json();

						expect(response.status).toBe(500);
						expect(json).toEqual({ error: 'Failed to update user' });
					},
				});
			});
		});
	});

	describe('DELETE /api/admin/users/[id]', () => {
		describe('Authentication & Authorization', () => {
			it('returns 403 for non-admin users', async () => {
				const mockResponse = NextResponse.json({ error: 'Admin access required' }, { status: 403 });

				mockRequireAdminAuth.mockResolvedValue({
					authorized: false as const,
					response: mockResponse,
				});

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'DELETE' });
						const json = await response.json();

						expect(response.status).toBe(403);
						expect(json).toEqual({ error: 'Admin access required' });
						expect(mockDeleteUser).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Input Validation', () => {
			it('returns 400 for invalid user ID', async () => {
				mockRequireAdminAuth.mockResolvedValue({
					authorized: true as const,
					session: mockAdminSession,
					household_id: mockAdminSession.user.household_id,
					user_id: mockAdminSession.user.id,
					is_admin: true,
				});

				await testApiHandler({
					appHandler,
					params: { id: 'invalid' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'DELETE' });
						const json = await response.json();

						expect(response.status).toBe(400);
						expect(json).toEqual({ error: 'Invalid user ID' });
						expect(mockDeleteUser).not.toHaveBeenCalled();
					},
				});
			});

			it('returns 400 when trying to delete own account', async () => {
				mockRequireAdminAuth.mockResolvedValue({
					authorized: true as const,
					session: mockAdminSession,
					household_id: mockAdminSession.user.household_id,
					user_id: mockAdminSession.user.id,
					is_admin: true,
				});

				await testApiHandler({
					appHandler,
					params: { id: mockAdminSession.user.id },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'DELETE' });
						const json = await response.json();

						expect(response.status).toBe(400);
						expect(json).toEqual({ error: 'Cannot delete your own account' });
						expect(mockDeleteUser).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Success Cases', () => {
			it('deletes user successfully', async () => {
				mockRequireAdminAuth.mockResolvedValue({
					authorized: true as const,
					session: mockAdminSession,
					household_id: mockAdminSession.user.household_id,
					user_id: mockAdminSession.user.id,
					is_admin: true,
				});
				mockDeleteUser.mockResolvedValue(true);

				await testApiHandler({
					appHandler,
					params: { id: '2' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'DELETE' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({ message: 'User deleted successfully' });
						expect(mockDeleteUser).toHaveBeenCalledWith(2);
					},
				});
			});

			it('returns 404 for non-existent user', async () => {
				mockRequireAdminAuth.mockResolvedValue({
					authorized: true as const,
					session: mockAdminSession,
					household_id: mockAdminSession.user.household_id,
					user_id: mockAdminSession.user.id,
					is_admin: true,
				});
				mockDeleteUser.mockResolvedValue(false);

				await testApiHandler({
					appHandler,
					params: { id: '999' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'DELETE' });
						const json = await response.json();

						expect(response.status).toBe(404);
						expect(json).toEqual({ error: 'User not found' });
						expect(mockDeleteUser).toHaveBeenCalledWith(999);
					},
				});
			});
		});

		describe('Error Handling', () => {
			it('handles database errors gracefully', async () => {
				mockRequireAdminAuth.mockResolvedValue({
					authorized: true as const,
					session: mockAdminSession,
					household_id: mockAdminSession.user.household_id,
					user_id: mockAdminSession.user.id,
					is_admin: true,
				});
				mockDeleteUser.mockRejectedValue(standardErrorScenarios.databaseError);

				await testApiHandler({
					appHandler,
					params: { id: '2' }, // Use different user ID to avoid self-deletion check
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'DELETE' });
						const json = await response.json();

						expect(response.status).toBe(500);
						expect(json).toEqual({ error: 'Failed to delete user' });
					},
				});
			});
		});
	});
});
