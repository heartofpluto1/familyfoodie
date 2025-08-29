/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { setupConsoleMocks, mockAuthenticatedUser, mockNonAuthenticatedUser, mockRegularUser } from '@/lib/test-utils';
import { getCurrentWeekRecipes, getCurrentWeek } from '@/lib/queries/menus';
import type { Recipe } from '@/types/menus';

// Mock database queries
jest.mock('@/lib/queries/menus', () => ({
	getCurrentWeekRecipes: jest.fn(),
	getCurrentWeek: jest.fn(),
}));

// Mock auth middleware
jest.mock('@/lib/auth-middleware', () => jest.requireActual('@/lib/test-utils').authMiddlewareMock);

const mockGetCurrentWeekRecipes = jest.mocked(getCurrentWeekRecipes);
const mockGetCurrentWeek = jest.mocked(getCurrentWeek);

describe('/api/plan/current', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	// Test data
	const mockCurrentWeek = { week: 15, year: 2024 };
	const mockRecipes: Recipe[] = [
		{
			id: 1,
			name: 'Spaghetti Carbonara',
			image_filename: 'carbonara.jpg',
			pdf_filename: 'carbonara.pdf',
			url_slug: 'spaghetti-carbonara',
			collection_url_slug: 'italian',
			prepTime: 15,
			cookTime: 20,
			description: 'Classic Italian pasta dish',
			collection_id: 1,
			collection_title: 'Italian Classics',
		},
		{
			id: 2,
			name: 'Chicken Tikka Masala',
			image_filename: 'tikka.jpg',
			pdf_filename: 'tikka.pdf',
			url_slug: 'chicken-tikka-masala',
			collection_url_slug: 'indian',
			prepTime: 30,
			cookTime: 45,
			description: 'Creamy Indian curry',
			collection_id: 2,
			collection_title: 'Indian Delights',
		},
		{
			id: 3,
			name: 'Greek Salad',
			image_filename: 'greek-salad.jpg',
			pdf_filename: 'greek-salad.pdf',
			url_slug: 'greek-salad',
			collection_url_slug: 'mediterranean',
			prepTime: 10,
			description: 'Fresh Mediterranean salad',
			collection_id: 3,
			collection_title: 'Mediterranean',
		},
	];

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();
		// Default mock implementations
		mockGetCurrentWeek.mockReturnValue(mockCurrentWeek);
		mockGetCurrentWeekRecipes.mockResolvedValue(mockRecipes);
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('GET /api/plan/current', () => {
		// Authentication Tests
		it('should return 401 when user is not authenticated', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockNonAuthenticatedUser,
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
					expect(mockGetCurrentWeek).not.toHaveBeenCalled();
					expect(mockGetCurrentWeekRecipes).not.toHaveBeenCalled();
				},
			});
		});

		it('should pass household_id from authenticated user to database query', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					expect(mockGetCurrentWeekRecipes).toHaveBeenCalledWith(mockRegularUser.household_id);
				},
			});
		});

		// Success Cases
		it('should successfully return current week recipes', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						week: mockCurrentWeek.week,
						year: mockCurrentWeek.year,
						recipes: mockRecipes,
					});

					expect(mockGetCurrentWeek).toHaveBeenCalledTimes(1);
					expect(mockGetCurrentWeekRecipes).toHaveBeenCalledTimes(1);
					expect(mockGetCurrentWeekRecipes).toHaveBeenCalledWith(mockRegularUser.household_id);
				},
			});
		});

		it('should return empty array when no recipes found for current week', async () => {
			mockGetCurrentWeekRecipes.mockResolvedValueOnce([]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						week: mockCurrentWeek.week,
						year: mockCurrentWeek.year,
						recipes: [],
					});
				},
			});
		});

		it('should handle week 1 correctly', async () => {
			mockGetCurrentWeek.mockReturnValueOnce({ week: 1, year: 2024 });

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.week).toBe(1);
					expect(data.year).toBe(2024);
				},
			});
		});

		it('should handle week 52 correctly', async () => {
			mockGetCurrentWeek.mockReturnValueOnce({ week: 52, year: 2024 });

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.week).toBe(52);
					expect(data.year).toBe(2024);
				},
			});
		});

		it('should handle week 53 for leap years', async () => {
			mockGetCurrentWeek.mockReturnValueOnce({ week: 53, year: 2024 });

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.week).toBe(53);
					expect(data.year).toBe(2024);
				},
			});
		});

		it('should return single recipe correctly', async () => {
			const singleRecipe: Recipe[] = [mockRecipes[0]];
			mockGetCurrentWeekRecipes.mockResolvedValueOnce(singleRecipe);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.recipes).toHaveLength(1);
					expect(data.recipes[0].name).toBe('Spaghetti Carbonara');
				},
			});
		});

		it('should handle large number of recipes', async () => {
			const manyRecipes: Recipe[] = Array.from({ length: 20 }, (_, i) => ({
				id: i + 1,
				name: `Recipe ${i + 1}`,
				image_filename: `recipe${i + 1}.jpg`,
				pdf_filename: `recipe${i + 1}.pdf`,
				url_slug: `recipe-${i + 1}`,
				collection_url_slug: 'test-collection',
			}));
			mockGetCurrentWeekRecipes.mockResolvedValueOnce(manyRecipes);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.recipes).toHaveLength(20);
				},
			});
		});

		// Edge Cases - Recipes with optional fields
		it('should handle recipes with missing optional fields', async () => {
			const recipesWithMissingFields: Recipe[] = [
				{
					id: 1,
					name: 'Simple Recipe',
					image_filename: 'simple.jpg',
					pdf_filename: 'simple.pdf',
					url_slug: 'simple-recipe',
					collection_url_slug: 'basic',
					// No prepTime, cookTime, description, etc.
				},
			];
			mockGetCurrentWeekRecipes.mockResolvedValueOnce(recipesWithMissingFields);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.recipes[0]).toEqual(recipesWithMissingFields[0]);
				},
			});
		});

		it('should handle recipes with all optional fields populated', async () => {
			const recipesWithAllFields: Recipe[] = [
				{
					id: 1,
					name: 'Complete Recipe',
					image_filename: 'complete.jpg',
					pdf_filename: 'complete.pdf',
					url_slug: 'complete-recipe',
					collection_url_slug: 'full',
					prepTime: 30,
					cookTime: 60,
					cost: 15.99,
					description: 'A very complete recipe',
					seasonName: 'Summer',
					ingredients: ['Tomato', 'Basil', 'Mozzarella'],
					collection_id: 5,
					collection_title: 'Full Collection',
				},
			];
			mockGetCurrentWeekRecipes.mockResolvedValueOnce(recipesWithAllFields);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.recipes[0]).toEqual(recipesWithAllFields[0]);
					expect(data.recipes[0].ingredients).toEqual(['Tomato', 'Basil', 'Mozzarella']);
				},
			});
		});

		// Error Handling
		it('should return 500 when getCurrentWeekRecipes throws an error', async () => {
			mockGetCurrentWeekRecipes.mockRejectedValueOnce(new Error('Database connection failed'));

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({ error: 'Database connection failed' });
				},
			});
		});

		it('should return 500 with generic message for non-Error exceptions', async () => {
			mockGetCurrentWeekRecipes.mockRejectedValueOnce('String error');

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({ error: 'Failed to fetch current week recipes' });
				},
			});
		});

		it('should handle database timeout errors', async () => {
			mockGetCurrentWeekRecipes.mockRejectedValueOnce(new Error('Query timeout'));

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({ error: 'Query timeout' });
				},
			});
		});

		it('should handle getCurrentWeek throwing an error', async () => {
			mockGetCurrentWeek.mockImplementationOnce(() => {
				throw new Error('Date calculation error');
			});

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({ error: 'Date calculation error' });
				},
			});
		});

		// Year Boundary Tests
		it('should handle year boundary (week 52 to week 1)', async () => {
			mockGetCurrentWeek.mockReturnValueOnce({ week: 52, year: 2023 });
			mockGetCurrentWeekRecipes.mockResolvedValueOnce([]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						week: 52,
						year: 2023,
						recipes: [],
					});
				},
			});
		});

		it('should handle start of new year', async () => {
			mockGetCurrentWeek.mockReturnValueOnce({ week: 1, year: 2025 });

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.week).toBe(1);
					expect(data.year).toBe(2025);
				},
			});
		});

		// Different Date Scenarios
		it('should handle different years correctly', async () => {
			const testCases = [
				{ week: 10, year: 2020 },
				{ week: 25, year: 2021 },
				{ week: 40, year: 2022 },
				{ week: 15, year: 2023 },
				{ week: 30, year: 2024 },
				{ week: 45, year: 2025 },
			];

			for (const testCase of testCases) {
				mockGetCurrentWeek.mockReturnValueOnce(testCase);

				await testApiHandler({
					appHandler,
					requestPatcher: mockAuthenticatedUser,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data.week).toBe(testCase.week);
						expect(data.year).toBe(testCase.year);
					},
				});
			}
		});

		// Recipe Name Special Characters
		it('should handle recipes with special characters in names', async () => {
			const recipesWithSpecialChars: Recipe[] = [
				{
					id: 1,
					name: 'Recipe with "quotes" & <brackets>',
					image_filename: 'special.jpg',
					pdf_filename: 'special.pdf',
					url_slug: 'recipe-special',
					collection_url_slug: 'test',
				},
				{
					id: 2,
					name: "Recipe with 'apostrophes' and émojis 🍕",
					image_filename: 'emoji.jpg',
					pdf_filename: 'emoji.pdf',
					url_slug: 'recipe-emoji',
					collection_url_slug: 'test',
				},
			];
			mockGetCurrentWeekRecipes.mockResolvedValueOnce(recipesWithSpecialChars);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.recipes).toEqual(recipesWithSpecialChars);
				},
			});
		});

		// Response Structure Validation
		it('should always return week, year, and recipes fields', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toHaveProperty('week');
					expect(data).toHaveProperty('year');
					expect(data).toHaveProperty('recipes');
					expect(typeof data.week).toBe('number');
					expect(typeof data.year).toBe('number');
					expect(Array.isArray(data.recipes)).toBe(true);
				},
			});
		});

		// Concurrent Requests
		it('should handle concurrent requests correctly', async () => {
			const makeRequest = async () => {
				let responseData: { week: number; year: number; recipes: Recipe[] } | undefined;
				await testApiHandler({
					appHandler,
					requestPatcher: mockAuthenticatedUser,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});
						responseData = await response.json();
					},
				});
				return responseData;
			};

			const promises = Array.from({ length: 3 }, () => makeRequest());
			const results = await Promise.all(promises);

			results.forEach(result => {
				expect(result).toEqual({
					week: mockCurrentWeek.week,
					year: mockCurrentWeek.year,
					recipes: mockRecipes,
				});
			});

			// Each request should trigger its own function calls
			expect(mockGetCurrentWeek).toHaveBeenCalledTimes(3);
			expect(mockGetCurrentWeekRecipes).toHaveBeenCalledTimes(3);
		});
	});
});
