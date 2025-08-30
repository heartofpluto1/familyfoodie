/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import { NextResponse } from 'next/server';
import * as appHandler from './route';
import { setupConsoleMocks, mockRegularSession, mockAdminSession } from '@/lib/test-utils';
import { requireAuth } from '@/lib/auth/helpers';
import { getRecipesForRandomization } from '@/lib/queries/menus';
import type { Recipe } from '@/types/menus';

// Mock database queries
jest.mock('@/lib/queries/menus', () => ({
	getRecipesForRandomization: jest.fn(),
}));

// Mock OAuth auth helpers
jest.mock('@/lib/auth/helpers', () => ({
	requireAuth: jest.fn(),
}));

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

const mockGetRecipesForRandomization = jest.mocked(getRecipesForRandomization);

// Helper to create mock recipes with ingredients
const createMockRecipe = (id: number, name: string, ingredients: string[] = []): Recipe => ({
	id,
	name,
	image_filename: `recipe${id}.jpg`,
	pdf_filename: `recipe${id}.pdf`,
	url_slug: `recipe-${id}`,
	collection_url_slug: 'test-collection',
	ingredients,
	household_id: 1,
});

describe('/api/plan/randomize', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();
		// Default OAuth mock for authenticated tests
		mockRequireAuth.mockResolvedValue({
			authorized: true as const,
			session: mockRegularSession,
			household_id: mockRegularSession.user.household_id,
			user_id: mockRegularSession.user.id,
		});
		// Reset Math.random for predictable tests
		jest.spyOn(global.Math, 'random').mockReturnValue(0.5);
	});

	afterAll(() => {
		consoleMocks.cleanup();
		jest.spyOn(global.Math, 'random').mockRestore();
	});

	describe('GET /api/plan/randomize', () => {
		// Authentication Tests
		describe('Authentication', () => {
			it('should return 401 when user is not authenticated', async () => {
				mockRequireAuth.mockResolvedValue({
					authorized: false as const,
					response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
				});

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(401);
					},
				});
			});

			it('should accept authenticated regular users', async () => {
				mockGetRecipesForRandomization.mockResolvedValueOnce([]);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toHaveProperty('recipes');
						expect(data).toHaveProperty('totalAvailable');
					},
				});
			});

			it('should accept authenticated admin users', async () => {
				mockRequireAuth.mockResolvedValue({
					authorized: true as const,
					session: mockAdminSession,
					household_id: mockAdminSession.user.household_id,
					user_id: mockAdminSession.user.id,
				});
				mockGetRecipesForRandomization.mockResolvedValueOnce([]);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toHaveProperty('recipes');
					},
				});
			});
		});

		// Success Cases - Basic Randomization
		describe('Basic randomization', () => {
			it('should return 3 random recipes by default', async () => {
				const mockRecipes = [
					createMockRecipe(1, 'Recipe 1', ['chicken', 'rice']),
					createMockRecipe(2, 'Recipe 2', ['beef', 'pasta']),
					createMockRecipe(3, 'Recipe 3', ['fish', 'potatoes']),
					createMockRecipe(4, 'Recipe 4', ['pork', 'beans']),
					createMockRecipe(5, 'Recipe 5', ['tofu', 'vegetables']),
				];
				mockGetRecipesForRandomization.mockResolvedValueOnce(mockRecipes);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.recipes).toHaveLength(3);
						expect(data.totalAvailable).toBe(5);
						expect(mockGetRecipesForRandomization).toHaveBeenCalledWith(mockRegularSession.user.household_id);
					},
				});
			});

			it('should return requested number of recipes when count parameter is provided', async () => {
				const mockRecipes = [
					createMockRecipe(1, 'Recipe 1', ['chicken', 'rice']),
					createMockRecipe(2, 'Recipe 2', ['beef', 'pasta']),
					createMockRecipe(3, 'Recipe 3', ['fish', 'potatoes']),
					createMockRecipe(4, 'Recipe 4', ['pork', 'beans']),
					createMockRecipe(5, 'Recipe 5', ['tofu', 'vegetables']),
				];
				mockGetRecipesForRandomization.mockResolvedValueOnce(mockRecipes);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize?count=2',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.recipes).toHaveLength(2);
						expect(data.totalAvailable).toBe(5);
					},
				});
			});

			it('should handle count=0 parameter', async () => {
				const mockRecipes = [createMockRecipe(1, 'Recipe 1', ['chicken']), createMockRecipe(2, 'Recipe 2', ['beef'])];
				mockGetRecipesForRandomization.mockResolvedValueOnce(mockRecipes);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize?count=0',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.recipes).toHaveLength(0);
						expect(data.totalAvailable).toBe(2);
					},
				});
			});

			it('should handle count greater than available recipes', async () => {
				const mockRecipes = [createMockRecipe(1, 'Recipe 1', ['chicken']), createMockRecipe(2, 'Recipe 2', ['beef'])];
				mockGetRecipesForRandomization.mockResolvedValueOnce(mockRecipes);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize?count=10',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();

						// Should return only available recipes
						expect(data.recipes).toHaveLength(2);
						expect(data.totalAvailable).toBe(2);
					},
				});
			});
		});

		// Ingredient Constraint Tests
		describe('Ingredient constraints', () => {
			it('should not select recipes with duplicate primary ingredients', async () => {
				const mockRecipes = [
					createMockRecipe(1, 'Chicken Stir Fry', ['chicken', 'vegetables']),
					createMockRecipe(2, 'Chicken Curry', ['chicken', 'rice']),
					createMockRecipe(3, 'Beef Tacos', ['beef', 'tortillas']),
				];
				mockGetRecipesForRandomization.mockResolvedValueOnce(mockRecipes);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize?count=3',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();

						// Should only return 2 recipes (both chicken recipes conflict)
						expect(data.recipes).toHaveLength(2);

						// Check that primary ingredients are unique
						const primaryIngredients = data.recipes.map((r: Recipe) => r.ingredients?.[0]);
						const uniquePrimary = new Set(primaryIngredients);
						expect(uniquePrimary.size).toBe(primaryIngredients.length);
					},
				});
			});

			it('should not select recipes with duplicate secondary ingredients', async () => {
				const mockRecipes = [
					createMockRecipe(1, 'Chicken Rice', ['chicken', 'rice']),
					createMockRecipe(2, 'Beef Rice', ['beef', 'rice']),
					createMockRecipe(3, 'Fish Pasta', ['fish', 'pasta']),
				];
				mockGetRecipesForRandomization.mockResolvedValueOnce(mockRecipes);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize?count=3',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();

						// Should only return 2 recipes (rice is duplicate secondary)
						expect(data.recipes).toHaveLength(2);

						// Check that secondary ingredients are unique
						const secondaryIngredients = data.recipes
							.map((r: Recipe) => r.ingredients?.[1])
							.filter((ingredient: string | undefined): ingredient is string => Boolean(ingredient));
						const uniqueSecondary = new Set(secondaryIngredients);
						expect(uniqueSecondary.size).toBe(secondaryIngredients.length);
					},
				});
			});

			it('should skip recipes with no ingredients', async () => {
				const mockRecipes = [
					createMockRecipe(1, 'Recipe 1', []), // No ingredients
					createMockRecipe(2, 'Recipe 2', ['beef']),
					createMockRecipe(3, 'Recipe 3', undefined), // undefined ingredients
					createMockRecipe(4, 'Recipe 4', ['chicken']),
				];
				mockGetRecipesForRandomization.mockResolvedValueOnce(mockRecipes);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize?count=3',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();

						// Should only return recipes with ingredients
						expect(data.recipes).toHaveLength(2);
						expect(data.recipes.every((r: Recipe) => r.ingredients && r.ingredients.length > 0)).toBe(true);
					},
				});
			});

			it('should handle recipes with only primary ingredient (no secondary)', async () => {
				const mockRecipes = [
					createMockRecipe(1, 'Simple Chicken', ['chicken']),
					createMockRecipe(2, 'Simple Beef', ['beef']),
					createMockRecipe(3, 'Simple Fish', ['fish']),
				];
				mockGetRecipesForRandomization.mockResolvedValueOnce(mockRecipes);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize?count=3',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();

						// Should return all 3 since no secondary conflicts
						expect(data.recipes).toHaveLength(3);
					},
				});
			});
		});

		// Edge Cases
		describe('Edge cases', () => {
			it('should handle empty recipe list', async () => {
				mockGetRecipesForRandomization.mockResolvedValueOnce([]);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.recipes).toEqual([]);
						expect(data.totalAvailable).toBe(0);
					},
				});
			});

			it('should handle negative count parameter', async () => {
				const mockRecipes = [createMockRecipe(1, 'Recipe 1', ['chicken']), createMockRecipe(2, 'Recipe 2', ['beef'])];
				mockGetRecipesForRandomization.mockResolvedValueOnce(mockRecipes);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize?count=-5',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();

						// Should return empty array for negative count
						expect(data.recipes).toHaveLength(0);
						expect(data.totalAvailable).toBe(2);
					},
				});
			});

			it('should handle non-numeric count parameter', async () => {
				const mockRecipes = [
					createMockRecipe(1, 'Recipe 1', ['chicken']),
					createMockRecipe(2, 'Recipe 2', ['beef']),
					createMockRecipe(3, 'Recipe 3', ['fish']),
				];
				mockGetRecipesForRandomization.mockResolvedValueOnce(mockRecipes);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize?count=abc',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();

						// Should default to 3 for invalid count
						expect(data.recipes).toHaveLength(3);
					},
				});
			});

			it('should handle very large count parameter', async () => {
				const mockRecipes = [createMockRecipe(1, 'Recipe 1', ['chicken']), createMockRecipe(2, 'Recipe 2', ['beef'])];
				mockGetRecipesForRandomization.mockResolvedValueOnce(mockRecipes);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize?count=999999',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();

						// Should return only available recipes
						expect(data.recipes).toHaveLength(2);
						expect(data.totalAvailable).toBe(2);
					},
				});
			});

			it('should handle decimal count parameter', async () => {
				const mockRecipes = [
					createMockRecipe(1, 'Recipe 1', ['chicken']),
					createMockRecipe(2, 'Recipe 2', ['beef']),
					createMockRecipe(3, 'Recipe 3', ['fish']),
				];
				mockGetRecipesForRandomization.mockResolvedValueOnce(mockRecipes);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize?count=2.7',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();

						// Should truncate to 2
						expect(data.recipes).toHaveLength(2);
					},
				});
			});
		});

		// Error Handling
		describe('Error handling', () => {
			it('should return 500 when database query fails', async () => {
				mockGetRecipesForRandomization.mockRejectedValueOnce(new Error('Database connection failed'));

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data.error).toBe('Database connection failed');
					},
				});
			});

			it('should handle non-Error exceptions', async () => {
				mockGetRecipesForRandomization.mockRejectedValueOnce('String error');

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data.error).toBe('Failed to randomize recipes');
					},
				});
			});

			it('should handle null/undefined from database', async () => {
				// Force mock to return null to test error handling
				// @ts-expect-error Testing null handling even though type expects Recipe[]
				mockGetRecipesForRandomization.mockResolvedValueOnce(null);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data.error).toContain('Failed to fetch recipes from database');
					},
				});
			});
		});

		// Randomization Algorithm Tests
		describe('Randomization algorithm', () => {
			it('should shuffle recipes before selection', async () => {
				// Mock Math.random to return predictable values
				const randomValues = [0.1, 0.9, 0.3, 0.7, 0.5];
				let randomIndex = 0;
				jest.spyOn(global.Math, 'random').mockImplementation(() => randomValues[randomIndex++ % randomValues.length]);

				const mockRecipes = [
					createMockRecipe(1, 'Recipe 1', ['a']),
					createMockRecipe(2, 'Recipe 2', ['b']),
					createMockRecipe(3, 'Recipe 3', ['c']),
					createMockRecipe(4, 'Recipe 4', ['d']),
					createMockRecipe(5, 'Recipe 5', ['e']),
				];
				mockGetRecipesForRandomization.mockResolvedValueOnce(mockRecipes);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize?count=3',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.recipes).toHaveLength(3);
						// Verify Math.random was called for shuffling
						expect(Math.random).toHaveBeenCalled();
					},
				});
			});

			it('should maintain recipe data integrity', async () => {
				const mockRecipes = [createMockRecipe(1, 'Recipe 1', ['chicken', 'rice']), createMockRecipe(2, 'Recipe 2', ['beef', 'pasta'])];
				mockGetRecipesForRandomization.mockResolvedValueOnce(mockRecipes);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize?count=2',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();

						// Verify all recipe properties are preserved
						data.recipes.forEach((recipe: Recipe) => {
							expect(recipe).toHaveProperty('id');
							expect(recipe).toHaveProperty('name');
							expect(recipe).toHaveProperty('image_filename');
							expect(recipe).toHaveProperty('pdf_filename');
							expect(recipe).toHaveProperty('url_slug');
							expect(recipe).toHaveProperty('collection_url_slug');
							expect(recipe).toHaveProperty('ingredients');
						});
					},
				});
			});

			it('should apply constraints in order of iteration', async () => {
				const mockRecipes = [
					createMockRecipe(1, 'Recipe 1', ['chicken', 'rice']),
					createMockRecipe(2, 'Recipe 2', ['chicken', 'pasta']), // Primary conflict
					createMockRecipe(3, 'Recipe 3', ['beef', 'rice']), // Secondary conflict
					createMockRecipe(4, 'Recipe 4', ['fish', 'vegetables']),
				];
				mockGetRecipesForRandomization.mockResolvedValueOnce(mockRecipes);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize?count=4',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();

						// Should select Recipe 1 and Recipe 4 (no conflicts)
						expect(data.recipes).toHaveLength(2);
						const recipeIds = data.recipes.map((r: Recipe) => r.id);
						expect(recipeIds).toContain(1);
						expect(recipeIds).toContain(4);
					},
				});
			});
		});

		// Multiple Query Parameters
		describe('Multiple query parameters', () => {
			it('should ignore unknown query parameters', async () => {
				const mockRecipes = [createMockRecipe(1, 'Recipe 1', ['chicken']), createMockRecipe(2, 'Recipe 2', ['beef'])];
				mockGetRecipesForRandomization.mockResolvedValueOnce(mockRecipes);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize?count=2&unknown=value&foo=bar',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.recipes).toHaveLength(2);
						expect(data.totalAvailable).toBe(2);
					},
				});
			});

			it('should handle multiple count parameters (use first)', async () => {
				const mockRecipes = [
					createMockRecipe(1, 'Recipe 1', ['chicken']),
					createMockRecipe(2, 'Recipe 2', ['beef']),
					createMockRecipe(3, 'Recipe 3', ['fish']),
				];
				mockGetRecipesForRandomization.mockResolvedValueOnce(mockRecipes);

				await testApiHandler({
					appHandler,
					url: '/api/plan/randomize?count=1&count=2&count=3',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						expect(response.status).toBe(200);
						const data = await response.json();

						// Should use first count parameter
						expect(data.recipes).toHaveLength(1);
					},
				});
			});
		});
	});
});
