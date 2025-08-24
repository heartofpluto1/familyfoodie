/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { mockAuthenticatedUser, mockNonAuthenticatedUser, clearAllMocks, setupConsoleMocks } from '@/lib/test-utils';

// Mock the database pool
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
	getConnection: jest.fn(),
}));

// Get the mocked execute function
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);
// Mock the auth middleware to properly handle authentication
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@/lib/auth-middleware', () => require('@/lib/test-utils').authMiddlewareMock);

// mockExecute is already defined above

describe('/api/recipe/ingredients', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		clearAllMocks();
		consoleMocks = setupConsoleMocks();
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('PUT /api/recipe/ingredients', () => {
		it('should return 400 with standardized error for missing required fields', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							id: 1,
							quantity: '2 cups',
							// Missing quantity4
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Ingredient ID and quantities are required',
						code: 'VALIDATION_ERROR',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 with standardized error for invalid ID type', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							id: 'not-a-number',
							quantity: '2 cups',
							quantity4: '500ml',
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Invalid ingredient ID format',
						code: 'VALIDATION_ERROR',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 404 when ingredient does not exist', async () => {
			mockExecute.mockResolvedValueOnce([
				{ affectedRows: 0 }, // No rows updated - ingredient not found
				[],
			]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							id: 999,
							quantity: '2 cups',
							quantity4: '500ml',
						}),
					});

					expect(response.status).toBe(404);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Recipe ingredient not found',
						code: 'INGREDIENT_NOT_FOUND',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should successfully update recipe ingredient', async () => {
			mockExecute.mockResolvedValueOnce([
				{ affectedRows: 1 }, // Successful update
				[], // fields array (second element of mysql2 result)
			]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							id: 1,
							quantity: '2 cups',
							quantity4: '500ml',
							measureId: 5,
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Ingredient updated successfully',
						data: {
							id: 1,
							quantity: '2 cups',
							quantity4: '500ml',
							measureId: 5,
						},
					});

					// Verify database call
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipe_ingredients'), ['2 cups', '500ml', 5, 1]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 401 with standardized error for unauthenticated users', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							id: 1,
							quantity: '2 cups',
							quantity4: '500ml',
						}),
					});

					expect(response.status).toBe(401);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Authentication required',
						code: 'UNAUTHORIZED',
					});
				},
				requestPatcher: mockNonAuthenticatedUser,
			});
		});
	});

	describe('POST /api/recipe/ingredients', () => {
		it('should return 400 with standardized error for missing required fields', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 1,
							quantity: '3 cups',
							// Missing ingredientId and quantity4
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Recipe ID, ingredient ID, and quantities are required',
						code: 'VALIDATION_ERROR',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 with standardized error for empty quantities', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 1,
							ingredientId: 5,
							quantity: '',
							quantity4: '750ml',
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Quantity cannot be empty',
						code: 'VALIDATION_ERROR',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 when recipe does not exist', async () => {
			// Mock foreign key constraint violation
			mockExecute.mockRejectedValueOnce(new Error('FOREIGN KEY constraint failed'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 999, // Non-existent recipe
							ingredientId: 5,
							quantity: '3 cups',
							quantity4: '750ml',
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Recipe not found',
						code: 'INVALID_RECIPE_ID',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 409 when ingredient already exists in recipe', async () => {
			// Mock duplicate key constraint violation
			mockExecute.mockRejectedValueOnce(new Error('UNIQUE constraint failed'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 1,
							ingredientId: 5,
							quantity: '3 cups',
							quantity4: '750ml',
						}),
					});

					expect(response.status).toBe(409);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Ingredient already exists in this recipe',
						code: 'DUPLICATE_INGREDIENT',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should successfully add recipe ingredient with all fields', async () => {
			mockExecute.mockResolvedValueOnce([
				{ insertId: 42 }, // Successful insert
				[], // fields array (second element of mysql2 result)
			]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 1,
							ingredientId: 5,
							quantity: '3 cups',
							quantity4: '750ml',
							measureId: 10,
							preparationId: 2,
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Ingredient added successfully',
						data: {
							id: 42,
							recipeId: 1,
							ingredientId: 5,
							quantity: '3 cups',
							quantity4: '750ml',
							measureId: 10,
							preparationId: 2,
						},
					});

					// Verify database call with all parameters including primaryIngredient as 0
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO recipe_ingredients'), [1, 5, '3 cups', '750ml', 10, 2, 0]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 401 with standardized error for unauthenticated users', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 1,
							ingredientId: 1,
							quantity: '1 cup',
							quantity4: '250ml',
						}),
					});

					expect(response.status).toBe(401);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Authentication required',
						code: 'UNAUTHORIZED',
					});
				},
				requestPatcher: mockNonAuthenticatedUser,
			});
		});
	});

	describe('DELETE /api/recipe/ingredients', () => {
		it('should return 400 with standardized error for invalid ID format', async () => {
			await testApiHandler({
				appHandler,
				url: '/api/recipe/ingredients?id=not-a-number',
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Invalid ingredient ID format',
						code: 'VALIDATION_ERROR',
					});
				},
			});
		});

		it('should return 404 when ingredient does not exist', async () => {
			mockExecute.mockResolvedValueOnce([
				{ affectedRows: 0 }, // No rows deleted - ingredient not found
			]);

			await testApiHandler({
				appHandler,
				url: '/api/recipe/ingredients?id=999',
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
					});

					expect(response.status).toBe(404);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Recipe ingredient not found',
						code: 'INGREDIENT_NOT_FOUND',
					});
				},
			});
		});

		it('should successfully delete recipe ingredient', async () => {
			mockExecute.mockResolvedValueOnce([
				{ affectedRows: 1 }, // Successful delete
			]);

			await testApiHandler({
				appHandler,
				url: '/api/recipe/ingredients?id=1',
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Ingredient removed successfully',
						data: {
							deletedId: 1,
						},
					});

					// Verify database call was made with correct parameters
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM recipe_ingredients'), [1]);
				},
			});
		});

		it('should return 401 for unauthenticated users', async () => {
			await testApiHandler({
				appHandler,
				url: '/api/recipe/ingredients?id=1',
				requestPatcher: mockNonAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
					});

					expect(response.status).toBe(401);
				},
			});
		});
	});
});
