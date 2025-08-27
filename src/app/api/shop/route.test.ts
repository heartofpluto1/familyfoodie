/** @jest-environment node */

import { NextRequest } from 'next/server';
import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';

// Mock database module
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
}));

// Mock shop query functions
jest.mock('@/lib/queries/shop', () => ({
	getIngredients: jest.fn(),
	getShoppingList: jest.fn(),
}));

jest.mock('@/lib/auth-middleware', () => jest.requireActual('@/lib/test-utils').authMiddlewareMock);

import { mockRegularUser, mockAdminUser, clearAllMocks, setupConsoleMocks, standardErrorScenarios, mockNonAuthenticatedUser } from '@/lib/test-utils';

// Get mocked functions
const mockGetIngredients = jest.mocked(jest.requireMock('@/lib/queries/shop').getIngredients);
const mockGetShoppingList = jest.mocked(jest.requireMock('@/lib/queries/shop').getShoppingList);

// Test data
const mockIngredientsData = [
	{
		ingredientId: 1,
		name: 'Fresh Tomatoes',
		cost: 2.5,
		stockcode: 'T001',
		supermarketCategory: 'Produce',
		pantryCategory: null,
	},
	{
		ingredientId: 2,
		name: 'Whole Wheat Bread',
		cost: 3.0,
		stockcode: 'B002',
		supermarketCategory: 'Bakery',
		pantryCategory: null,
	},
	{
		ingredientId: 3,
		name: 'Sea Salt',
		cost: 1.25,
		stockcode: 'S003',
		supermarketCategory: null,
		pantryCategory: 'Spices',
	},
];

const mockShoppingListData = {
	fresh: [
		{
			id: 1,
			name: 'Fresh Tomatoes',
			cost: 2.5,
			stockcode: 12345,
			purchased: false,
			sort: 0,
			quantity: '2 cups',
			quantityMeasure: 'cups',
			ingredientId: 1,
			supermarketCategory: 'Produce',
			pantryCategory: null,
			fresh: true,
			household_id: 1,
		},
		{
			id: 2,
			name: 'Fresh Basil',
			cost: 1.5,
			stockcode: 23456,
			purchased: false,
			sort: 1,
			quantity: '1 bunch',
			quantityMeasure: 'bunch',
			ingredientId: 4,
			supermarketCategory: 'Produce',
			pantryCategory: null,
			fresh: true,
			household_id: 1,
		},
	],
	pantry: [
		{
			id: 3,
			name: 'Sea Salt',
			cost: 1.25,
			stockcode: 34567,
			purchased: false,
			sort: 0,
			quantity: '1 tsp',
			quantityMeasure: 'tsp',
			ingredientId: 3,
			supermarketCategory: null,
			pantryCategory: 'Spices',
			fresh: false,
			household_id: 1,
		},
	],
};

const emptyShoppingListData = {
	fresh: [],
	pantry: [],
};

// Helper to create request patcher with query params and authentication
const withQueryParams = (params?: Record<string, string>, user = mockRegularUser) => {
	return (req: NextRequest & { user?: typeof user }) => {
		// Set query params if provided
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				req.nextUrl.searchParams.set(key, value);
			});
		}
		// Set authenticated user
		req.user = user;
		return req;
	};
};

