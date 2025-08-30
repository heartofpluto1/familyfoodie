/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import { NextResponse } from 'next/server';
import * as appHandler from './route';
import { setupConsoleMocks, mockRegularSession } from '@/lib/test-utils';
import { requireAuth } from '@/lib/auth/helpers';
import { getNextWeekRecipes } from '@/lib/queries/menus';

// Mock database queries
jest.mock('@/lib/queries/menus', () => ({
	getNextWeekRecipes: jest.fn(),
}));

// Mock OAuth auth helpers
jest.mock('@/lib/auth/helpers', () => ({
	requireAuth: jest.fn(),
}));

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

const mockGetNextWeekRecipes = jest.mocked(getNextWeekRecipes);

describe('/api/plan/week', () => {
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
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('GET /api/plan/week', () => {
		// Authentication Tests
		it('should return 401 when user is not authenticated', async () => {
			mockRequireAuth.mockResolvedValue({
				authorized: false as const,
				response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
			});

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=1&year=2024',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(401);
				},
			});
		});

		it('should pass household_id from authenticated user to database query', async () => {
			mockGetNextWeekRecipes.mockResolvedValueOnce([]);

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=1&year=2024',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					expect(mockGetNextWeekRecipes).toHaveBeenCalledWith(mockRegularSession.user.household_id);
				},
			});
		});

		// Parameter Validation Tests
		it('should return 400 when week parameter is missing', async () => {
			await testApiHandler({
				appHandler,
				url: '/api/plan/week?year=2024',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Week and year parameters are required');
				},
			});
		});

		it('should return 400 when year parameter is missing', async () => {
			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=1',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Week and year parameters are required');
				},
			});
		});

		it('should return 400 when both week and year are missing', async () => {
			await testApiHandler({
				appHandler,
				url: '/api/plan/week',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Week and year parameters are required');
				},
			});
		});

		it('should return 400 when week is 0', async () => {
			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=0&year=2024',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Week and year parameters are required');
				},
			});
		});

		it('should return 400 when year is 0', async () => {
			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=1&year=0',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Week and year parameters are required');
				},
			});
		});

		it('should return 400 when week is not a number (NaN)', async () => {
			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=abc&year=2024',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Week and year parameters are required');
				},
			});
		});

		it('should return 400 when year is not a number (NaN)', async () => {
			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=1&year=xyz',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Week and year parameters are required');
				},
			});
		});

		it('should handle negative week values', async () => {
			mockGetNextWeekRecipes.mockResolvedValueOnce([]);

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=-1&year=2024',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					// The current implementation doesn't validate for negative values
					// This test documents actual behavior - it accepts negative values
					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.week).toBe(-1);
				},
			});
		});

		it('should handle negative year values', async () => {
			mockGetNextWeekRecipes.mockResolvedValueOnce([]);

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=1&year=-2024',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					// The current implementation doesn't validate for negative years
					// This test documents actual behavior - it accepts negative years
					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.year).toBe(-2024);
				},
			});
		});

		it('should handle week values > 52', async () => {
			mockGetNextWeekRecipes.mockResolvedValueOnce([]);

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=53&year=2024',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					// The current implementation doesn't validate week range
					// This test documents actual behavior - it accepts week > 52
					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.week).toBe(53);
				},
			});
		});

		it('should handle unrealistic year values', async () => {
			mockGetNextWeekRecipes.mockResolvedValueOnce([]);

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=1&year=3000',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					// The current implementation doesn't validate year range
					// This test documents actual behavior - it accepts any year
					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.year).toBe(3000);
				},
			});
		});

		// Success Cases
		it('should successfully fetch recipes for valid week/year', async () => {
			const mockRecipes = [
				{
					id: 1,
					name: 'Recipe 1',
					image_filename: 'recipe1.jpg',
					pdf_filename: 'recipe1.pdf',
					url_slug: 'recipe-1',
					collection_url_slug: 'test-collection',
				},
				{
					id: 2,
					name: 'Recipe 2',
					image_filename: 'recipe2.jpg',
					pdf_filename: 'recipe2.pdf',
					url_slug: 'recipe-2',
					collection_url_slug: 'test-collection',
				},
			] as ReturnType<typeof getNextWeekRecipes> extends Promise<infer T> ? T : never;
			mockGetNextWeekRecipes.mockResolvedValueOnce(mockRecipes);

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=1&year=2024',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						recipes: mockRecipes,
						week: 1,
						year: 2024,
					});
				},
			});
		});

		it('should return empty array when no recipes found', async () => {
			mockGetNextWeekRecipes.mockResolvedValueOnce([]);

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=1&year=2024',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						recipes: [],
						week: 1,
						year: 2024,
					});
				},
			});
		});

		it('should include week and year in response', async () => {
			mockGetNextWeekRecipes.mockResolvedValueOnce([]);

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=15&year=2025',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.week).toBe(15);
					expect(data.year).toBe(2025);
				},
			});
		});

		it('should handle week 1 correctly', async () => {
			mockGetNextWeekRecipes.mockResolvedValueOnce([]);

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=1&year=2024',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.week).toBe(1);
				},
			});
		});

		it('should handle week 52 correctly', async () => {
			mockGetNextWeekRecipes.mockResolvedValueOnce([]);

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=52&year=2024',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.week).toBe(52);
				},
			});
		});

		it('should handle leap year weeks', async () => {
			mockGetNextWeekRecipes.mockResolvedValueOnce([]);

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=53&year=2024', // 2024 is a leap year
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.week).toBe(53);
				},
			});
		});

		// Error Handling Tests
		it('should handle database errors gracefully', async () => {
			mockGetNextWeekRecipes.mockRejectedValueOnce(new Error('Database connection failed'));

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=1&year=2024',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data.error).toBe('Database connection failed');
				},
			});
		});

		it('should return 500 when getNextWeekRecipes throws an error', async () => {
			mockGetNextWeekRecipes.mockRejectedValueOnce(new Error('Query failed'));

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=1&year=2024',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(500);
				},
			});
		});

		it('should include error message in response on error', async () => {
			const errorMessage = 'Specific database error';
			mockGetNextWeekRecipes.mockRejectedValueOnce(new Error(errorMessage));

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=1&year=2024',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data.error).toBe(errorMessage);
				},
			});
		});

		// Edge Cases
		it('should handle decimal week values', async () => {
			mockGetNextWeekRecipes.mockResolvedValueOnce([]);

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=1.5&year=2024',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					// parseInt will convert 1.5 to 1
					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.week).toBe(1);
				},
			});
		});

		it('should handle decimal year values', async () => {
			mockGetNextWeekRecipes.mockResolvedValueOnce([]);

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=1&year=2024.5',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					// parseInt will convert 2024.5 to 2024
					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.year).toBe(2024);
				},
			});
		});

		it('should handle very large numbers', async () => {
			mockGetNextWeekRecipes.mockResolvedValueOnce([]);

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=999999&year=999999',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.week).toBe(999999);
					expect(data.year).toBe(999999);
				},
			});
		});

		it('should handle special characters in parameters', async () => {
			// Mock to handle successful case since parsed values might not be NaN
			mockGetNextWeekRecipes.mockResolvedValueOnce([]);

			await testApiHandler({
				appHandler,
				url: '/api/plan/week?week=abc&year=xyz',
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					// Non-numeric strings will result in NaN, triggering 400 error
					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Week and year parameters are required');
				},
			});
		});
	});
});
