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
jest.mock('@/lib/auth-middleware', () => jest.requireActual('@/lib/test-utils').authMiddlewareMock);

// Mock the copy-on-write functions
jest.mock('@/lib/copy-on-write', () => ({
	cascadeCopyWithContext: jest.fn(),
	cascadeCopyIngredientWithContext: jest.fn(),
	copyIngredientForEdit: jest.fn(),
}));

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
						error: 'Ingredient ID, quantities, and collection ID are required',
						code: 'VALIDATION_ERROR',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 with standardized error for missing collectionId', async () => {
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
							// Missing collectionId
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Ingredient ID, quantities, and collection ID are required',
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
							collectionId: 1,
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
			// Mock getRecipeIngredientInfo returning no rows
			mockExecute.mockResolvedValueOnce([
				[], // No recipe_ingredient found
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
							collectionId: 1,
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
			// Mock getRecipeIngredientInfo returning recipe and ingredient IDs
			mockExecute.mockResolvedValueOnce([
				[{ recipe_id: 1, ingredient_id: 5 }], // Recipe ingredient found
				[],
			]);
			// Mock canEditRecipe check - user owns the recipe
			mockExecute.mockResolvedValueOnce([
				[{ household_id: 1 }], // Recipe owned by user's household
				[],
			]);
			// Mock the UPDATE query
			mockExecute.mockResolvedValueOnce([
				{ affectedRows: 1 }, // Successful update
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
							id: 1,
							quantity: '2 cups',
							quantity4: '500ml',
							measureId: 5,
							collectionId: 1,
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.success).toBe(true);
					expect(data.message).toBe('Ingredient updated successfully');
					expect(data.data).toBeDefined();
					expect(data.data.id).toBe(1);
					expect(data.data.quantity).toBe('2 cups');
					expect(data.data.quantity4).toBe('500ml');
					expect(data.data.measureId).toBe(5);
					// Additional fields added by the new implementation
					expect(data.data.actionsTaken).toEqual([]);
					expect(data.data.redirectNeeded).toBe(false);

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
							collectionId: 1,
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
							collectionId: 1,
							// Missing ingredientId and quantity4
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Recipe ID, ingredient ID, quantities, and collection ID are required',
						code: 'VALIDATION_ERROR',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 with standardized error for missing collectionId', async () => {
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
							// Missing collectionId
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Recipe ID, ingredient ID, quantities, and collection ID are required',
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
							collectionId: 1,
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
							collectionId: 1,
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
							collectionId: 1,
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
			// Mock canEditRecipe check - user owns the recipe
			mockExecute.mockResolvedValueOnce([
				[{ household_id: 1 }], // Recipe owned by user's household
				[],
			]);
			// Mock canEditIngredient check - user owns the ingredient
			mockExecute.mockResolvedValueOnce([
				[{ household_id: 1 }], // Ingredient owned by user's household
				[],
			]);
			// Mock the INSERT query
			mockExecute.mockResolvedValueOnce([
				{ insertId: 42 }, // Successful insert
				[],
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
							collectionId: 1,
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.success).toBe(true);
					expect(data.message).toBe('Ingredient added successfully');
					expect(data.data).toBeDefined();
					expect(data.data.id).toBe(42);
					expect(data.data.recipeId).toBe(1);
					expect(data.data.ingredientId).toBe(5);
					expect(data.data.quantity).toBe('3 cups');
					expect(data.data.quantity4).toBe('750ml');
					expect(data.data.measureId).toBe(10);
					expect(data.data.preparationId).toBe(2);
					// Additional fields added by the new implementation
					expect(data.data.actionsTaken).toEqual([]);
					expect(data.data.redirectNeeded).toBe(false);

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
							collectionId: 1,
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
		it('should return 400 with standardized error for missing collectionId', async () => {
			await testApiHandler({
				appHandler,
				url: '/api/recipe/ingredients?id=1',
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Ingredient ID and collection ID are required',
						code: 'VALIDATION_ERROR',
					});
				},
			});
		});

		it('should return 400 with standardized error for invalid ID format', async () => {
			await testApiHandler({
				appHandler,
				url: '/api/recipe/ingredients?id=not-a-number&collectionId=1',
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
			// Mock getRecipeIngredientInfo returning no rows
			mockExecute.mockResolvedValueOnce([
				[], // No recipe_ingredient found
				[],
			]);

			await testApiHandler({
				appHandler,
				url: '/api/recipe/ingredients?id=999&collectionId=1',
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
			// Mock getRecipeIngredientInfo returning recipe and ingredient IDs
			mockExecute.mockResolvedValueOnce([
				[{ recipe_id: 1, ingredient_id: 5 }], // Recipe ingredient found
				[],
			]);
			// Mock canEditRecipe check - user owns the recipe
			mockExecute.mockResolvedValueOnce([
				[{ household_id: 1 }], // Recipe owned by user's household
				[],
			]);
			// Mock the DELETE query
			mockExecute.mockResolvedValueOnce([
				{ affectedRows: 1 }, // Successful delete
				[],
			]);

			await testApiHandler({
				appHandler,
				url: '/api/recipe/ingredients?id=1&collectionId=1',
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.success).toBe(true);
					expect(data.message).toBe('Ingredient removed successfully');
					expect(data.data).toBeDefined();
					expect(data.data.deletedId).toBe(1);
					// Additional fields added by the new implementation
					expect(data.data.actionsTaken).toEqual([]);
					expect(data.data.redirectNeeded).toBe(false);

					// Verify database call was made with correct parameters
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM recipe_ingredients'), [1]);
				},
			});
		});

		it('should return 401 for unauthenticated users', async () => {
			await testApiHandler({
				appHandler,
				url: '/api/recipe/ingredients?id=1&collectionId=1',
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
