/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import { NextResponse } from 'next/server';
import * as appHandler from './route';
import { setupConsoleMocks, mockRegularSession } from '@/lib/test-utils';
import { requireAuth } from '@/lib/auth/helpers';
import { deleteWeekRecipes } from '@/lib/queries/menus';

// Mock database queries
jest.mock('@/lib/queries/menus', () => ({
	deleteWeekRecipes: jest.fn(),
}));

// Mock OAuth auth helpers
jest.mock('@/lib/auth/helpers', () => ({
	requireAuth: jest.fn(),
}));

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

const mockDeleteWeekRecipes = jest.mocked(deleteWeekRecipes);

describe('/api/plan/delete', () => {
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

	describe('POST /api/plan/delete', () => {
		describe('Authentication Tests', () => {
			it('should return 401 when user is not authenticated', async () => {
				mockRequireAuth.mockResolvedValue({
					authorized: false as const,
					response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
				});

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 1, year: 2024 }),
						});

						expect(response.status).toBe(401);
						expect(mockDeleteWeekRecipes).not.toHaveBeenCalled();
					},
				});
			});

			it('should pass household_id from authenticated user to database query', async () => {
				mockDeleteWeekRecipes.mockResolvedValueOnce(undefined);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 1, year: 2024 }),
						});

						expect(response.status).toBe(200);
						expect(mockDeleteWeekRecipes).toHaveBeenCalledWith(1, 2024, mockRegularSession.user.household_id);
					},
				});
			});
		});

		describe('Input Validation Tests', () => {
			it('should return 400 when week is missing', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ year: 2024 }),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.error).toBe('Week and year are required');
						expect(mockDeleteWeekRecipes).not.toHaveBeenCalled();
					},
				});
			});

			it('should return 400 when year is missing', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 1 }),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.error).toBe('Week and year are required');
						expect(mockDeleteWeekRecipes).not.toHaveBeenCalled();
					},
				});
			});

			it('should return 400 when both week and year are missing', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({}),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.error).toBe('Week and year are required');
						expect(mockDeleteWeekRecipes).not.toHaveBeenCalled();
					},
				});
			});

			it('should return 400 when week is null', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: null, year: 2024 }),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.error).toBe('Week and year are required');
						expect(mockDeleteWeekRecipes).not.toHaveBeenCalled();
					},
				});
			});

			it('should return 400 when year is null', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 1, year: null }),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.error).toBe('Week and year are required');
						expect(mockDeleteWeekRecipes).not.toHaveBeenCalled();
					},
				});
			});

			it('should return 400 when week is 0', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 0, year: 2024 }),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.error).toBe('Week and year are required');
						expect(mockDeleteWeekRecipes).not.toHaveBeenCalled();
					},
				});
			});

			it('should return 400 when year is 0', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 1, year: 0 }),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.error).toBe('Week and year are required');
						expect(mockDeleteWeekRecipes).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Success Path Tests', () => {
			it('should successfully delete week recipes', async () => {
				mockDeleteWeekRecipes.mockResolvedValueOnce(undefined);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 45, year: 2024 }),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true });
						expect(mockDeleteWeekRecipes).toHaveBeenCalledWith(45, 2024, mockRegularSession.user.household_id);
					},
				});
			});

			it('should handle valid week 1', async () => {
				mockDeleteWeekRecipes.mockResolvedValueOnce(undefined);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 1, year: 2024 }),
						});

						expect(response.status).toBe(200);
						expect(mockDeleteWeekRecipes).toHaveBeenCalledWith(1, 2024, mockRegularSession.user.household_id);
					},
				});
			});

			it('should handle valid week 52', async () => {
				mockDeleteWeekRecipes.mockResolvedValueOnce(undefined);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 52, year: 2024 }),
						});

						expect(response.status).toBe(200);
						expect(mockDeleteWeekRecipes).toHaveBeenCalledWith(52, 2024, mockRegularSession.user.household_id);
					},
				});
			});

			it('should handle valid week 53 for years with 53 weeks', async () => {
				mockDeleteWeekRecipes.mockResolvedValueOnce(undefined);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 53, year: 2020 }),
						});

						expect(response.status).toBe(200);
						expect(mockDeleteWeekRecipes).toHaveBeenCalledWith(53, 2020, mockRegularSession.user.household_id);
					},
				});
			});

			it('should handle past years', async () => {
				mockDeleteWeekRecipes.mockResolvedValueOnce(undefined);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 10, year: 2020 }),
						});

						expect(response.status).toBe(200);
						expect(mockDeleteWeekRecipes).toHaveBeenCalledWith(10, 2020, mockRegularSession.user.household_id);
					},
				});
			});

			it('should handle future years', async () => {
				mockDeleteWeekRecipes.mockResolvedValueOnce(undefined);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 20, year: 2030 }),
						});

						expect(response.status).toBe(200);
						expect(mockDeleteWeekRecipes).toHaveBeenCalledWith(20, 2030, mockRegularSession.user.household_id);
					},
				});
			});
		});

		describe('Error Handling Tests', () => {
			it('should return 500 when deleteWeekRecipes throws an error', async () => {
				mockDeleteWeekRecipes.mockRejectedValueOnce(new Error('Database connection failed'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 1, year: 2024 }),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data.error).toBe('Database connection failed');
					},
				});
			});

			it('should return generic error message for non-Error exceptions', async () => {
				mockDeleteWeekRecipes.mockRejectedValueOnce('string error');

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 1, year: 2024 }),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data.error).toBe('Failed to delete week recipes');
					},
				});
			});

			it('should handle database timeout errors', async () => {
				mockDeleteWeekRecipes.mockRejectedValueOnce(new Error('Query timeout'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 1, year: 2024 }),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data.error).toBe('Query timeout');
					},
				});
			});

			it('should return 500 for invalid JSON in request body', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: 'invalid json',
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						// The actual error message for invalid JSON parsing
						expect(data.error).toContain('Unexpected token');
					},
				});
			});
		});

		describe('Edge Cases', () => {
			it('should handle string week that can be converted to number', async () => {
				mockDeleteWeekRecipes.mockResolvedValueOnce(undefined);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: '42', year: 2024 }),
						});

						expect(response.status).toBe(200);
						expect(mockDeleteWeekRecipes).toHaveBeenCalledWith('42', 2024, mockRegularSession.user.household_id);
					},
				});
			});

			it('should handle string year that can be converted to number', async () => {
				mockDeleteWeekRecipes.mockResolvedValueOnce(undefined);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 1, year: '2024' }),
						});

						expect(response.status).toBe(200);
						expect(mockDeleteWeekRecipes).toHaveBeenCalledWith(1, '2024', mockRegularSession.user.household_id);
					},
				});
			});

			it('should handle negative week number', async () => {
				mockDeleteWeekRecipes.mockResolvedValueOnce(undefined);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: -1, year: 2024 }),
						});

						expect(response.status).toBe(200);
						// The route doesn't validate week numbers, it passes them through
						expect(mockDeleteWeekRecipes).toHaveBeenCalledWith(-1, 2024, mockRegularSession.user.household_id);
					},
				});
			});

			it('should handle very large week number', async () => {
				mockDeleteWeekRecipes.mockResolvedValueOnce(undefined);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 999, year: 2024 }),
						});

						expect(response.status).toBe(200);
						// The route doesn't validate week numbers, it passes them through
						expect(mockDeleteWeekRecipes).toHaveBeenCalledWith(999, 2024, mockRegularSession.user.household_id);
					},
				});
			});

			it('should handle decimal week number', async () => {
				mockDeleteWeekRecipes.mockResolvedValueOnce(undefined);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 1.5, year: 2024 }),
						});

						expect(response.status).toBe(200);
						expect(mockDeleteWeekRecipes).toHaveBeenCalledWith(1.5, 2024, mockRegularSession.user.household_id);
					},
				});
			});

			it('should handle boolean true for week (treated as 1)', async () => {
				mockDeleteWeekRecipes.mockResolvedValueOnce(undefined);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: true, year: 2024 }),
						});

						expect(response.status).toBe(200);
						expect(mockDeleteWeekRecipes).toHaveBeenCalledWith(true, 2024, mockRegularSession.user.household_id);
					},
				});
			});

			it('should return 400 for boolean false for week (treated as falsy)', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: false, year: 2024 }),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.error).toBe('Week and year are required');
					},
				});
			});

			it('should handle extra fields in request body', async () => {
				mockDeleteWeekRecipes.mockResolvedValueOnce(undefined);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								week: 1,
								year: 2024,
								extraField: 'should be ignored',
								anotherField: 123,
							}),
						});

						expect(response.status).toBe(200);
						expect(mockDeleteWeekRecipes).toHaveBeenCalledWith(1, 2024, mockRegularSession.user.household_id);
					},
				});
			});

			it('should handle empty string for week', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: '', year: 2024 }),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.error).toBe('Week and year are required');
					},
				});
			});

			it('should handle undefined values', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: undefined, year: undefined }),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.error).toBe('Week and year are required');
					},
				});
			});
		});

		describe('HTTP Method Tests', () => {
			it('should only accept POST method', async () => {
				// GET should not be handled
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(405);
					},
				});
			});

			it('should reject PUT method', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 1, year: 2024 }),
						});

						expect(response.status).toBe(405);
					},
				});
			});

			it('should reject DELETE method', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
						});

						expect(response.status).toBe(405);
					},
				});
			});

			it('should reject PATCH method', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ week: 1, year: 2024 }),
						});

						expect(response.status).toBe(405);
					},
				});
			});
		});
	});
});
