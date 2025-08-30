/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import { NextResponse } from 'next/server';
import * as appHandler from './route';
import { setupConsoleMocks, mockRegularSession } from '@/lib/test-utils';
import { requireAuth } from '@/lib/auth/helpers';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Mock dependencies
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
	getConnection: jest.fn(),
	end: jest.fn(),
}));

// Mock OAuth auth helpers
jest.mock('@/lib/auth/helpers', () => ({
	requireAuth: jest.fn(),
}));

jest.mock('@/lib/permissions', () => ({
	canEditResource: jest.fn(),
}));

// Get mocked functions
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);
const mockCanEditResource = jest.mocked(jest.requireMock('@/lib/permissions').canEditResource);
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

describe('/api/ingredients/delete', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();
		mockCanEditResource.mockReset();

		// Setup default OAuth auth response
		mockRequireAuth.mockResolvedValue({
			authorized: true as const,
			session: mockRegularSession,
			household_id: mockRegularSession.user.household_id,
			user_id: mockRegularSession.user.id,
		});
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('Authentication Tests', () => {
		it('should return 401 for unauthenticated requests', async () => {
			// Mock auth failure
			mockRequireAuth.mockResolvedValueOnce({
				authorized: false as const,
				response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
			});

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						body: JSON.stringify({ id: 1 }),
						headers: { 'Content-Type': 'application/json' },
					});

					expect(response.status).toBe(401);
					const data = await response.json();
					expect(data).toEqual({
						error: 'Unauthorized',
					});
				},
			});
		});
	});

	describe('Validation Tests', () => {
		it('should return 400 when ingredient ID is missing', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						body: JSON.stringify({}),
						headers: { 'Content-Type': 'application/json' },
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Ingredient ID is required',
						code: 'MISSING_INGREDIENT_ID',
					});
				},
			});
		});

		it('should return 400 when ingredient ID is null', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						body: JSON.stringify({ id: null }),
						headers: { 'Content-Type': 'application/json' },
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Ingredient ID is required',
						code: 'MISSING_INGREDIENT_ID',
					});
				},
			});
		});

		it('should return 400 when ingredient ID is undefined', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						body: JSON.stringify({ id: undefined }),
						headers: { 'Content-Type': 'application/json' },
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Ingredient ID is required',
						code: 'MISSING_INGREDIENT_ID',
					});
				},
			});
		});
	});

	describe('Permission Tests', () => {
		it('should return 403 when user cannot edit the ingredient', async () => {
			mockCanEditResource.mockResolvedValue(false);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						body: JSON.stringify({ id: 1 }),
						headers: { 'Content-Type': 'application/json' },
					});

					expect(response.status).toBe(403);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'You can only delete ingredients owned by your household',
						code: 'PERMISSION_DENIED',
					});
					expect(mockCanEditResource).toHaveBeenCalledWith(1, 'ingredients', 1);
				},
			});
		});

		it('should check permissions with correct parameters', async () => {
			mockCanEditResource.mockResolvedValue(false);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					await fetch({
						method: 'DELETE',
						body: JSON.stringify({ id: 999 }),
						headers: { 'Content-Type': 'application/json' },
					});

					expect(mockCanEditResource).toHaveBeenCalledWith(1, 'ingredients', 999);
				},
			});
		});
	});

	describe('Business Logic Tests', () => {
		beforeEach(() => {
			mockCanEditResource.mockResolvedValue(true);
		});

		it('should return 400 when ingredient is used in one recipe', async () => {
			mockExecute.mockResolvedValueOnce([[{ count: 1 } as RowDataPacket], []]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						body: JSON.stringify({ id: 1 }),
						headers: { 'Content-Type': 'application/json' },
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Cannot delete ingredient: it is used in 1 recipe',
						code: 'INGREDIENT_IN_USE',
						count: 1,
					});
				},
			});
		});

		it('should return 400 when ingredient is used in multiple recipes', async () => {
			mockExecute.mockResolvedValueOnce([[{ count: 3 } as RowDataPacket], []]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						body: JSON.stringify({ id: 1 }),
						headers: { 'Content-Type': 'application/json' },
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Cannot delete ingredient: it is used in 3 recipes',
						code: 'INGREDIENT_IN_USE',
						count: 3,
					});
				},
			});
		});

		it('should execute recipe usage query with correct parameters', async () => {
			mockExecute.mockResolvedValueOnce([[{ count: 0 } as RowDataPacket], []]);
			mockExecute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader, []]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					await fetch({
						method: 'DELETE',
						body: JSON.stringify({ id: 42 }),
						headers: { 'Content-Type': 'application/json' },
					});

					expect(mockExecute).toHaveBeenNthCalledWith(
						1,
						`SELECT COUNT(*) as count \n\t\t\t FROM recipe_ingredients ri\n\t\t\t JOIN recipes r ON ri.recipe_id = r.id\n\t\t\t WHERE ri.ingredient_id = ? AND r.household_id = ?`,
						[42, 1]
					);
				},
			});
		});

		it('should successfully delete unused ingredient', async () => {
			mockExecute.mockResolvedValueOnce([[{ count: 0 } as RowDataPacket], []]);
			mockExecute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader, []]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						body: JSON.stringify({ id: 1 }),
						headers: { 'Content-Type': 'application/json' },
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.success).toBe(true);
					expect(data.message).toBe('Ingredient deleted successfully');
				},
			});
		});

		it('should execute delete query with household isolation', async () => {
			mockExecute.mockResolvedValueOnce([[{ count: 0 } as RowDataPacket], []]);
			mockExecute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader, []]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					await fetch({
						method: 'DELETE',
						body: JSON.stringify({ id: 99 }),
						headers: { 'Content-Type': 'application/json' },
					});

					expect(mockExecute).toHaveBeenNthCalledWith(2, `DELETE FROM ingredients WHERE id = ? AND household_id = ?`, [99, 1]);
				},
			});
		});

		it('should return 404 when ingredient not found or cannot be deleted', async () => {
			mockExecute.mockResolvedValueOnce([[{ count: 0 } as RowDataPacket], []]);
			mockExecute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader, []]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						body: JSON.stringify({ id: 999 }),
						headers: { 'Content-Type': 'application/json' },
					});

					expect(response.status).toBe(404);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Ingredient not found',
						code: 'INGREDIENT_NOT_FOUND',
					});
				},
			});
		});
	});

	describe('Error Handling Tests', () => {
		beforeEach(() => {
			mockCanEditResource.mockResolvedValue(true);
		});

		it('should return 500 when canEditResource throws an error', async () => {
			mockCanEditResource.mockRejectedValue(new Error('Permission check failed'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						body: JSON.stringify({ id: 1 }),
						headers: { 'Content-Type': 'application/json' },
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Permission check failed',
						code: 'PERMISSION_CHECK_FAILED',
					});
				},
			});
		});

		it('should return 500 when recipe usage query fails', async () => {
			mockExecute.mockRejectedValueOnce(new Error('Database connection failed'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						body: JSON.stringify({ id: 1 }),
						headers: { 'Content-Type': 'application/json' },
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Database connection failed',
						code: 'DATABASE_ERROR',
					});
				},
			});
		});

		it('should return 500 when delete query fails', async () => {
			mockExecute.mockResolvedValueOnce([[{ count: 0 } as RowDataPacket], []]);
			mockExecute.mockRejectedValueOnce(new Error('Delete operation failed'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						body: JSON.stringify({ id: 1 }),
						headers: { 'Content-Type': 'application/json' },
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Delete operation failed',
						code: 'DATABASE_ERROR',
					});
				},
			});
		});

		it('should return 500 with generic message for non-Error objects', async () => {
			mockCanEditResource.mockRejectedValue('string error');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						body: JSON.stringify({ id: 1 }),
						headers: { 'Content-Type': 'application/json' },
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Failed to delete ingredient',
						code: 'INTERNAL_SERVER_ERROR',
					});
				},
			});
		});

		it('should handle malformed JSON gracefully', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						body: 'invalid json{',
						headers: { 'Content-Type': 'application/json' },
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: expect.stringContaining('Unexpected'),
						code: 'INVALID_JSON',
					});
				},
			});
		});
	});
});
