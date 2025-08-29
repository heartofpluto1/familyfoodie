/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { requireAdminUser } from '@/lib/auth-helpers';
import { getUserById, updateUser, deleteUser } from '@/lib/queries/admin/users';
import { setupConsoleMocks, standardErrorScenarios, mockAdminUser } from '@/lib/test-utils';
import type { User, UserUpdate } from '@/types/user';

// Mock the auth helpers
jest.mock('@/lib/auth-helpers', () => ({
	requireAdminUser: jest.fn(),
}));

// Mock the auth middleware to pass through for testing
jest.mock('@/lib/auth-middleware', () => jest.requireActual('@/lib/test-utils').passthroughAuthMock);

// Mock the user queries
jest.mock('@/lib/queries/admin/users', () => ({
	getUserById: jest.fn(),
	updateUser: jest.fn(),
	deleteUser: jest.fn(),
}));

// Type assertions for mocked modules
const mockRequireAdminUser = requireAdminUser as jest.MockedFunction<typeof requireAdminUser>;
const mockGetUserById = getUserById as jest.MockedFunction<typeof getUserById>;
const mockUpdateUser = updateUser as jest.MockedFunction<typeof updateUser>;
const mockDeleteUser = deleteUser as jest.MockedFunction<typeof deleteUser>;

// Test data
const mockUser: User = {
	id: 1,
	username: 'testuser',
	first_name: 'Test',
	last_name: 'User',
	email: 'test@example.com',
	is_active: true,
	is_admin: false,
	date_joined: '2024-01-01T00:00:00Z',
	last_login: '2024-01-02T00:00:00Z',
};

// Create a custom admin user with ID 2 to avoid self-modification conflicts
const testAdminUser = { ...mockAdminUser, id: 2 };