describe('/api/shop', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		clearAllMocks();
		consoleMocks = setupConsoleMocks();
		mockGetIngredients.mockReset();
		mockGetShoppingList.mockReset();
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	afterEach(() => {
		jest.restoreAllMocks();
		consoleMocks.cleanup();
	});

	describe('Authentication & Authorization', () => {
		it('should require authentication', async () => {
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

		it('should pass household_id to query functions when authenticated', async () => {
			mockGetIngredients.mockResolvedValueOnce(mockIngredientsData);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					expect(mockGetIngredients).toHaveBeenCalledWith(mockRegularUser.household_id);
				},
				requestPatcher: withQueryParams({ endpoint: 'ingredients' }),
			});
		});

		it('should work with different household contexts', async () => {
			const differentHouseholdUser = { ...mockAdminUser, household_id: 99 };
			mockGetIngredients.mockResolvedValueOnce([]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					expect(mockGetIngredients).toHaveBeenCalledWith(99);
				},
				requestPatcher: withQueryParams({ endpoint: 'ingredients' }, differentHouseholdUser),
			});
		});
	});

	describe('Ingredients Endpoint (?endpoint=ingredients)', () => {
		it('should return ingredients for authenticated user', async () => {
			mockGetIngredients.mockResolvedValueOnce(mockIngredientsData);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();

					expect(data).toEqual({
						data: mockIngredientsData,
						success: true,
					});

					expect(mockGetIngredients).toHaveBeenCalledWith(mockRegularUser.household_id);
				},
				requestPatcher: withQueryParams({ endpoint: 'ingredients' }),
			});
		});

		it('should return empty array when no ingredients exist', async () => {
			mockGetIngredients.mockResolvedValueOnce([]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();

					expect(data).toEqual({
						data: [],
						success: true,
					});
				},
				requestPatcher: withQueryParams({ endpoint: 'ingredients' }),
			});
		});

		it('should handle database errors gracefully', async () => {
			mockGetIngredients.mockRejectedValueOnce(standardErrorScenarios.databaseError);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(500);
					const data = await response.json();

					expect(data).toEqual({
						success: false,
						error: 'Failed to fetch ingredients. Please try again later.',
						code: 'INTERNAL_ERROR',
					});
				},
				requestPatcher: withQueryParams({ endpoint: 'ingredients' }),
			});
		});

		it('should handle non-Error exceptions', async () => {
			mockGetIngredients.mockRejectedValueOnce('String error');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(500);
					const data = await response.json();

					expect(data).toEqual({
						success: false,
						error: 'Failed to fetch ingredients. Please try again later.',
						code: 'INTERNAL_ERROR',
					});
				},
				requestPatcher: withQueryParams({ endpoint: 'ingredients' }),
			});
		});
	});

	describe('Shopping List Endpoint (?endpoint=week)', () => {
		it('should return shopping list with default week and year', async () => {
			mockGetShoppingList.mockResolvedValueOnce(mockShoppingListData);

			// Mock current date for consistent testing
			jest.useFakeTimers();
			jest.setSystemTime(new Date('2024-08-15T12:00:00Z')); // Week 33 of 2024

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();

					expect(data).toEqual({
						success: true,
						data: mockShoppingListData,
					});

					// Should use current week (33) and year (2024)
					expect(mockGetShoppingList).toHaveBeenCalledWith('33', '2024', mockRegularUser.household_id);
				},
				requestPatcher: withQueryParams({ endpoint: 'week' }),
			});

			jest.useRealTimers();
		});

		it('should use custom week and year when provided', async () => {
			mockGetShoppingList.mockResolvedValueOnce(mockShoppingListData);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();

					expect(data).toEqual({
						success: true,
						data: mockShoppingListData,
					});

					expect(mockGetShoppingList).toHaveBeenCalledWith('52', '2023', mockRegularUser.household_id);
				},
				requestPatcher: withQueryParams({ endpoint: 'week', week: '52', year: '2023' }),
			});
		});

		it('should handle partial parameters (only week)', async () => {
			mockGetShoppingList.mockResolvedValueOnce(emptyShoppingListData);

			// Mock current date for year
			jest.useFakeTimers();
			jest.setSystemTime(new Date('2024-08-15T12:00:00Z'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					expect(mockGetShoppingList).toHaveBeenCalledWith('25', '2024', mockRegularUser.household_id);
				},
				requestPatcher: withQueryParams({ endpoint: 'week', week: '25' }),
			});

			jest.useRealTimers();
		});

		it('should handle partial parameters (only year)', async () => {
			mockGetShoppingList.mockResolvedValueOnce(emptyShoppingListData);

			// Mock current date for week calculation
			jest.useFakeTimers();
			jest.setSystemTime(new Date('2024-08-15T12:00:00Z')); // Week 33

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					expect(mockGetShoppingList).toHaveBeenCalledWith('33', '2025', mockRegularUser.household_id);
				},
				requestPatcher: withQueryParams({ endpoint: 'week', year: '2025' }),
			});

			jest.useRealTimers();
		});

		it('should return empty shopping list when no items exist', async () => {
			mockGetShoppingList.mockResolvedValueOnce(emptyShoppingListData);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();

					expect(data).toEqual({
						success: true,
						data: emptyShoppingListData,
					});
				},
				requestPatcher: withQueryParams({ endpoint: 'week', week: '1', year: '2025' }),
			});
		});

		it('should handle database errors for shopping list', async () => {
			mockGetShoppingList.mockRejectedValueOnce(new Error('Shopping list query failed'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(500);
					const data = await response.json();

					expect(data).toEqual({
						success: false,
						error: 'Failed to fetch shopping list. Please try again later.',
						code: 'INTERNAL_ERROR',
					});
				},
				requestPatcher: withQueryParams({ endpoint: 'week' }),
			});
		});

		it('should handle household isolation for different users', async () => {
			const household2User = { ...mockRegularUser, household_id: 2 };
			const household2ShoppingData = {
				fresh: [{ id: 10, name: 'Different Household Item', fresh: true, household_id: 2 }],
				pantry: [],
			};

			mockGetShoppingList.mockResolvedValueOnce(household2ShoppingData);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					const data = await response.json();

					expect(data.data).toEqual(household2ShoppingData);
					expect(mockGetShoppingList).toHaveBeenCalledWith('32', '2024', 2);
				},
				requestPatcher: withQueryParams({ endpoint: 'week', week: '32', year: '2024' }, household2User),
			});
		});
	});

	describe('Invalid Endpoint Handling', () => {
		it('should return 404 for unknown endpoint', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(404);
					const data = await response.json();

					expect(data).toEqual({
						success: false,
						error: 'Invalid endpoint. Valid endpoints are: ingredients, week',
						code: 'INVALID_ENDPOINT',
					});
				},
				requestPatcher: withQueryParams({ endpoint: 'unknown' }),
			});
		});

		it('should return 404 when endpoint parameter is missing', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(404);
					const data = await response.json();

					expect(data).toEqual({
						success: false,
						error: 'Endpoint parameter is required',
						code: 'MISSING_PARAMETER',
					});
				},
				requestPatcher: withQueryParams({}),
			});
		});

		it('should return 404 for empty endpoint parameter', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(404);
					const data = await response.json();

					expect(data).toEqual({
						success: false,
						error: 'Endpoint parameter is required',
						code: 'MISSING_PARAMETER',
					});
				},
				requestPatcher: withQueryParams({ endpoint: '' }),
			});
		});
	});

	describe('Parameter Validation', () => {
		it('should validate week parameter is a valid number', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(400);
					const data = await response.json();

					expect(data).toEqual({
						success: false,
						error: 'Invalid week parameter. Week must be a number between 1 and 53.',
						code: 'INVALID_PARAMETER',
					});
				},
				requestPatcher: withQueryParams({ endpoint: 'week', week: 'invalid' }),
			});
		});

		it('should validate week parameter is within valid range', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(400);
					const data = await response.json();

					expect(data).toEqual({
						success: false,
						error: 'Invalid week parameter. Week must be a number between 1 and 53.',
						code: 'INVALID_PARAMETER',
					});
				},
				requestPatcher: withQueryParams({ endpoint: 'week', week: '54' }),
			});
		});

		it('should validate week parameter is not zero or negative', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(400);
					const data = await response.json();

					expect(data).toEqual({
						success: false,
						error: 'Invalid week parameter. Week must be a number between 1 and 53.',
						code: 'INVALID_PARAMETER',
					});
				},
				requestPatcher: withQueryParams({ endpoint: 'week', week: '0' }),
			});
		});

		it('should validate year parameter is a valid number', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(400);
					const data = await response.json();

					expect(data).toEqual({
						success: false,
						error: 'Invalid year parameter. Year must be a valid 4-digit number.',
						code: 'INVALID_PARAMETER',
					});
				},
				requestPatcher: withQueryParams({ endpoint: 'week', year: 'notayear' }),
			});
		});

		it('should validate year parameter is within reasonable range', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(400);
					const data = await response.json();

					expect(data).toEqual({
						success: false,
						error: 'Invalid year parameter. Year must be between 2015 and 2030.',
						code: 'INVALID_PARAMETER',
					});
				},
				requestPatcher: withQueryParams({ endpoint: 'week', year: '2050' }),
			});
		});

		it('should validate year is not too far in the past', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(400);
					const data = await response.json();

					expect(data).toEqual({
						success: false,
						error: 'Invalid year parameter. Year must be between 2015 and 2030.',
						code: 'INVALID_PARAMETER',
					});
				},
				requestPatcher: withQueryParams({ endpoint: 'week', year: '1999' }),
			});
		});
	});

	describe('Week/Year Calculation Edge Cases', () => {
		it('should handle year boundary correctly', async () => {
			mockGetShoppingList.mockResolvedValueOnce(emptyShoppingListData);

			// New Year's Day 2024 (should be week 1)
			jest.useFakeTimers();
			jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					expect(mockGetShoppingList).toHaveBeenCalledWith('1', '2024', mockRegularUser.household_id);
				},
				requestPatcher: withQueryParams({ endpoint: 'week' }),
			});

			jest.useRealTimers();
		});

		it('should handle end of year correctly', async () => {
			mockGetShoppingList.mockResolvedValueOnce(emptyShoppingListData);

			// December 31st, 2024
			jest.useFakeTimers();
			jest.setSystemTime(new Date('2024-12-31T12:00:00Z'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					// Should be week 53 for 2024 (leap year)
					expect(mockGetShoppingList).toHaveBeenCalledWith('53', '2024', mockRegularUser.household_id);
				},
				requestPatcher: withQueryParams({ endpoint: 'week' }),
			});

			jest.useRealTimers();
		});
	});

	describe('Response Format Consistency', () => {
		it('should return consistent success response format', async () => {
			mockGetIngredients.mockResolvedValueOnce(mockIngredientsData);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(200);
					expect(response.headers.get('content-type')).toContain('application/json');

					const data = await response.json();
					expect(data).toHaveProperty('success', true);
					expect(data).toHaveProperty('data');
					expect(data).not.toHaveProperty('error');
				},
				requestPatcher: withQueryParams({ endpoint: 'ingredients' }),
			});
		});

		it('should return consistent error response format', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'GET',
					});

					expect(response.status).toBe(404);
					expect(response.headers.get('content-type')).toContain('application/json');

					const data = await response.json();
					expect(data).toHaveProperty('success', false);
					expect(data).toHaveProperty('error');
					expect(data).not.toHaveProperty('data');
				},
				requestPatcher: withQueryParams({ endpoint: 'invalid' }),
			});
		});
	});

	describe('Performance & Load Tests', () => {
		it('should handle multiple concurrent requests', async () => {
			mockGetIngredients.mockResolvedValue(mockIngredientsData);
			mockGetShoppingList.mockResolvedValue(mockShoppingListData);

			const requests = Array.from({ length: 5 }, (_, i) =>
				testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data.success).toBe(true);
					},
					requestPatcher: withQueryParams({ endpoint: i % 2 === 0 ? 'ingredients' : 'week' }),
				})
			);

			await Promise.all(requests);

			// Verify all requests were handled
			expect(mockGetIngredients).toHaveBeenCalledTimes(3); // 3 ingredients calls
			expect(mockGetShoppingList).toHaveBeenCalledTimes(2); // 2 shopping list calls
		});
	});
});
