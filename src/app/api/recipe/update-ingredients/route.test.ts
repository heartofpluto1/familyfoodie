/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { mockAuthenticatedUser, mockNonAuthenticatedUser, MockConnection, setupConsoleMocks } from '@/lib/test-utils';

// Mock the database
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
	getConnection: jest.fn(),
}));
// Mock the auth middleware to properly handle authentication
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@/lib/auth-middleware', () => require('@/lib/test-utils').authMiddlewareMock);

// Get the mocked functions
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);
const mockGetConnection = jest.mocked(jest.requireMock('@/lib/db.js').getConnection);

describe('/api/recipe/update-ingredients', () => {
	let mockConnection: MockConnection;
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		mockExecute.mockClear();
		mockGetConnection.mockClear();
		consoleMocks = setupConsoleMocks();

		// Setup mock connection object
		mockConnection = {
			beginTransaction: jest.fn().mockResolvedValue(undefined),
			commit: jest.fn().mockResolvedValue(undefined),
			rollback: jest.fn().mockResolvedValue(undefined),
			release: jest.fn().mockResolvedValue(undefined),
			execute: jest.fn(),
		};

		mockGetConnection.mockResolvedValue(mockConnection);
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('PUT /api/recipe/update-ingredients', () => {
		it('should successfully update existing ingredients', async () => {
			// Mock connection operations
			mockConnection.execute
				.mockResolvedValueOnce([{ affectedRows: 1 }]) // Update ingredient 1
				.mockResolvedValueOnce([{ affectedRows: 1 }]); // Update ingredient 2

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 1,
							ingredients: [
								{
									id: 10,
									ingredientId: 5,
									quantity: '2 cups',
									quantity4: '500ml',
									measureId: 3,
									preparationId: 2,
								},
								{
									id: 11,
									ingredientId: 7,
									quantity: '1 tsp',
									quantity4: '5ml',
								},
							],
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe ingredients updated successfully',
						operations: {
							updated: 2,
							added: 0,
							deleted: 0,
						},
						ingredientsCount: 2,
					});

					// Verify transaction handling
					expect(mockConnection.beginTransaction).toHaveBeenCalled();
					expect(mockConnection.commit).toHaveBeenCalled();
					expect(mockConnection.release).toHaveBeenCalled();

					// Verify update calls
					expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipe_ingredients'), [5, '2 cups', '500ml', 3, 2, 10, 1]);
					expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipe_ingredients'), [
						7,
						'1 tsp',
						'5ml',
						null,
						null,
						11,
						1,
					]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should successfully add new ingredients', async () => {
			// Mock connection operations for inserts
			mockConnection.execute
				.mockResolvedValueOnce([{ insertId: 20 }]) // Insert ingredient 1
				.mockResolvedValueOnce([{ insertId: 21 }]); // Insert ingredient 2

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 2,
							ingredients: [
								{
									ingredientId: 8,
									quantity: '3 cups',
									quantity4: '750ml',
									measureId: 4,
								},
								{
									ingredientId: 9,
									quantity: '1 tbsp',
									quantity4: '15ml',
									preparationId: 3,
								},
							],
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe ingredients updated successfully',
						operations: {
							updated: 0,
							added: 2,
							deleted: 0,
						},
						ingredientsCount: 2,
					});

					// Verify insert calls
					expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO recipe_ingredients'), [
						2,
						8,
						'3 cups',
						'750ml',
						4,
						null,
						0,
					]);
					expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO recipe_ingredients'), [
						2,
						9,
						'1 tbsp',
						'15ml',
						null,
						3,
						0,
					]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should successfully delete specified ingredients', async () => {
			// Mock delete operation
			mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 2 }]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 3,
							ingredients: [],
							deletedIngredientIds: [15, 16],
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe ingredients updated successfully',
						operations: {
							updated: 0,
							added: 0,
							deleted: 2,
						},
						ingredientsCount: 0,
					});

					// Verify delete call
					expect(mockConnection.execute).toHaveBeenCalledWith('DELETE FROM recipe_ingredients WHERE recipe_id = ? AND id IN (?,?)', [3, 15, 16]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle mixed operations (delete, update, and add)', async () => {
			// Mock all operations
			mockConnection.execute
				.mockResolvedValueOnce([{ affectedRows: 1 }]) // Delete
				.mockResolvedValueOnce([{ affectedRows: 1 }]) // Update existing
				.mockResolvedValueOnce([{ insertId: 25 }]); // Insert new

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 4,
							ingredients: [
								{
									id: 12,
									ingredientId: 6,
									quantity: '1 cup',
									quantity4: '250ml',
								},
								{
									ingredientId: 8,
									quantity: '2 tbsp',
									quantity4: '30ml',
								},
							],
							deletedIngredientIds: [13],
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe ingredients updated successfully',
						operations: {
							updated: 1,
							added: 1,
							deleted: 1,
						},
						ingredientsCount: 2,
					});

					// Verify all operations
					expect(mockConnection.execute).toHaveBeenNthCalledWith(1, 'DELETE FROM recipe_ingredients WHERE recipe_id = ? AND id IN (?)', [4, 13]);
					expect(mockConnection.execute).toHaveBeenNthCalledWith(2, expect.stringContaining('UPDATE recipe_ingredients'), [
						6,
						'1 cup',
						'250ml',
						null,
						null,
						12,
						4,
					]);
					expect(mockConnection.execute).toHaveBeenNthCalledWith(3, expect.stringContaining('INSERT INTO recipe_ingredients'), [
						4,
						8,
						'2 tbsp',
						'30ml',
						null,
						null,
						0,
					]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 if recipe ID is missing', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							ingredients: [
								{
									ingredientId: 1,
									quantity: '1 cup',
									quantity4: '250ml',
								},
							],
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Recipe ID is required');
				},
				requestPatcher: mockAuthenticatedUser,
			});

			// Connection is acquired but no transaction operations occur
			expect(mockGetConnection).toHaveBeenCalled();
			expect(mockConnection.beginTransaction).not.toHaveBeenCalled();
		});

		it('should handle empty ingredients array', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 5,
							ingredients: [],
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe ingredients updated successfully',
						operations: {
							updated: 0,
							added: 0,
							deleted: 0,
						},
						ingredientsCount: 0,
					});

					// Verify transaction handling even with no operations
					expect(mockConnection.beginTransaction).toHaveBeenCalled();
					expect(mockConnection.commit).toHaveBeenCalled();
					expect(mockConnection.release).toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle database error during transaction', async () => {
			// Mock connection error during update
			mockConnection.execute.mockRejectedValueOnce(new Error('Foreign key constraint fails'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 6,
							ingredients: [
								{
									id: 14,
									ingredientId: 999, // Invalid ingredient ID
									quantity: '1 cup',
									quantity4: '250ml',
								},
							],
						}),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data.error).toBe('Failed to update recipe ingredients');

					// Verify rollback was called
					expect(mockConnection.beginTransaction).toHaveBeenCalled();
					expect(mockConnection.rollback).toHaveBeenCalled();
					expect(mockConnection.release).toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle connection pool error', async () => {
			// Mock connection pool error
			mockGetConnection.mockRejectedValue(new Error('Pool exhausted'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 7,
							ingredients: [
								{
									ingredientId: 1,
									quantity: '1 cup',
									quantity4: '250ml',
								},
							],
						}),
					});

					expect(response.status).toBe(500);
					// Connection pool errors result in HTML response, not JSON
					const text = await response.text();
					expect(text).toContain('Internal Server Error');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 401 for unauthenticated users', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 8,
							ingredients: [
								{
									ingredientId: 1,
									quantity: '1 cup',
									quantity4: '250ml',
								},
							],
						}),
					});

					expect(response.status).toBe(401);
				},
				requestPatcher: mockNonAuthenticatedUser,
			});
		});

		it('should handle invalid JSON payload', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: 'invalid-json',
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Invalid JSON payload');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle large number of deleted ingredients', async () => {
			const manyDeletedIds = Array.from({ length: 50 }, (_, i) => i + 100);

			// Mock delete operation
			mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 50 }]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 9,
							ingredients: [],
							deletedIngredientIds: manyDeletedIds,
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe ingredients updated successfully',
						operations: {
							updated: 0,
							added: 0,
							deleted: 50,
						},
						ingredientsCount: 0,
					});

					// Verify correct number of placeholders in delete query
					const expectedQuery = `DELETE FROM recipe_ingredients WHERE recipe_id = ? AND id IN (${manyDeletedIds.map(() => '?').join(',')})`;
					expect(mockConnection.execute).toHaveBeenCalledWith(expectedQuery, [9, ...manyDeletedIds]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle ingredients with all optional fields', async () => {
			mockConnection.execute.mockResolvedValueOnce([{ insertId: 30 }]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 10,
							ingredients: [
								{
									ingredientId: 15,
									quantity: '2½ cups',
									quantity4: '625ml',
									measureId: 7,
									preparationId: 4,
								},
							],
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe ingredients updated successfully',
						operations: {
							updated: 0,
							added: 1,
							deleted: 0,
						},
						ingredientsCount: 1,
					});

					// Verify all fields are passed correctly
					expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO recipe_ingredients'), [
						10,
						15,
						'2½ cups',
						'625ml',
						7,
						4,
						0,
					]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle ingredients with minimal fields', async () => {
			mockConnection.execute.mockResolvedValueOnce([{ insertId: 31 }]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 11,
							ingredients: [
								{
									ingredientId: 20,
									quantity: '1 pinch',
									quantity4: '1g',
								},
							],
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe ingredients updated successfully',
						operations: {
							updated: 0,
							added: 1,
							deleted: 0,
						},
						ingredientsCount: 1,
					});

					// Verify optional fields are null
					expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO recipe_ingredients'), [
						11,
						20,
						'1 pinch',
						'1g',
						null,
						null,
						0,
					]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle zero and negative values in numeric fields', async () => {
			mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 12,
							ingredients: [
								{
									id: 50,
									ingredientId: 25,
									quantity: '0',
									quantity4: '0ml',
									measureId: 0,
									preparationId: -1,
								},
							],
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe ingredients updated successfully',
						operations: {
							updated: 1,
							added: 0,
							deleted: 0,
						},
						ingredientsCount: 1,
					});

					// Verify zero and negative values are passed through (0 measureId becomes null due to || null logic)
					expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipe_ingredients'), [25, '0', '0ml', null, -1, 50, 12]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle very long quantity strings', async () => {
			const longQuantity = 'a'.repeat(1000);
			const longQuantity4 = 'b'.repeat(1000);

			mockConnection.execute.mockResolvedValueOnce([{ insertId: 32 }]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 13,
							ingredients: [
								{
									ingredientId: 30,
									quantity: longQuantity,
									quantity4: longQuantity4,
								},
							],
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe ingredients updated successfully',
						operations: {
							updated: 0,
							added: 1,
							deleted: 0,
						},
						ingredientsCount: 1,
					});

					// Verify long strings are passed through
					expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO recipe_ingredients'), [
						13,
						30,
						longQuantity,
						longQuantity4,
						null,
						null,
						0,
					]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle special characters in quantities', async () => {
			const specialQuantity = '1½ cups "chopped"';
			const specialQuantity4 = '375ml & <measured>';

			mockConnection.execute.mockResolvedValueOnce([{ insertId: 33 }]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 14,
							ingredients: [
								{
									ingredientId: 35,
									quantity: specialQuantity,
									quantity4: specialQuantity4,
								},
							],
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe ingredients updated successfully',
						operations: {
							updated: 0,
							added: 1,
							deleted: 0,
						},
						ingredientsCount: 1,
					});

					// Verify special characters are preserved
					expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO recipe_ingredients'), [
						14,
						35,
						specialQuantity,
						specialQuantity4,
						null,
						null,
						0,
					]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 for invalid ingredientId values', async () => {
			// Mock foreign key constraint error
			mockConnection.execute.mockRejectedValueOnce(new Error('Cannot add or update a child row: a foreign key constraint fails'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 16,
							ingredients: [
								{
									ingredientId: 999999, // Non-existent ingredient ID
									quantity: '1 cup',
									quantity4: '250ml',
								},
							],
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Invalid ingredient ID provided');

					// Verify rollback was called
					expect(mockConnection.beginTransaction).toHaveBeenCalled();
					expect(mockConnection.rollback).toHaveBeenCalled();
					expect(mockConnection.release).toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 for missing required ingredient fields', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 17,
							ingredients: [
								{
									// Missing ingredientId
									quantity: '1 cup',
									quantity4: '250ml',
								},
							],
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Ingredient ID is required for all ingredients');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 for malformed ingredient data structures', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 18,
							ingredients: [
								{
									ingredientId: 'invalid', // Should be number
									quantity: '1 cup',
									quantity4: '250ml',
								},
							],
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Invalid ingredient data format');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle transaction rollback failure gracefully', async () => {
			// Mock connection error during update and rollback failure
			mockConnection.execute.mockRejectedValueOnce(new Error('Database error'));
			mockConnection.rollback.mockRejectedValueOnce(new Error('Rollback failed'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							recipeId: 15,
							ingredients: [
								{
									id: 60,
									ingredientId: 40,
									quantity: '1 cup',
									quantity4: '250ml',
								},
							],
						}),
					});

					expect(response.status).toBe(500);
					// Rollback failures may result in HTML response, not JSON
					const text = await response.text();
					expect(text).toContain('Internal Server Error');

					// Verify rollback was attempted
					expect(mockConnection.rollback).toHaveBeenCalled();
					expect(mockConnection.release).toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});
	});
});