describe('/api/admin/users/[id]', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('GET /api/admin/users/[id]', () => {
		describe('Authentication & Authorization', () => {
			it('returns 403 for non-admin users', async () => {
				mockRequireAdminUser.mockResolvedValue(null);

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
				mockRequireAdminUser.mockRejectedValue(standardErrorScenarios.authError);

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

		describe('Input Validation', () => {
			it('returns 400 for invalid user ID', async () => {
				mockRequireAdminUser.mockResolvedValue(testAdminUser);

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

			it('returns 400 for non-numeric user ID', async () => {
				mockRequireAdminUser.mockResolvedValue(testAdminUser);

				await testApiHandler({
					appHandler,
					params: { id: 'abc123' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(400);
						expect(json).toEqual({ error: 'Invalid user ID' });
					},
				});
			});

			it('handles decimal user ID by converting to integer', async () => {
				mockRequireAdminUser.mockResolvedValue(testAdminUser);
				mockGetUserById.mockResolvedValue(mockUser);

				await testApiHandler({
					appHandler,
					params: { id: '1.5' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({ user: mockUser });
						expect(mockGetUserById).toHaveBeenCalledWith(1);
					},
				});
			});
		});

		describe('Success Path', () => {
			it('returns user data for valid admin request', async () => {
				mockRequireAdminUser.mockResolvedValue(testAdminUser);
				mockGetUserById.mockResolvedValue(mockUser);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({ user: mockUser });
						expect(mockRequireAdminUser).toHaveBeenCalled();
						expect(mockGetUserById).toHaveBeenCalledWith(1);
					},
				});
			});

			it('returns 404 when user not found', async () => {
				mockRequireAdminUser.mockResolvedValue(testAdminUser);
				mockGetUserById.mockResolvedValue(null);

				await testApiHandler({
					appHandler,
					params: { id: '999' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();

						expect(response.status).toBe(404);
						expect(json).toEqual({ error: 'User not found' });
					},
				});
			});
		});

		describe('Error Handling', () => {
			it('returns 500 when database error occurs', async () => {
				mockRequireAdminUser.mockResolvedValue(testAdminUser);
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
		describe('Authentication & Authorization', () => {
			it('returns 403 for non-admin users', async () => {
				mockRequireAdminUser.mockResolvedValue(null);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ first_name: 'Test' }),
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
				mockRequireAdminUser.mockResolvedValue(testAdminUser);

				await testApiHandler({
					appHandler,
					params: { id: 'invalid' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ first_name: 'Test' }),
						});
						const json = await response.json();

						expect(response.status).toBe(400);
						expect(json).toEqual({ error: 'Invalid user ID' });
						expect(mockUpdateUser).not.toHaveBeenCalled();
					},
				});
			});

			it('prevents admin from modifying their own is_admin privilege', async () => {
				const selfAdminUser = { ...mockAdminUser, id: 1 };
				mockRequireAdminUser.mockResolvedValue(selfAdminUser);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
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

			it('prevents admin from modifying their own is_active status', async () => {
				const selfAdminUser = { ...mockAdminUser, id: 1 };
				mockRequireAdminUser.mockResolvedValue(selfAdminUser);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ is_active: false }),
						});
						const json = await response.json();

						expect(response.status).toBe(400);
						expect(json).toEqual({ error: 'Cannot modify your own privileges' });
						expect(mockUpdateUser).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Success Path', () => {
			it('updates user successfully', async () => {
				const updates: UserUpdate = {
					first_name: 'Updated',
					last_name: 'Name',
					email: 'updated@example.com',
				};

				const updatedUser = { ...mockUser, ...updates };

				mockRequireAdminUser.mockResolvedValue(testAdminUser);
				mockUpdateUser.mockResolvedValue(true);
				mockGetUserById.mockResolvedValue(updatedUser);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(updates),
						});
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							message: 'User updated successfully',
							user: updatedUser,
						});
						expect(mockUpdateUser).toHaveBeenCalledWith(1, updates);
						expect(mockGetUserById).toHaveBeenCalledWith(1);
					},
				});
			});

			it('updates user with boolean fields', async () => {
				const updates: UserUpdate = {
					is_active: false,
					is_admin: true,
				};

				const updatedUser = { ...mockUser, ...updates };

				mockRequireAdminUser.mockResolvedValue(testAdminUser);
				mockUpdateUser.mockResolvedValue(true);
				mockGetUserById.mockResolvedValue(updatedUser);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(updates),
						});
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							message: 'User updated successfully',
							user: updatedUser,
						});
						expect(mockUpdateUser).toHaveBeenCalledWith(1, updates);
					},
				});
			});

			it('allows admin to modify their own non-privilege fields', async () => {
				const selfAdminUser = { ...mockAdminUser, id: 1 };
				mockRequireAdminUser.mockResolvedValue(selfAdminUser);

				const updates: UserUpdate = {
					first_name: 'Updated',
					email: 'newemail@example.com',
				};

				const updatedUser = { ...mockUser, id: 1, ...updates };

				mockUpdateUser.mockResolvedValue(true);
				mockGetUserById.mockResolvedValue(updatedUser);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(updates),
						});
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							message: 'User updated successfully',
							user: updatedUser,
						});
						expect(mockUpdateUser).toHaveBeenCalledWith(1, updates);
					},
				});
			});

			it('handles empty update object', async () => {
				mockRequireAdminUser.mockResolvedValue(testAdminUser);
				mockUpdateUser.mockResolvedValue(true);
				mockGetUserById.mockResolvedValue(mockUser);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({}),
						});
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							message: 'User updated successfully',
							user: mockUser,
						});
						expect(mockUpdateUser).toHaveBeenCalledWith(1, {});
					},
				});
			});
		});

		describe('Error Handling', () => {
			it('returns 500 when updateUser fails', async () => {
				mockRequireAdminUser.mockResolvedValue(testAdminUser);
				mockUpdateUser.mockRejectedValue(standardErrorScenarios.databaseError);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ first_name: 'Test' }),
						});
						const json = await response.json();

						expect(response.status).toBe(500);
						expect(json).toEqual({ error: 'Failed to update user' });
					},
				});
			});

			it('returns 500 when getUserById fails after update', async () => {
				mockRequireAdminUser.mockResolvedValue(testAdminUser);
				mockUpdateUser.mockResolvedValue(true);
				mockGetUserById.mockRejectedValue(standardErrorScenarios.databaseError);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ first_name: 'Test' }),
						});
						const json = await response.json();

						expect(response.status).toBe(500);
						expect(json).toEqual({ error: 'Failed to update user' });
					},
				});
			});

			it('returns 500 when JSON parsing fails', async () => {
				mockRequireAdminUser.mockResolvedValue(testAdminUser);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: 'invalid json',
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
				mockRequireAdminUser.mockResolvedValue(null);

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
				mockRequireAdminUser.mockResolvedValue(testAdminUser);

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

			it('prevents admin from deleting their own account', async () => {
				const selfAdminUser = { ...mockAdminUser, id: 1 };
				mockRequireAdminUser.mockResolvedValue(selfAdminUser);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
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

		describe('Success Path', () => {
			it('deletes user successfully', async () => {
				mockRequireAdminUser.mockResolvedValue(testAdminUser);
				mockDeleteUser.mockResolvedValue(true);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'DELETE' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							message: 'User deleted successfully',
						});
						expect(mockDeleteUser).toHaveBeenCalledWith(1);
					},
				});
			});

			it('allows admin to delete other users', async () => {
				mockRequireAdminUser.mockResolvedValue(testAdminUser); // admin has id: 2
				mockDeleteUser.mockResolvedValue(true);

				await testApiHandler({
					appHandler,
					params: { id: '1' }, // deleting user with id: 1
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'DELETE' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							message: 'User deleted successfully',
						});
						expect(mockDeleteUser).toHaveBeenCalledWith(1);
					},
				});
			});
		});

		describe('Error Handling', () => {
			it('returns 500 when deleteUser fails', async () => {
				mockRequireAdminUser.mockResolvedValue(testAdminUser);
				mockDeleteUser.mockRejectedValue(standardErrorScenarios.databaseError);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'DELETE' });
						const json = await response.json();

						expect(response.status).toBe(500);
						expect(json).toEqual({ error: 'Failed to delete user' });
					},
				});
			});

			it('handles requireAdminUser throwing error', async () => {
				mockRequireAdminUser.mockRejectedValue(standardErrorScenarios.authError);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
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

	describe('Edge Cases', () => {
		it('handles very large user ID', async () => {
			mockRequireAdminUser.mockResolvedValue(testAdminUser);
			mockGetUserById.mockResolvedValue(null);

			await testApiHandler({
				appHandler,
				params: { id: '999999999' },
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'GET' });
					const json = await response.json();

					expect(response.status).toBe(404);
					expect(json).toEqual({ error: 'User not found' });
					expect(mockGetUserById).toHaveBeenCalledWith(999999999);
				},
			});
		});

		it('handles scientific notation in user ID', async () => {
			mockRequireAdminUser.mockResolvedValue(testAdminUser);
			mockGetUserById.mockResolvedValue(null);

			await testApiHandler({
				appHandler,
				params: { id: '1e2' }, // 100 in scientific notation
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'GET' });
					await response.json();

					// parseInt('1e2') actually returns 1, not 100
					// This is expected behavior - scientific notation is not properly parsed by parseInt
					expect(response.status).toBe(404);
					expect(mockGetUserById).toHaveBeenCalledWith(1);
				},
			});
		});

		it('handles user ID with leading/trailing spaces', async () => {
			mockRequireAdminUser.mockResolvedValue(testAdminUser);
			mockGetUserById.mockResolvedValue(mockUser);

			await testApiHandler({
				appHandler,
				params: { id: ' 1 ' }, // User ID with spaces
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'GET' });
					await response.json();

					expect(response.status).toBe(200);
					expect(mockGetUserById).toHaveBeenCalledWith(1);
				},
			});
		});

		it('handles null values in PATCH update', async () => {
			mockRequireAdminUser.mockResolvedValue(testAdminUser);
			mockUpdateUser.mockResolvedValue(true);
			mockGetUserById.mockResolvedValue(mockUser);

			const updates = {
				first_name: null,
				last_name: 'Valid',
			};

			await testApiHandler({
				appHandler,
				params: { id: '1' },
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(updates),
					});

					expect(response.status).toBe(200);
					expect(mockUpdateUser).toHaveBeenCalledWith(1, updates);
				},
			});
		});
	});
});
