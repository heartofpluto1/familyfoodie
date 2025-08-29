/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { setupConsoleMocks, mockAuthenticatedUser, mockNonAuthenticatedUser } from '@/lib/test-utils';
import { saveWeekRecipes } from '@/lib/queries/menus';
import type { NextRequest } from 'next/server';
import type { SessionUser } from '@/types/auth';

// Mock database queries
jest.mock('@/lib/queries/menus', () => ({
	saveWeekRecipes: jest.fn(),
}));

// Mock auth middleware
jest.mock('@/lib/auth-middleware', () => jest.requireActual('@/lib/test-utils').authMiddlewareMock);

const mockSaveWeekRecipes = jest.mocked(saveWeekRecipes);

describe('/api/plan/save', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('POST /api/plan/save', () => {
		// Authentication Tests
		it('should return 401 when user is not authenticated', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockNonAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 1,
							year: 2024,
							recipeIds: [1, 2, 3],
						}),
					});

					expect(response.status).toBe(401);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Authentication required',
						code: 'UNAUTHORIZED',
					});
					expect(mockSaveWeekRecipes).not.toHaveBeenCalled();
				},
			});
		});

		// Input Validation Tests
		it('should return 400 when week is missing', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 123;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							year: 2024,
							recipeIds: [1, 2, 3],
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({ error: 'Invalid request data' });
					expect(mockSaveWeekRecipes).not.toHaveBeenCalled();
				},
			});
		});

		it('should return 400 when year is missing', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 123;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 1,
							recipeIds: [1, 2, 3],
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({ error: 'Invalid request data' });
					expect(mockSaveWeekRecipes).not.toHaveBeenCalled();
				},
			});
		});

		it('should return 400 when recipeIds is missing', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 123;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 1,
							year: 2024,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({ error: 'Invalid request data' });
					expect(mockSaveWeekRecipes).not.toHaveBeenCalled();
				},
			});
		});

		it('should return 400 when recipeIds is not an array', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 123;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 1,
							year: 2024,
							recipeIds: 'not-an-array',
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({ error: 'Invalid request data' });
					expect(mockSaveWeekRecipes).not.toHaveBeenCalled();
				},
			});
		});

		it('should return 400 when week is invalid (zero)', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 123;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 0,
							year: 2024,
							recipeIds: [1, 2, 3],
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({ error: 'Invalid request data' });
					expect(mockSaveWeekRecipes).not.toHaveBeenCalled();
				},
			});
		});

		it('should return 400 when year is invalid (zero)', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 123;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 1,
							year: 0,
							recipeIds: [1, 2, 3],
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({ error: 'Invalid request data' });
					expect(mockSaveWeekRecipes).not.toHaveBeenCalled();
				},
			});
		});

		// Success Cases
		it('should successfully save week recipes with valid data', async () => {
			mockSaveWeekRecipes.mockResolvedValueOnce(undefined);

			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 123;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 1,
							year: 2024,
							recipeIds: [1, 2, 3],
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({ success: true });

					expect(mockSaveWeekRecipes).toHaveBeenCalledWith(1, 2024, [1, 2, 3], 123);
					expect(mockSaveWeekRecipes).toHaveBeenCalledTimes(1);
				},
			});
		});

		it('should successfully save empty recipe list', async () => {
			mockSaveWeekRecipes.mockResolvedValueOnce(undefined);

			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 456;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 52,
							year: 2024,
							recipeIds: [],
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({ success: true });

					expect(mockSaveWeekRecipes).toHaveBeenCalledWith(52, 2024, [], 456);
				},
			});
		});

		it('should successfully save large number of recipes', async () => {
			const manyRecipeIds = Array.from({ length: 20 }, (_, i) => i + 1);
			mockSaveWeekRecipes.mockResolvedValueOnce(undefined);

			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 789;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 26,
							year: 2025,
							recipeIds: manyRecipeIds,
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({ success: true });

					expect(mockSaveWeekRecipes).toHaveBeenCalledWith(26, 2025, manyRecipeIds, 789);
				},
			});
		});

		// Edge Cases
		it('should handle week 53 properly', async () => {
			mockSaveWeekRecipes.mockResolvedValueOnce(undefined);

			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 123;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 53,
							year: 2024,
							recipeIds: [10, 20],
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({ success: true });

					expect(mockSaveWeekRecipes).toHaveBeenCalledWith(53, 2024, [10, 20], 123);
				},
			});
		});

		it('should handle duplicate recipe IDs in the array', async () => {
			mockSaveWeekRecipes.mockResolvedValueOnce(undefined);

			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 123;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 15,
							year: 2024,
							recipeIds: [1, 2, 2, 3, 1],
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({ success: true });

					// The function receives the array as-is, deduplication is handled by saveWeekRecipes
					expect(mockSaveWeekRecipes).toHaveBeenCalledWith(15, 2024, [1, 2, 2, 3, 1], 123);
				},
			});
		});

		// Error Handling
		it('should return 500 when saveWeekRecipes throws an error', async () => {
			mockSaveWeekRecipes.mockRejectedValueOnce(new Error('Database connection failed'));

			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 123;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 1,
							year: 2024,
							recipeIds: [1, 2, 3],
						}),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({ error: 'Database connection failed' });
				},
			});
		});

		it('should return 500 with generic message for non-Error exceptions', async () => {
			mockSaveWeekRecipes.mockRejectedValueOnce('String error');

			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 123;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 1,
							year: 2024,
							recipeIds: [1, 2, 3],
						}),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({ error: 'Failed to save week recipes' });
				},
			});
		});

		it('should handle transaction rollback errors', async () => {
			mockSaveWeekRecipes.mockRejectedValueOnce(new Error('Transaction rollback: Constraint violation'));

			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 123;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 1,
							year: 2024,
							recipeIds: [999999], // Non-existent recipe ID
						}),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({ error: 'Transaction rollback: Constraint violation' });
				},
			});
		});

		// Invalid JSON
		it('should handle invalid JSON in request body', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 123;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: 'invalid json {]',
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					// Next.js throws its own JSON parsing error
					expect(data.error).toContain('JSON');
					expect(mockSaveWeekRecipes).not.toHaveBeenCalled();
				},
			});
		});

		// Household Isolation Tests
		it('should save recipes only for the authenticated household', async () => {
			mockSaveWeekRecipes.mockResolvedValueOnce(undefined);

			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 999;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 10,
							year: 2024,
							recipeIds: [5, 6, 7],
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({ success: true });

					// Verify household_id is passed correctly
					expect(mockSaveWeekRecipes).toHaveBeenCalledWith(10, 2024, [5, 6, 7], 999);
				},
			});
		});

		it('should handle different households independently', async () => {
			mockSaveWeekRecipes.mockResolvedValue(undefined);

			// First household
			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 100;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 5,
							year: 2024,
							recipeIds: [1, 2],
						}),
					});

					expect(response.status).toBe(200);
					expect(mockSaveWeekRecipes).toHaveBeenCalledWith(5, 2024, [1, 2], 100);
				},
			});

			// Second household
			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 200;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 5,
							year: 2024,
							recipeIds: [3, 4],
						}),
					});

					expect(response.status).toBe(200);
					expect(mockSaveWeekRecipes).toHaveBeenCalledWith(5, 2024, [3, 4], 200);
				},
			});

			expect(mockSaveWeekRecipes).toHaveBeenCalledTimes(2);
		});

		// Special Character and Type Tests
		it('should handle non-integer recipe IDs in array', async () => {
			mockSaveWeekRecipes.mockResolvedValueOnce(undefined);

			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 123;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 1,
							year: 2024,
							recipeIds: [1, '2', 3], // String in the array
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({ success: true });

					// The route passes the data as-is to saveWeekRecipes
					expect(mockSaveWeekRecipes).toHaveBeenCalledWith(1, 2024, [1, '2', 3], 123);
				},
			});
		});

		it('should handle future years', async () => {
			mockSaveWeekRecipes.mockResolvedValueOnce(undefined);

			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 123;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 1,
							year: 2030,
							recipeIds: [1, 2, 3],
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({ success: true });

					expect(mockSaveWeekRecipes).toHaveBeenCalledWith(1, 2030, [1, 2, 3], 123);
				},
			});
		});

		it('should handle past years', async () => {
			mockSaveWeekRecipes.mockResolvedValueOnce(undefined);

			await testApiHandler({
				appHandler,
				requestPatcher: (req: NextRequest & { user?: SessionUser }) => {
					mockAuthenticatedUser(req);
					req.user!.household_id = 123;
					return req;
				},
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 45,
							year: 2020,
							recipeIds: [10, 11],
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({ success: true });

					expect(mockSaveWeekRecipes).toHaveBeenCalledWith(45, 2020, [10, 11], 123);
				},
			});
		});
	});
});
