/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { mockAuthenticatedUser, mockNonAuthenticatedUser, MockConnection } from '@/lib/test-utils';

// Setup standard mocks
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
	getConnection: jest.fn(),
	end: jest.fn(),
}));

jest.mock('@/lib/auth-middleware', () => jest.requireActual('@/lib/test-utils').authMiddlewareMock);

jest.mock('@/lib/utils/secureFilename.server', () => ({
	cleanupRecipeFiles: jest.fn(),
	findAndDeleteHashFiles: jest.fn(),
}));

// Mock permissions module
jest.mock('@/lib/permissions', () => ({
	canEditResource: jest.fn(),
}));

// Get the mocked functions
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);
const mockGetConnection = jest.mocked(jest.requireMock('@/lib/db.js').getConnection);
const mockCleanupRecipeFiles = jest.mocked(jest.requireMock('@/lib/utils/secureFilename.server').cleanupRecipeFiles);
const mockCanEditResource = jest.mocked(jest.requireMock('@/lib/permissions').canEditResource);

describe('/api/recipe/delete', () => {
	let mockConnection: MockConnection;

	beforeEach(() => {
		jest.clearAllMocks();

		// Setup mock connection object
		mockConnection = {
			beginTransaction: jest.fn().mockResolvedValue(undefined),
			commit: jest.fn().mockResolvedValue(undefined),
			rollback: jest.fn().mockResolvedValue(undefined),
			release: jest.fn().mockResolvedValue(undefined),
			execute: jest.fn(),
		};

		mockGetConnection.mockResolvedValue(mockConnection);

		// Reset mocks - each test will set its own expectations
		mockCanEditResource.mockReset();
		mockCleanupRecipeFiles.mockReset();
	});

	describe('DELETE /api/recipe/delete', () => {
		it('should successfully delete recipe with no dependencies when user owns recipe', async () => {
			// Mock permissions: user owns the recipe
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock pool.execute calls (the initial checks before transaction)
			mockExecute
				.mockResolvedValueOnce([[{ id: 1, image_filename: 'recipe_123.jpg', pdf_filename: 'recipe_123.pdf' }], []]) // Recipe lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No planned weeks
				.mockResolvedValueOnce([[{ count: 0 }], []]); // No shopping list history

			// Mock connection.execute calls (inside transaction)
			mockConnection.execute = jest
				.fn()
				.mockResolvedValueOnce([[{ ingredient_id: 5 }, { ingredient_id: 7 }], []]) // Recipe ingredients
				.mockResolvedValueOnce([[{ count: 0 }], []]) // Safety check - no shopping list references
				.mockResolvedValueOnce([{ affectedRows: 2 }, []]) // Delete recipe ingredients
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Delete recipe
				.mockResolvedValueOnce([[{ count: 0 }], []]) // Check ingredient 5 usage - not used
				.mockResolvedValueOnce([[{ count: 0 }], []]) // Check ingredient 5 shopping list usage
				.mockResolvedValueOnce([[{ name: 'Tomato' }], []]) // Get ingredient 5 name
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Delete ingredient 5
				.mockResolvedValueOnce([[{ count: 1 }], []]) // Check ingredient 7 usage - still used
				.mockResolvedValueOnce([[{ count: 0 }], []]); // Check ingredient 7 shopping lists

			mockCleanupRecipeFiles.mockResolvedValue('Cleaned up 2 files');

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: 1 }),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toMatchObject({
						success: true,
						deletedIngredientsCount: 1,
						deletedIngredientNames: ['Tomato'],
					});
					expect(data.message).toContain('Recipe deleted successfully');
					expect(data.message).toContain('cleaned up 1 unused ingredient');

					// Verify permission check was called
					expect(mockCanEditResource).toHaveBeenCalledWith(
						expect.any(Number), // household_id from auth
						'recipes',
						1
					);

					// Verify transaction handling
					expect(mockConnection.beginTransaction).toHaveBeenCalled();
					expect(mockConnection.commit).toHaveBeenCalled();
					expect(mockConnection.release).toHaveBeenCalled();

					// Verify file cleanup
					expect(mockCleanupRecipeFiles).toHaveBeenCalledWith('recipe_123.jpg', 'recipe_123.pdf');
				},
			});
		});

		it('should return 403 when user does not own recipe', async () => {
			// Mock permissions: user does NOT own the recipe
			mockCanEditResource.mockResolvedValueOnce(false);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: 1 }),
					});

					expect(response.status).toBe(403);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'You can only delete recipes owned by your household',
						code: 'PERMISSION_DENIED',
					});

					// Verify permission check was called
					expect(mockCanEditResource).toHaveBeenCalledWith(
						expect.any(Number), // household_id from auth
						'recipes',
						1
					);

					// Verify no database operations were performed
					expect(mockExecute).not.toHaveBeenCalled();
					expect(mockConnection.beginTransaction).not.toHaveBeenCalled();
				},
			});
		});

		it('should return 400 if recipe ID is missing', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					// Consistent error response format
					expect(data).toEqual({
						success: false,
						error: 'Recipe ID is required',
						code: 'MISSING_RECIPE_ID',
					});
				},
			});

			// Ensure no database calls were made
			expect(mockExecute).not.toHaveBeenCalled();
		});

		it('should return 404 if recipe not found', async () => {
			// Mock permissions: user owns the recipe (so we can test the 404 logic)
			mockCanEditResource.mockResolvedValueOnce(true);

			mockExecute.mockResolvedValueOnce([[], []]); // Recipe not found

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: 999 }),
					});

					expect(response.status).toBe(404);
					const data = await response.json();
					// Consistent error response format
					expect(data).toEqual({
						success: false,
						error: 'Recipe not found',
						code: 'RECIPE_NOT_FOUND',
					});
				},
			});
		});

		it('should return 400 if recipe is used in planned weeks', async () => {
			// Mock permissions: user owns the recipe (so we can test the plan checking logic)
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock recipe exists but is used in plans
			mockExecute
				.mockResolvedValueOnce([[{ id: 1, image_filename: 'recipe_123.jpg', pdf_filename: 'recipe_123.pdf' }], []]) // Recipe lookup
				.mockResolvedValueOnce([[{ count: 3 }], []]); // Used in 3 planned weeks

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: 1 }),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					// Consistent error response with count in message
					expect(data).toEqual({
						success: false,
						error: 'Cannot delete recipe: it is used in 3 planned weeks. Remove it from all planned weeks first.',
						code: 'PLANNED_WEEKS_EXIST',
						count: 3,
					});
				},
			});

			// Should not proceed to connection operations
			expect(mockGetConnection).not.toHaveBeenCalled();
		});

		it('should archive recipe instead of deleting when shopping list history exists', async () => {
			// Mock permissions: user owns the recipe
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock recipe exists with shopping list history
			mockExecute
				.mockResolvedValueOnce([[{ id: 1, image_filename: 'recipe_123.jpg', pdf_filename: 'recipe_123.pdf' }], []]) // Recipe lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No planned weeks
				.mockResolvedValueOnce([[{ count: 5 }], []]); // Has shopping list history

			mockConnection.execute
				.mockResolvedValueOnce([{ affectedRows: 1 }]) // Delete from collection_recipes
				.mockResolvedValueOnce([{ affectedRows: 1 }]); // Archive recipe

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: 1 }),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					// Recipe should be archived instead of deleted
					expect(data).toEqual({
						success: true,
						message: 'Recipe archived successfully due to shopping list references',
						archived: true,
						code: 'RECIPE_ARCHIVED',
					});

					// Verify archive UPDATE was called instead of DELETE
					expect(mockConnection.execute).toHaveBeenCalledWith('UPDATE recipes SET archived = 1 WHERE id = ?', [1]);

					// Verify transaction was committed (not rolled back)
					expect(mockConnection.beginTransaction).toHaveBeenCalled();
					expect(mockConnection.commit).toHaveBeenCalled();
					expect(mockConnection.rollback).not.toHaveBeenCalled();
					expect(mockConnection.release).toHaveBeenCalled();
				},
			});
		});

		it('should archive recipe if shopping list references discovered during deletion process', async () => {
			// Mock permissions: user owns the recipe
			mockCanEditResource.mockResolvedValueOnce(true);
			// Mock initial checks pass (no shopping history detected initially)
			mockExecute
				.mockResolvedValueOnce([[{ id: 1, image_filename: 'recipe_123.jpg', pdf_filename: 'recipe_123.pdf' }], []]) // Recipe lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No planned weeks
				.mockResolvedValueOnce([[{ count: 0 }], []]); // No shopping list history initially

			// Mock transaction operations
			mockConnection.execute
				.mockResolvedValueOnce([[{ ingredient_id: 1 }, { ingredient_id: 2 }], []]) // Get recipe ingredients
				.mockResolvedValueOnce([[{ count: 1 }], []]) // Final safety check finds shopping references
				.mockResolvedValueOnce([{ affectedRows: 1 }]) // Delete from collection_recipes
				.mockResolvedValueOnce([{ affectedRows: 1 }]); // Archive UPDATE

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: 1 }),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe archived successfully due to shopping list references detected during deletion',
						archived: true,
						code: 'RECIPE_ARCHIVED',
					});

					// Verify the safety check was performed
					expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*) as count FROM shopping_lists sl'), [1]);

					// Verify collection_recipes cleanup was called
					expect(mockConnection.execute).toHaveBeenCalledWith('DELETE FROM collection_recipes WHERE recipe_id = ?', [1]);

					// Verify archive UPDATE was called
					expect(mockConnection.execute).toHaveBeenCalledWith('UPDATE recipes SET archived = 1 WHERE id = ?', [1]);

					// Verify transaction was committed
					expect(mockConnection.commit).toHaveBeenCalled();
					expect(mockConnection.rollback).not.toHaveBeenCalled();
				},
			});
		});

		it('should handle database error during recipe deletion', async () => {
			// Mock permissions: user owns the recipe
			mockCanEditResource.mockResolvedValueOnce(true);
			// Mock recipe exists with no dependencies
			mockExecute
				.mockResolvedValueOnce([[{ id: 1, image_filename: 'recipe_123.jpg', pdf_filename: 'recipe_123.pdf' }], []]) // Recipe lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No planned weeks
				.mockResolvedValueOnce([[{ count: 0 }], []]); // No shopping list history

			// Mock connection operations with failure
			mockConnection.execute
				.mockResolvedValueOnce([[{ ingredient_id: 5 }], []]) // Recipe ingredients
				.mockResolvedValueOnce([[{ count: 0 }], []]) // Safety check - no shopping list references
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Delete recipe ingredients
				.mockRejectedValueOnce(new Error('Database constraint violation')); // Fail on recipe deletion

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: 1 }),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					// Consistent error response format
					expect(data).toEqual({
						success: false,
						error: 'Database constraint violation',
						code: 'DATABASE_ERROR',
					});

					// Verify transaction was rolled back
					expect(mockConnection.rollback).toHaveBeenCalled();
					expect(mockConnection.release).toHaveBeenCalled();
				},
			});
		});

		it('should handle recipe deletion failure with zero affected rows', async () => {
			// Mock permissions: user owns the recipe
			mockCanEditResource.mockResolvedValueOnce(true);
			// Mock recipe exists with no dependencies
			mockExecute
				.mockResolvedValueOnce([[{ id: 1, image_filename: 'recipe_123.jpg', pdf_filename: 'recipe_123.pdf' }], []]) // Recipe lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No planned weeks
				.mockResolvedValueOnce([[{ count: 0 }], []]); // No shopping list history

			// Mock connection operations
			mockConnection.execute
				.mockResolvedValueOnce([[{ ingredient_id: 5 }], []]) // Recipe ingredients
				.mockResolvedValueOnce([[{ count: 0 }], []]) // Safety check - no shopping list references
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Delete recipe ingredients
				.mockResolvedValueOnce([{ affectedRows: 0 }, []]); // Recipe deletion fails (0 affected rows)

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: 1 }),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					// Consistent error response format
					expect(data).toEqual({
						success: false,
						error: 'Failed to delete recipe from database',
						code: 'SERVER_ERROR', // The route doesn't have a specific DELETE_FAILED code
					});

					// Verify transaction was rolled back
					expect(mockConnection.rollback).toHaveBeenCalled();
					expect(mockConnection.release).toHaveBeenCalled();
				},
			});
		});

		it('should successfully delete recipe and clean up multiple unused ingredients', async () => {
			// Mock permissions: user owns the recipe
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock recipe exists
			mockExecute
				.mockResolvedValueOnce([[{ id: 1, image_filename: 'recipe_123.jpg', pdf_filename: 'recipe_123.pdf' }], []]) // Recipe lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No planned weeks
				.mockResolvedValueOnce([[{ count: 0 }], []]); // No shopping list history

			// Mock connection operations
			mockConnection.execute = jest
				.fn()
				.mockResolvedValueOnce([[{ ingredient_id: 5 }, { ingredient_id: 7 }, { ingredient_id: 9 }], []]) // Recipe ingredients
				.mockResolvedValueOnce([[{ count: 0 }], []]) // Safety check - no shopping list references
				.mockResolvedValueOnce([{ affectedRows: 3 }, []]) // Delete recipe ingredients
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Delete recipe
				// Check ingredient 5 - unused
				.mockResolvedValueOnce([[{ count: 0 }], []]) // Not used in other recipes
				.mockResolvedValueOnce([[{ count: 0 }], []]) // Not used in shopping lists
				.mockResolvedValueOnce([[{ name: 'Tomato' }], []]) // Get ingredient 5 name
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Delete ingredient 5
				// Check ingredient 7 - unused
				.mockResolvedValueOnce([[{ count: 0 }], []]) // Not used in other recipes
				.mockResolvedValueOnce([[{ count: 0 }], []]) // Not used in shopping lists
				.mockResolvedValueOnce([[{ name: 'Onion' }], []]) // Get ingredient 7 name
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Delete ingredient 7
				// Check ingredient 9 - still used
				.mockResolvedValueOnce([[{ count: 2 }], []]) // Used in 2 other recipes
				.mockResolvedValueOnce([[{ count: 0 }], []]); // Check ingredient 9 shopping lists

			mockCleanupRecipeFiles.mockResolvedValue('Cleaned up 2 files');

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: 1 }),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toMatchObject({
						success: true,
						deletedIngredientsCount: 2,
						deletedIngredientNames: ['Tomato', 'Onion'],
					});
					expect(data.message).toContain('cleaned up 2 unused ingredients');
					expect(data.message).toContain('(Tomato, Onion)');
				},
			});
		});

		it('should handle ingredient deletion failure gracefully', async () => {
			// Mock permissions: user owns the recipe
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock recipe exists
			mockExecute
				.mockResolvedValueOnce([[{ id: 1, image_filename: 'recipe_123.jpg', pdf_filename: 'recipe_123.pdf' }], []]) // Recipe lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No planned weeks
				.mockResolvedValueOnce([[{ count: 0 }], []]); // No shopping list history

			// Mock connection operations
			mockConnection.execute
				.mockResolvedValueOnce([[{ ingredient_id: 5 }], []]) // Recipe ingredients
				.mockResolvedValueOnce([[{ count: 0 }], []]) // Safety check - no shopping list references
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Delete recipe ingredients
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Delete recipe
				.mockResolvedValueOnce([[{ count: 0 }], []]) // Check ingredient 5 usage - not used
				.mockResolvedValueOnce([[{ count: 0 }], []]) // Check ingredient 5 shopping list usage
				.mockResolvedValueOnce([[{ name: 'Tomato' }], []]) // Get ingredient 5 name
				.mockResolvedValueOnce([{ affectedRows: 0 }, []]); // Ingredient deletion fails

			mockCleanupRecipeFiles.mockResolvedValue('Cleaned up 2 files');

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: 1 }),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toMatchObject({
						success: true,
						deletedIngredientsCount: 0, // No ingredients actually deleted
						deletedIngredientNames: [],
					});
					expect(data.message).toBe('Recipe deleted successfully');
				},
			});
		});

		it('should handle ingredient name lookup failure', async () => {
			// Mock permissions: user owns the recipe
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock recipe exists
			mockExecute
				.mockResolvedValueOnce([[{ id: 1, image_filename: 'recipe_123.jpg', pdf_filename: 'recipe_123.pdf' }], []]) // Recipe lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No planned weeks
				.mockResolvedValueOnce([[{ count: 0 }], []]); // No shopping list history

			// Mock connection operations
			mockConnection.execute
				.mockResolvedValueOnce([[{ ingredient_id: 5 }], []]) // Recipe ingredients
				.mockResolvedValueOnce([[{ count: 0 }], []]) // Safety check - no shopping list references
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Delete recipe ingredients
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Delete recipe
				.mockResolvedValueOnce([[{ count: 0 }], []]) // Check ingredient 5 usage - not used
				.mockResolvedValueOnce([[{ count: 0 }], []]) // Check ingredient 5 shopping list usage
				.mockResolvedValueOnce([[], []]); // Get ingredient 5 name - empty result (ingredient doesn't exist)

			mockCleanupRecipeFiles.mockResolvedValue('Cleaned up 2 files');

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: 1 }),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toMatchObject({
						success: true,
						deletedIngredientsCount: 0, // No ingredients deleted because name lookup failed
						deletedIngredientNames: [],
					});
					expect(data.message).toBe('Recipe deleted successfully');
				},
			});
		});

		it('should return 401 for unauthenticated users', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockNonAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: 1 }),
					});

					expect(response.status).toBe(401);
				},
			});
		});

		it('should handle file cleanup failure gracefully', async () => {
			// Mock permissions: user owns the recipe
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock recipe exists
			mockExecute
				.mockResolvedValueOnce([[{ id: 1, image_filename: 'recipe_123.jpg', pdf_filename: 'recipe_123.pdf' }], []]) // Recipe lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No planned weeks
				.mockResolvedValueOnce([[{ count: 0 }], []]); // No shopping list history

			// Mock connection operations - simple case with no ingredients to check
			mockConnection.execute = jest
				.fn()
				.mockResolvedValueOnce([[], []]) // No recipe ingredients
				.mockResolvedValueOnce([[{ count: 0 }], []]) // Safety check - no shopping list references
				.mockResolvedValueOnce([{ affectedRows: 0 }, []]) // Delete recipe ingredients (no ingredients to delete)
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // Delete recipe successfully

			// Mock file cleanup failure - this should not affect the response
			mockCleanupRecipeFiles.mockRejectedValue(new Error('File system error'));

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: 1 }),
					});

					// File cleanup failure should NOT cause the entire operation to fail
					// Recipe deletion succeeded, so return 200 with a warning
					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe deleted successfully',
						warning: 'File cleanup failed: File system error',
						deletedIngredientsCount: 0,
						deletedIngredientNames: [],
					});
				},
			});
		});

		it('should handle invalid JSON payload', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: 'invalid-json',
					});

					expect(response.status).toBe(400); // Should be 400, not 500
					const data = await response.json();
					// User-friendly error message instead of raw parser error
					expect(data).toEqual({
						success: false,
						error: 'Invalid JSON in request body',
						code: 'INVALID_JSON',
					});
				},
			});
		});

		it('should handle string recipeId by parsing it', async () => {
			// Mock permissions: user owns the recipe
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock recipe exists
			mockExecute
				.mockResolvedValueOnce([[{ id: 1, image_filename: 'recipe_123.jpg', pdf_filename: 'recipe_123.pdf' }], []]) // Recipe lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No planned weeks
				.mockResolvedValueOnce([[{ count: 0 }], []]); // No shopping list history

			// Mock connection operations - no ingredients to process
			let callCount = 0;
			const responses = [
				[[], []], // No recipe ingredients
				[[{ count: 0 }], []], // Safety check - no shopping list references
				[{ affectedRows: 0 }, []], // Delete recipe ingredients
				[{ affectedRows: 1 }, []], // Delete recipe
			];

			mockConnection.execute = jest.fn().mockImplementation(async () => {
				const response = responses[callCount++];
				return response;
			});

			mockCleanupRecipeFiles.mockResolvedValue('Cleaned up 2 files');

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: '1' }), // String instead of number
					});

					expect(response.status).toBe(200);

					// Verify parseInt was used correctly in database calls
					expect(mockExecute).toHaveBeenCalledWith(
						expect.any(String),
						[1] // Should be parsed to number
					);
				},
			});
		});
	});

	describe('Edge cases and error handling', () => {
		it('should handle connection pool exhaustion', async () => {
			// Mock permissions: user owns the recipe
			mockCanEditResource.mockResolvedValueOnce(true);
			// Mock recipe exists
			mockExecute
				.mockResolvedValueOnce([[{ id: 1, image_filename: 'recipe_123.jpg', pdf_filename: 'recipe_123.pdf' }], []]) // Recipe lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No planned weeks
				.mockResolvedValueOnce([[{ count: 0 }], []]); // No shopping list history

			// Mock connection pool error
			mockGetConnection.mockRejectedValue(new Error('Pool exhausted'));

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: 1 }),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					// Consistent error response format
					expect(data).toEqual({
						success: false,
						error: 'Pool exhausted',
						code: 'DATABASE_ERROR',
					});
				},
			});
		});

		it('should handle zero recipeId', async () => {
			// Zero recipeId should be validated as invalid

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: 0 }),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					// Specific validation error
					expect(data).toEqual({
						success: false,
						error: 'Recipe ID must be a positive integer',
						code: 'INVALID_RECIPE_ID',
					});
				},
			});

			// Ensure no database calls were made
			expect(mockExecute).not.toHaveBeenCalled();
		});

		it('should handle negative recipeId', async () => {
			// Negative IDs should be rejected immediately without database lookup

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: -1 }),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					// Validation error, not "not found"
					expect(data).toEqual({
						success: false,
						error: 'Recipe ID must be a positive integer',
						code: 'INVALID_RECIPE_ID',
					});
				},
			});

			// Ensure no database calls were made
			expect(mockExecute).not.toHaveBeenCalled();
		});

		it('should handle string recipeId that is not a number', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: 'not-a-number' }),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Recipe ID must be a number',
						code: 'INVALID_RECIPE_ID',
					});
				},
			});

			// Ensure no database calls were made
			expect(mockExecute).not.toHaveBeenCalled();
		});

		it('should handle float recipeId', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ recipeId: 1.5 }),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Recipe ID must be an integer',
						code: 'INVALID_RECIPE_ID',
					});
				},
			});

			// Ensure no database calls were made
			expect(mockExecute).not.toHaveBeenCalled();
		});
	});
});
