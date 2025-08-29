/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { setupConsoleMocks, mockAuthenticatedUser, mockNonAuthenticatedUser, mockRegularUser, standardErrorScenarios } from '@/lib/test-utils';

// Mock the resetShoppingListFromRecipes function
jest.mock('@/lib/queries/menus', () => ({
	resetShoppingListFromRecipes: jest.fn(),
}));

// Mock auth middleware
jest.mock('@/lib/auth-middleware', () => jest.requireActual('@/lib/test-utils').authMiddlewareMock);

// Get mocked functions
const mockResetShoppingListFromRecipes = jest.mocked(jest.requireMock('@/lib/queries/menus').resetShoppingListFromRecipes);

describe('/api/shop/reset', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		jest.clearAllMocks();
		mockResetShoppingListFromRecipes.mockResolvedValue(undefined);
		consoleMocks = setupConsoleMocks();
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('Authentication Tests', () => {
		it('should return 401 for unauthenticated requests', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 45,
							year: 2024,
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

		it('should proceed for authenticated requests', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 45,
							year: 2024,
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({ success: true });
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});
	});

	describe('Request Validation Tests', () => {
		it('should return 400 when week is missing', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							year: 2024,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Missing required field: week',
						code: 'VALIDATION_ERROR',
						details: {
							field: 'week',
							message: 'Week is required',
						},
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 when year is missing', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 45,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Missing required field: year',
						code: 'VALIDATION_ERROR',
						details: {
							field: 'year',
							message: 'Year is required',
						},
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 when both week and year are missing', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Missing required fields',
						code: 'VALIDATION_ERROR',
						details: 'All fields (week, year) are required',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should accept week as string number', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: '45',
							year: 2024,
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({ success: true });
					expect(mockResetShoppingListFromRecipes).toHaveBeenCalledWith(45, 2024, mockRegularUser.household_id);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should accept year as string number', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 45,
							year: '2024',
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({ success: true });
					expect(mockResetShoppingListFromRecipes).toHaveBeenCalledWith(45, 2024, mockRegularUser.household_id);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});
	});

	describe('Edge Cases & Invalid Data Tests', () => {
		it('should handle week value of 0 (falsy but invalid)', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 0,
							year: 2024,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Invalid week number',
						code: 'VALIDATION_ERROR',
						details: 'Week must be a number between 1 and 53',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle year value of 0 (falsy but invalid)', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 45,
							year: 0,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Invalid year',
						code: 'VALIDATION_ERROR',
						details: 'Year must be between 2015 and 2050',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle null values', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: null,
							year: null,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Missing required fields',
						code: 'VALIDATION_ERROR',
						details: 'All fields (week, year) are required',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle undefined values', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: undefined,
							year: undefined,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Missing required fields',
						code: 'VALIDATION_ERROR',
						details: 'All fields (week, year) are required',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});
	});

	describe('Successful Operation Tests', () => {
		it('should successfully reset shopping list with valid parameters', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 45,
							year: 2024,
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({ success: true });
					expect(mockResetShoppingListFromRecipes).toHaveBeenCalledWith(45, 2024, mockRegularUser.household_id);
					expect(mockResetShoppingListFromRecipes).toHaveBeenCalledTimes(1);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle extreme valid week values', async () => {
			// Test week 1
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 1,
							year: 2024,
						}),
					});

					expect(response.status).toBe(200);
					expect(mockResetShoppingListFromRecipes).toHaveBeenCalledWith(1, 2024, mockRegularUser.household_id);
				},
				requestPatcher: mockAuthenticatedUser,
			});

			// Test week 53
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 53,
							year: 2024,
						}),
					});

					expect(response.status).toBe(200);
					expect(mockResetShoppingListFromRecipes).toHaveBeenCalledWith(53, 2024, mockRegularUser.household_id);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle extreme valid year values', async () => {
			// Test year 2015 (minimum)
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 45,
							year: 2015,
						}),
					});

					expect(response.status).toBe(200);
					expect(mockResetShoppingListFromRecipes).toHaveBeenCalledWith(45, 2015, mockRegularUser.household_id);
				},
				requestPatcher: mockAuthenticatedUser,
			});

			// Test year 2050 (maximum)
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 45,
							year: 2050,
						}),
					});

					expect(response.status).toBe(200);
					expect(mockResetShoppingListFromRecipes).toHaveBeenCalledWith(45, 2050, mockRegularUser.household_id);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});
	});

	describe('Household Scoping & Security Tests', () => {
		it('should pass the authenticated user household_id to resetShoppingListFromRecipes', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 45,
							year: 2024,
						}),
					});

					expect(response.status).toBe(200);
					// Verify household_id from mockRegularUser (household_id: 1) is passed
					expect(mockResetShoppingListFromRecipes).toHaveBeenCalledWith(45, 2024, 1);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should use household_id from authenticated user, not from request body', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 45,
							year: 2024,
							household_id: 999, // This should be ignored
						}),
					});

					expect(response.status).toBe(200);
					// Should use household_id from auth middleware (1), not from body (999)
					expect(mockResetShoppingListFromRecipes).toHaveBeenCalledWith(45, 2024, 1);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});
	});

	describe('Error Handling Tests', () => {
		it('should handle resetShoppingListFromRecipes throwing an Error', async () => {
			mockResetShoppingListFromRecipes.mockRejectedValue(standardErrorScenarios.databaseError);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 45,
							year: 2024,
						}),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Database operation failed',
						code: 'DATABASE_ERROR',
						details: 'Database connection failed',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle resetShoppingListFromRecipes throwing a non-Error', async () => {
			mockResetShoppingListFromRecipes.mockRejectedValue('Unexpected error');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 45,
							year: 2024,
						}),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Internal server error',
						code: 'INTERNAL_ERROR',
						details: 'An unexpected error occurred',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle invalid JSON in request body', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: 'invalid json',
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Invalid request format',
						code: 'INVALID_JSON',
						details: 'Request body must be valid JSON',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});
	});

	describe('Type and Range Validation Tests', () => {
		it('should reject week values above 53', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 54,
							year: 2024,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Invalid week number',
						code: 'VALIDATION_ERROR',
						details: 'Week must be a number between 1 and 53',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should reject week values below 1', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: -5,
							year: 2024,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Invalid week number',
						code: 'VALIDATION_ERROR',
						details: 'Week must be a number between 1 and 53',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should reject year values below 2015', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 45,
							year: 2014,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Invalid year',
						code: 'VALIDATION_ERROR',
						details: 'Year must be between 2015 and 2050',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should reject year values above 2050', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 45,
							year: 2051,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Invalid year',
						code: 'VALIDATION_ERROR',
						details: 'Year must be between 2015 and 2050',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should reject non-numeric week values', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 'invalid',
							year: 2024,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Invalid week number',
						code: 'VALIDATION_ERROR',
						details: 'Week must be a number between 1 and 53',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should reject non-numeric year values', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 45,
							year: 'invalid',
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Invalid year',
						code: 'VALIDATION_ERROR',
						details: 'Year must be between 2015 and 2050',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should reject boolean values for week and year', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: true,
							year: false,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Invalid week number',
						code: 'VALIDATION_ERROR',
						details: 'Week must be a number between 1 and 53',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should reject array values for week and year', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: [45],
							year: [2024],
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Invalid week number',
						code: 'VALIDATION_ERROR',
						details: 'Week must be a number between 1 and 53',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});
	});
});
