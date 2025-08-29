/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import type { NextRequest } from 'next/server';
import type { SessionUser } from '@/types/auth';
import * as appHandler from './route';
import { mockAuthenticatedUser, mockNonAuthenticatedUser, clearAllMocks, setupConsoleMocks } from '@/lib/test-utils';

// Type for ingredients in the response
interface IngredientResponse {
	id: number;
	name: string;
	pantryCategory_id: number;
	pantryCategory_name: string | null;
	household_id: number;
}

// Mock the database pool
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
}));

// Get the mocked execute function
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);

// Mock the auth middleware to properly handle authentication
jest.mock('@/lib/auth-middleware', () => jest.requireActual('@/lib/test-utils').authMiddlewareMock);

// Mock getMyIngredients function
jest.mock('@/lib/queries/menus', () => ({
	getMyIngredients: jest.fn(),
}));

const mockGetMyIngredients = jest.mocked(jest.requireMock('@/lib/queries/menus').getMyIngredients);

describe('/api/recipe/options', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		clearAllMocks();
		consoleMocks = setupConsoleMocks();
		// Reset the mocks
		mockGetMyIngredients.mockReset();
		mockExecute.mockReset();
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('GET /api/recipe/options', () => {
		describe('Authentication Tests', () => {
			it('should return 401 for unauthenticated requests', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
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

			it('should process authenticated requests', async () => {
				// Mock successful database queries
				mockExecute
					.mockResolvedValueOnce([[{ id: 1, name: 'Spring' }], []]) // seasons
					.mockResolvedValueOnce([[{ id: 1, name: 'Chicken' }], []]) // primaryTypes
					.mockResolvedValueOnce([[{ id: 1, name: 'Rice' }], []]) // secondaryTypes
					.mockResolvedValueOnce([[{ id: 1, name: 'Cup' }], []]) // measures
					.mockResolvedValueOnce([[{ id: 1, name: 'Chopped' }], []]); // preparations

				// Mock getMyIngredients
				mockGetMyIngredients.mockResolvedValueOnce([
					{
						id: 1,
						name: 'Garlic',
						pantryCategory_id: 1,
						pantryCategory_name: 'Produce',
						household_id: 1,
					},
				]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toHaveProperty('seasons');
						expect(data).toHaveProperty('primaryTypes');
						expect(data).toHaveProperty('secondaryTypes');
						expect(data).toHaveProperty('ingredients');
						expect(data).toHaveProperty('measures');
						expect(data).toHaveProperty('preparations');
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Successful Response Tests', () => {
			it('should return all six option types with correct data structure', async () => {
				// Mock complete dataset
				mockExecute
					.mockResolvedValueOnce([
						[
							{ id: 1, name: 'Spring' },
							{ id: 2, name: 'Summer' },
							{ id: 3, name: 'Fall' },
							{ id: 4, name: 'Winter' },
						],
						[],
					]) // seasons
					.mockResolvedValueOnce([
						[
							{ id: 1, name: 'Beef' },
							{ id: 2, name: 'Chicken' },
							{ id: 3, name: 'Fish' },
						],
						[],
					]) // primaryTypes
					.mockResolvedValueOnce([
						[
							{ id: 1, name: 'Pasta' },
							{ id: 2, name: 'Rice' },
						],
						[],
					]) // secondaryTypes
					.mockResolvedValueOnce([
						[
							{ id: 1, name: 'Cup' },
							{ id: 2, name: 'Tablespoon' },
							{ id: 3, name: 'Teaspoon' },
						],
						[],
					]) // measures
					.mockResolvedValueOnce([
						[
							{ id: 1, name: 'Chopped' },
							{ id: 2, name: 'Diced' },
							{ id: 3, name: 'Minced' },
						],
						[],
					]); // preparations

				// Mock getMyIngredients
				mockGetMyIngredients.mockResolvedValueOnce([
					{ id: 1, name: 'Garlic', pantryCategory_id: 1, pantryCategory_name: 'Produce', household_id: 1 },
					{ id: 2, name: 'Olive Oil', pantryCategory_id: 2, pantryCategory_name: 'Oils', household_id: 1 },
					{ id: 3, name: 'Salt', pantryCategory_id: 3, pantryCategory_name: 'Seasonings', household_id: 1 },
				]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						// Check seasons
						expect(data.seasons).toEqual([
							{ id: 1, name: 'Spring' },
							{ id: 2, name: 'Summer' },
							{ id: 3, name: 'Fall' },
							{ id: 4, name: 'Winter' },
						]);

						// Check primaryTypes
						expect(data.primaryTypes).toEqual([
							{ id: 1, name: 'Beef' },
							{ id: 2, name: 'Chicken' },
							{ id: 3, name: 'Fish' },
						]);

						// Check secondaryTypes
						expect(data.secondaryTypes).toEqual([
							{ id: 1, name: 'Pasta' },
							{ id: 2, name: 'Rice' },
						]);

						// Check ingredients
						expect(data.ingredients).toEqual([
							{ id: 1, name: 'Garlic', pantryCategory_id: 1, pantryCategory_name: 'Produce', household_id: 1 },
							{ id: 2, name: 'Olive Oil', pantryCategory_id: 2, pantryCategory_name: 'Oils', household_id: 1 },
							{ id: 3, name: 'Salt', pantryCategory_id: 3, pantryCategory_name: 'Seasonings', household_id: 1 },
						]);

						// Check measures
						expect(data.measures).toEqual([
							{ id: 1, name: 'Cup' },
							{ id: 2, name: 'Tablespoon' },
							{ id: 3, name: 'Teaspoon' },
						]);

						// Check preparations
						expect(data.preparations).toEqual([
							{ id: 1, name: 'Chopped' },
							{ id: 2, name: 'Diced' },
							{ id: 3, name: 'Minced' },
						]);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle empty datasets gracefully', async () => {
				// Mock empty results for all queries
				mockExecute
					.mockResolvedValueOnce([[], []]) // seasons
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([[], []]) // measures
					.mockResolvedValueOnce([[], []]); // preparations

				mockGetMyIngredients.mockResolvedValueOnce([]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.seasons).toEqual([]);
						expect(data.primaryTypes).toEqual([]);
						expect(data.secondaryTypes).toEqual([]);
						expect(data.ingredients).toEqual([]);
						expect(data.measures).toEqual([]);
						expect(data.preparations).toEqual([]);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should verify correct SQL queries are executed', async () => {
				// Mock successful database queries
				mockExecute
					.mockResolvedValueOnce([[], []]) // seasons
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([[], []]) // measures
					.mockResolvedValueOnce([[], []]); // preparations

				mockGetMyIngredients.mockResolvedValueOnce([]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						await fetch({ method: 'GET' });

						// Verify all the correct queries were made
						expect(mockExecute).toHaveBeenCalledTimes(5); // Now only 5 since ingredients uses getMyIngredients
						expect(mockExecute).toHaveBeenNthCalledWith(1, 'SELECT id, name FROM seasons ORDER BY name');
						expect(mockExecute).toHaveBeenNthCalledWith(2, 'SELECT id, name FROM type_proteins ORDER BY name');
						expect(mockExecute).toHaveBeenNthCalledWith(3, 'SELECT id, name FROM type_carbs ORDER BY name');
						expect(mockExecute).toHaveBeenNthCalledWith(4, 'SELECT id, name FROM measurements ORDER BY name');
						expect(mockExecute).toHaveBeenNthCalledWith(5, 'SELECT id, name FROM preparations ORDER BY name');

						// Verify getMyIngredients was called
						expect(mockGetMyIngredients).toHaveBeenCalledWith(1);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Data Structure Tests', () => {
			it('should handle ingredients with null pantry categories', async () => {
				// Mock ingredients with some having null pantry categories
				mockExecute
					.mockResolvedValueOnce([[], []]) // seasons
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([[], []]) // measures
					.mockResolvedValueOnce([[], []]); // preparations

				mockGetMyIngredients.mockResolvedValueOnce([
					{ id: 1, name: 'Garlic', pantryCategory_id: 1, pantryCategory_name: 'Produce', household_id: 1 },
					{ id: 2, name: 'Mystery Ingredient', pantryCategory_id: null, pantryCategory_name: null, household_id: 1 },
					{ id: 3, name: 'Salt', pantryCategory_id: 3, pantryCategory_name: 'Seasonings', household_id: 1 },
				]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.ingredients).toEqual([
							{ id: 1, name: 'Garlic', pantryCategory_id: 1, pantryCategory_name: 'Produce', household_id: 1 },
							{ id: 2, name: 'Mystery Ingredient', pantryCategory_id: null, pantryCategory_name: null, household_id: 1 },
							{ id: 3, name: 'Salt', pantryCategory_id: 3, pantryCategory_name: 'Seasonings', household_id: 1 },
						]);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle special characters in names', async () => {
				// Mock data with special characters
				mockExecute
					.mockResolvedValueOnce([
						[
							{ id: 1, name: "Spring's Delight" },
							{ id: 2, name: 'Summer & Sun' },
							{ id: 3, name: 'Fall "Harvest"' },
							{ id: 4, name: '<Winter>' },
						],
						[],
					]) // seasons
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([
						[
							{ id: 1, name: '1/2 Cup' },
							{ id: 2, name: 'Tablespoon (tbsp)' },
						],
						[],
					]) // measures
					.mockResolvedValueOnce([
						[
							{ id: 1, name: 'Chopped & Diced' },
							{ id: 2, name: 'Minced (fine)' },
						],
						[],
					]); // preparations

				mockGetMyIngredients.mockResolvedValueOnce([
					{ id: 1, name: "Chef's Special", pantryCategory_id: 1, pantryCategory_name: 'Produce & More', household_id: 1 },
					{ id: 2, name: 'Oil (Extra Virgin)', pantryCategory_id: 2, pantryCategory_name: 'Oils/Vinegars', household_id: 1 },
				]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						// Verify special characters are preserved
						expect(data.seasons[0].name).toBe("Spring's Delight");
						expect(data.seasons[1].name).toBe('Summer & Sun');
						expect(data.seasons[2].name).toBe('Fall "Harvest"');
						expect(data.seasons[3].name).toBe('<Winter>');

						expect(data.ingredients[0].name).toBe("Chef's Special");
						expect(data.ingredients[0].pantryCategory_name).toBe('Produce & More');
						expect(data.ingredients[1].name).toBe('Oil (Extra Virgin)');

						expect(data.measures[0].name).toBe('1/2 Cup');
						expect(data.preparations[0].name).toBe('Chopped & Diced');
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle large datasets', async () => {
				// Create large mock datasets
				const largeSeasonData = Array.from({ length: 100 }, (_, i) => ({
					id: i + 1,
					name: `Season ${i + 1}`,
				}));

				const largeIngredientData = Array.from({ length: 500 }, (_, i) => ({
					id: i + 1,
					name: `Ingredient ${i + 1}`,
					pantryCategory_id: (i % 10) + 1,
					pantryCategory_name: `Category ${(i % 10) + 1}`,
					household_id: 1,
				}));

				mockExecute
					.mockResolvedValueOnce([largeSeasonData, []]) // seasons
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([[], []]) // measures
					.mockResolvedValueOnce([[], []]); // preparations

				mockGetMyIngredients.mockResolvedValueOnce(largeIngredientData);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.seasons).toHaveLength(100);
						expect(data.ingredients).toHaveLength(500);
						expect(data.seasons[0]).toEqual({ id: 1, name: 'Season 1' });
						expect(data.seasons[99]).toEqual({ id: 100, name: 'Season 100' });
						expect(data.ingredients[0]).toEqual({
							id: 1,
							name: 'Ingredient 1',
							pantryCategory_id: 1,
							pantryCategory_name: 'Category 1',
							household_id: 1,
						});
						expect(data.ingredients[499]).toEqual({
							id: 500,
							name: 'Ingredient 500',
							pantryCategory_id: 10,
							pantryCategory_name: 'Category 10',
							household_id: 1,
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Error Handling Tests', () => {
			it('should handle database connection failures', async () => {
				const connectionError = new Error('DATABASE_CONNECTION_FAILED: Unable to connect to the database');
				mockExecute.mockRejectedValueOnce(connectionError);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data).toEqual({
							error: 'Failed to fetch recipe options',
						});

						// Verify error was logged
						expect(consoleMocks.mockConsoleError).toHaveBeenCalledWith('Error fetching recipe options:', connectionError);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle query failure on seasons', async () => {
				const queryError = new Error('Table seasons does not exist');
				mockExecute.mockRejectedValueOnce(queryError);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data).toEqual({
							error: 'Failed to fetch recipe options',
						});

						expect(consoleMocks.mockConsoleError).toHaveBeenCalledWith('Error fetching recipe options:', queryError);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle query failure on ingredients', async () => {
				// First three queries succeed
				mockExecute
					.mockResolvedValueOnce([[{ id: 1, name: 'Spring' }], []]) // seasons
					.mockResolvedValueOnce([[{ id: 1, name: 'Chicken' }], []]) // primaryTypes
					.mockResolvedValueOnce([[{ id: 1, name: 'Rice' }], []]) // secondaryTypes
					.mockRejectedValueOnce(new Error('LEFT JOIN syntax error')); // ingredients fail

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data).toEqual({
							error: 'Failed to fetch recipe options',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle unexpected error types', async () => {
				// Mock execute to throw a non-Error object
				mockExecute.mockRejectedValueOnce('String error');

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data).toEqual({
							error: 'Failed to fetch recipe options',
						});

						expect(consoleMocks.mockConsoleError).toHaveBeenCalledWith('Error fetching recipe options:', 'String error');
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle timeout errors', async () => {
				const timeoutError = new Error('Query timeout exceeded') as Error & { code: string };
				timeoutError.code = 'ETIMEDOUT';
				mockExecute.mockRejectedValueOnce(timeoutError);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data).toEqual({
							error: 'Failed to fetch recipe options',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle partial query failures gracefully', async () => {
				// Mock a database error on one of the queries
				mockExecute
					.mockResolvedValueOnce([[{ id: 1, name: 'Spring' }], []]) // seasons
					.mockRejectedValueOnce(new Error('Database query failed')) // primaryTypes fails
					.mockResolvedValueOnce([[{ id: 1, name: 'Rice' }], []]) // secondaryTypes
					.mockResolvedValueOnce([[{ id: 1, name: 'Cup' }], []]) // measures
					.mockResolvedValueOnce([[{ id: 1, name: 'Chopped' }], []]); // preparations

				mockGetMyIngredients.mockResolvedValueOnce([{ id: 1, name: 'Garlic', pantryCategory_id: 1, pantryCategory_name: 'Produce', household_id: 1 }]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						// This should fail because primaryTypes query returns undefined
						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data).toEqual({
							error: 'Failed to fetch recipe options',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Response Format Tests', () => {
			it('should return correct content-type header', async () => {
				// Mock successful queries
				mockExecute
					.mockResolvedValueOnce([[], []]) // seasons
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([[], []]) // measures
					.mockResolvedValueOnce([[], []]); // preparations

				mockGetMyIngredients.mockResolvedValueOnce([]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						expect(response.headers.get('content-type')).toContain('application/json');
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should return consistent response structure', async () => {
				// Mock successful queries
				mockExecute
					.mockResolvedValueOnce([[], []]) // seasons
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([[], []]) // measures
					.mockResolvedValueOnce([[], []]); // preparations

				mockGetMyIngredients.mockResolvedValueOnce([]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						// Check that all expected keys are present
						const expectedKeys = ['seasons', 'primaryTypes', 'secondaryTypes', 'ingredients', 'measures', 'preparations'];
						expect(Object.keys(data).sort()).toEqual(expectedKeys.sort());

						// Verify each is an array
						expectedKeys.forEach(key => {
							expect(Array.isArray(data[key])).toBe(true);
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should maintain field order in response', async () => {
				// Mock data to verify field order
				mockExecute
					.mockResolvedValueOnce([[{ id: 1, name: 'Spring' }], []]) // seasons
					.mockResolvedValueOnce([[{ id: 1, name: 'Chicken' }], []]) // primaryTypes
					.mockResolvedValueOnce([[{ id: 1, name: 'Rice' }], []]) // secondaryTypes
					.mockResolvedValueOnce([[{ id: 1, name: 'Cup' }], []]) // measures
					.mockResolvedValueOnce([[{ id: 1, name: 'Chopped' }], []]); // preparations

				mockGetMyIngredients.mockResolvedValueOnce([{ id: 1, name: 'Garlic', pantryCategory_id: 1, pantryCategory_name: 'Produce', household_id: 1 }]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const responseText = await response.text();
						const data = JSON.parse(responseText);

						// Verify the response object key order
						const keys = Object.keys(data);
						expect(keys).toEqual(['seasons', 'primaryTypes', 'secondaryTypes', 'ingredients', 'measures', 'preparations']);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Household Boundary Tests', () => {
			it("should only return ingredients from user's household", async () => {
				// Mock data - getMyIngredients should already filter by household
				const household1Ingredients = [
					{ id: 1, name: 'Garlic', pantryCategory_id: 1, pantryCategory_name: 'Produce', household_id: 1 },
					{ id: 2, name: 'Onion', pantryCategory_id: 1, pantryCategory_name: 'Produce', household_id: 1 },
				];

				mockExecute
					.mockResolvedValueOnce([[], []]) // seasons
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([[], []]) // measures
					.mockResolvedValueOnce([[], []]); // preparations

				// Mock getMyIngredients to return only household 1's ingredients
				mockGetMyIngredients.mockResolvedValueOnce(household1Ingredients);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						// The route now correctly returns only ingredients from household_id = 1
						expect(data.ingredients).toHaveLength(2);
						expect(data.ingredients).toEqual(
							expect.arrayContaining([expect.objectContaining({ id: 1, household_id: 1 }), expect.objectContaining({ id: 2, household_id: 1 })])
						);
						// Should NOT contain any ingredients from other households
						data.ingredients.forEach((ingredient: IngredientResponse) => {
							expect(ingredient.household_id).toBe(1);
						});
					},
					requestPatcher: mockAuthenticatedUser, // household_id = 1
				});
			});

			it("should include ingredients ONLY from collection_id=1 (Spencer's essentials)", async () => {
				// getMyIngredients includes Spencer's essentials (collection_id=1) for all users
				const allAccessibleIngredients = [
					{
						id: 1,
						name: 'Garlic',
						pantryCategory_id: 1,
						pantryCategory_name: 'Produce',
						household_id: 1,
					},
					{
						id: 100,
						name: 'Salt',
						pantryCategory_id: 3,
						pantryCategory_name: 'Seasonings',
						household_id: 99, // Different household owns it but from collection_id=1
					},
					{
						id: 101,
						name: 'Pepper',
						pantryCategory_id: 3,
						pantryCategory_name: 'Seasonings',
						household_id: 99, // Different household owns it but from collection_id=1
					},
				];

				mockExecute
					.mockResolvedValueOnce([[], []]) // seasons
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([[], []]) // measures
					.mockResolvedValueOnce([[], []]); // preparations

				// Mock getMyIngredients to return user's ingredients plus Spencer's essentials
				mockGetMyIngredients.mockResolvedValueOnce(allAccessibleIngredients);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						// Should include both user's ingredients AND public collection ingredients
						expect(data.ingredients).toHaveLength(3);
						expect(data.ingredients).toEqual(
							expect.arrayContaining([
								expect.objectContaining({ id: 1 }), // User's ingredient
								expect.objectContaining({ id: 100 }), // Public collection
								expect.objectContaining({ id: 101 }), // Public collection
							])
						);
					},
					requestPatcher: mockAuthenticatedUser, // household_id = 1
				});
			});

			it('should NOT include ingredients from other public collections (only collection_id=1)', async () => {
				// This test verifies that ONLY collection_id=1 is special, not all public collections
				// getMyIngredients should filter to only include user's household + collection_id=1 + subscribed
				const correctlyFilteredIngredients = [
					{
						id: 1,
						name: 'Garlic',
						pantryCategory_id: 1,
						pantryCategory_name: 'Produce',
						household_id: 1,
					},
					{
						id: 100,
						name: 'Salt',
						pantryCategory_id: 3,
						pantryCategory_name: 'Seasonings',
						household_id: 99, // From collection_id=1
					},
				];

				mockExecute
					.mockResolvedValueOnce([[], []]) // seasons
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([[], []]) // measures
					.mockResolvedValueOnce([[], []]); // preparations

				// getMyIngredients already filters correctly
				mockGetMyIngredients.mockResolvedValueOnce(correctlyFilteredIngredients);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						// Should include user's ingredients and collection_id=1 only
						expect(data.ingredients).toHaveLength(2);
						expect(data.ingredients).toEqual(
							expect.arrayContaining([
								expect.objectContaining({ id: 1 }), // User's ingredient
								expect.objectContaining({ id: 100 }), // Spencer's essentials (collection_id=1)
							])
						);
						// Should NOT have any ingredient with id: 200 (from other public collection)
						const hasOtherPublic = data.ingredients.some((i: IngredientResponse) => i.id === 200);
						expect(hasOtherPublic).toBe(false);
					},
					requestPatcher: mockAuthenticatedUser, // household_id = 1
				});
			});

			it('should include ingredients from subscribed collections', async () => {
				// getMyIngredients returns user's ingredients + subscribed collections
				const accessibleIngredients = [
					{
						id: 1,
						name: 'Garlic',
						pantryCategory_id: 1,
						pantryCategory_name: 'Produce',
						household_id: 1,
					},
					{
						id: 200,
						name: 'Truffle Oil',
						pantryCategory_id: 2,
						pantryCategory_name: 'Oils',
						household_id: 88, // From subscribed collection
					},
				];

				mockExecute
					.mockResolvedValueOnce([[], []]) // seasons
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([[], []]) // measures
					.mockResolvedValueOnce([[], []]); // preparations

				mockGetMyIngredients.mockResolvedValueOnce(accessibleIngredients);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						// Should include user's ingredients and subscribed collection ingredients
						// but NOT non-subscribed collection ingredients
						expect(data.ingredients).toHaveLength(2);
						expect(data.ingredients).toEqual(
							expect.arrayContaining([
								expect.objectContaining({ id: 1 }), // User's ingredient
								expect.objectContaining({ id: 200 }), // Subscribed collection
							])
						);
						expect(data.ingredients).not.toEqual(
							expect.arrayContaining([
								expect.objectContaining({ id: 300 }), // Should NOT have non-subscribed
							])
						);
					},
					requestPatcher: mockAuthenticatedUser, // household_id = 1
				});
			});

			it('should verify getMyIngredients is called with household_id', async () => {
				// This test verifies the proper function is called
				mockExecute
					.mockResolvedValueOnce([[], []]) // seasons
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([[], []]) // measures
					.mockResolvedValueOnce([[], []]); // preparations

				mockGetMyIngredients.mockResolvedValueOnce([]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						await fetch({ method: 'GET' });

						// Verify getMyIngredients was called with the correct household_id
						expect(mockGetMyIngredients).toHaveBeenCalledWith(1);
						expect(mockGetMyIngredients).toHaveBeenCalledTimes(1);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should pass household_id as parameter to getMyIngredients', async () => {
				// This test verifies that household_id is properly passed
				mockExecute
					.mockResolvedValueOnce([[], []]) // seasons
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([[], []]) // measures
					.mockResolvedValueOnce([[], []]); // preparations

				mockGetMyIngredients.mockResolvedValueOnce([]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						await fetch({ method: 'GET' });

						// Check that getMyIngredients was called with household_id
						expect(mockGetMyIngredients).toHaveBeenCalledWith(1); // household_id from mockAuthenticatedUser
					},
					requestPatcher: mockAuthenticatedUser, // household_id = 1
				});
			});

			it('should handle users from different households seeing different ingredients', async () => {
				// Test with household 1 user
				const household1Ingredients = [{ id: 1, name: 'Garlic', pantryCategory_id: 1, pantryCategory_name: 'Produce', household_id: 1 }];

				mockExecute
					.mockResolvedValueOnce([[], []]) // seasons
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([[], []]) // measures
					.mockResolvedValueOnce([[], []]); // preparations

				mockGetMyIngredients.mockResolvedValueOnce(household1Ingredients);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const data = await response.json();

						expect(response.status).toBe(200);
						expect(data.ingredients).toHaveLength(1);
						expect(data.ingredients[0].id).toBe(1);
					},
					requestPatcher: mockAuthenticatedUser, // household_id = 1
				});

				// Test with household 2 user
				const household2Ingredients = [{ id: 2, name: 'Onion', pantryCategory_id: 1, pantryCategory_name: 'Produce', household_id: 2 }];

				const household2UserPatcher = (req: NextRequest & { user?: SessionUser; household_id?: number }) => {
					mockAuthenticatedUser(req);
					req.user = {
						...req.user!,
						household_id: 2,
						household_name: 'Household 2',
					};
					return req;
				};

				mockExecute
					.mockResolvedValueOnce([[], []]) // seasons
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([[], []]) // measures
					.mockResolvedValueOnce([[], []]); // preparations

				mockGetMyIngredients.mockResolvedValueOnce(household2Ingredients);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const data = await response.json();

						expect(response.status).toBe(200);
						// This will fail as the route currently returns all ingredients
						expect(data.ingredients).toHaveLength(1);
						expect(data.ingredients[0].id).toBe(2);
					},
					requestPatcher: household2UserPatcher, // household_id = 2
				});
			});
		});

		describe('Edge Cases', () => {
			it('should handle database returning extra fields', async () => {
				// Mock data with extra unexpected fields
				mockExecute
					.mockResolvedValueOnce([
						[
							{ id: 1, name: 'Spring', extraField: 'should be included', anotherField: 123 },
							{ id: 2, name: 'Summer', unexpectedData: true },
						],
						[],
					]) // seasons with extra fields
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([[], []]) // measures
					.mockResolvedValueOnce([[], []]); // preparations

				mockGetMyIngredients.mockResolvedValueOnce([
					{
						id: 1,
						name: 'Garlic',
						pantryCategory_id: 1,
						pantryCategory_name: 'Produce',
						household_id: 1,
						extraIngredientField: 'test',
						numericField: 456,
					},
				]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						// Extra fields should be included in the response
						expect(data.seasons).toBeDefined();
						expect(data.seasons.length).toBeGreaterThan(0);
						expect(data.seasons[0]).toEqual({
							id: 1,
							name: 'Spring',
							extraField: 'should be included',
							anotherField: 123,
						});
						expect(data.seasons[1]).toEqual({
							id: 2,
							name: 'Summer',
							unexpectedData: true,
						});

						// Note: The route maps specific fields for ingredients, so extra fields might not all pass through
						expect(data.ingredients[0]).toMatchObject({
							id: 1,
							name: 'Garlic',
							pantryCategory_id: 1,
							pantryCategory_name: 'Produce',
							household_id: 1,
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle very long names', async () => {
				const veryLongName = 'A'.repeat(255);

				mockExecute
					.mockResolvedValueOnce([[{ id: 1, name: veryLongName }], []]) // seasons
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([[{ id: 1, name: veryLongName }], []]) // measures
					.mockResolvedValueOnce([[{ id: 1, name: veryLongName }], []]); // preparations

				mockGetMyIngredients.mockResolvedValueOnce([
					{
						id: 1,
						name: veryLongName,
						pantryCategory_id: 1,
						pantryCategory_name: veryLongName,
						household_id: 1,
					},
				]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.seasons[0].name).toBe(veryLongName);
						expect(data.seasons[0].name.length).toBe(255);
						expect(data.ingredients[0].name).toBe(veryLongName);
						expect(data.ingredients[0].pantryCategory_name).toBe(veryLongName);
						expect(data.measures[0].name).toBe(veryLongName);
						expect(data.preparations[0].name).toBe(veryLongName);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle unicode characters in names', async () => {
				mockExecute
					.mockResolvedValueOnce([
						[
							{ id: 1, name: '春天 (Spring)' },
							{ id: 2, name: 'Été 🌞' },
							{ id: 3, name: 'مرحبا' },
							{ id: 4, name: '🍂 Fall' },
						],
						[],
					]) // seasons with unicode
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([[], []]) // measures
					.mockResolvedValueOnce([[], []]); // preparations

				mockGetMyIngredients.mockResolvedValueOnce([
					{ id: 1, name: '大蒜 (Garlic)', pantryCategory_id: 1, pantryCategory_name: '蔬菜 🥬', household_id: 1 },
					{ id: 2, name: "Huile d'olive 🫒", pantryCategory_id: 2, pantryCategory_name: 'Huiles', household_id: 1 },
				]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						// Verify unicode characters are preserved correctly
						expect(data.seasons[0].name).toBe('春天 (Spring)');
						expect(data.seasons[1].name).toBe('Été 🌞');
						expect(data.seasons[2].name).toBe('مرحبا');
						expect(data.seasons[3].name).toBe('🍂 Fall');

						expect(data.ingredients[0].name).toBe('大蒜 (Garlic)');
						expect(data.ingredients[0].pantryCategory_name).toBe('蔬菜 🥬');
						expect(data.ingredients[1].name).toBe("Huile d'olive 🫒");
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle different user households correctly', async () => {
				// Mock successful queries
				mockExecute
					.mockResolvedValueOnce([[], []]) // seasons
					.mockResolvedValueOnce([[], []]) // primaryTypes
					.mockResolvedValueOnce([[], []]) // secondaryTypes
					.mockResolvedValueOnce([[], []]) // measures
					.mockResolvedValueOnce([[], []]); // preparations

				mockGetMyIngredients.mockResolvedValueOnce([]);

				// Custom user with different household_id
				const customUserPatcher = (req: NextRequest & { user?: SessionUser; household_id?: number }) => {
					mockAuthenticatedUser(req);
					req.user = {
						...req.user!,
						household_id: 42,
						household_name: 'Different Household',
					};
					return req;
				};

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						// Should still return the same structure regardless of household
						// This endpoint returns global options, not household-specific data
						expect(data).toHaveProperty('seasons');
						expect(data).toHaveProperty('primaryTypes');
						expect(data).toHaveProperty('secondaryTypes');
						expect(data).toHaveProperty('ingredients');
						expect(data).toHaveProperty('measures');
						expect(data).toHaveProperty('preparations');
					},
					requestPatcher: customUserPatcher,
				});
			});
		});
	});
});
