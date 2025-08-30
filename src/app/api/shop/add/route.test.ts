/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import { NextResponse } from 'next/server';
import * as appHandler from './route';
import { requireAuth } from '@/lib/auth/helpers';
import { setupConsoleMocks, mockRegularSession } from '@/lib/test-utils';
import pool from '@/lib/db.js';
import type { PoolConnection } from 'mysql2/promise';

// Mock database
jest.mock('@/lib/db.js', () => ({
	getConnection: jest.fn(),
}));

// Mock auth helpers
jest.mock('@/lib/auth/helpers', () => ({
	requireAuth: jest.fn(),
}));

const mockGetConnection = jest.mocked(pool.getConnection);
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

describe('/api/shop/add', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;
	let mockConnection: Partial<PoolConnection>;
	let mockExecute: jest.Mock;
	let mockBeginTransaction: jest.Mock;
	let mockCommit: jest.Mock;
	let mockRollback: jest.Mock;
	let mockRelease: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();

		// Setup mock connection methods
		mockExecute = jest.fn();
		mockBeginTransaction = jest.fn().mockResolvedValue(undefined);
		mockCommit = jest.fn().mockResolvedValue(undefined);
		mockRollback = jest.fn().mockResolvedValue(undefined);
		mockRelease = jest.fn();

		mockConnection = {
			execute: mockExecute,
			beginTransaction: mockBeginTransaction,
			commit: mockCommit,
			rollback: mockRollback,
			release: mockRelease,
		};

		mockGetConnection.mockResolvedValue(mockConnection as PoolConnection);

		consoleMocks = setupConsoleMocks();
	});

	afterEach(() => {
		consoleMocks.cleanup();
	});

	describe('Authentication', () => {
		it('should return 401 when user is not authenticated', async () => {
			const mockResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

			mockRequireAuth.mockResolvedValue({
				authorized: false as const,
				response: mockResponse,
			});

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 1,
							year: 2024,
							name: 'Test Item',
							ingredient_id: 123,
						}),
					});

					expect(response.status).toBe(401);
					const data = await response.json();
					expect(data.error).toBe('Unauthorized');
					expect(mockGetConnection).not.toHaveBeenCalled();
				},
			});
		});
	});

	describe('Validation', () => {
		beforeEach(() => {
			mockRequireAuth.mockResolvedValue({
				authorized: true as const,
				session: mockRegularSession,
				household_id: mockRegularSession.user.household_id,
				user_id: mockRegularSession.user.id,
			});
		});

		it('should return 400 when required fields are missing', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.success).toBe(false);
					expect(data.error).toContain('Missing required fields');
					expect(data.code).toBe('VALIDATION_ERROR');
				},
			});
		});

		it('should return 400 for invalid JSON', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: 'invalid json',
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.success).toBe(false);
					expect(data.error).toBe('Invalid request format');
					expect(data.code).toBe('INVALID_REQUEST_FORMAT');
				},
			});
		});

		it('should return 400 for invalid week number', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 54,
							year: 2024,
							name: 'Test Item',
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.success).toBe(false);
					expect(data.error).toBe('Week must be between 1 and 53');
					expect(data.code).toBe('INVALID_WEEK');
				},
			});
		});

		it('should return 400 for invalid year', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 1,
							year: 1999,
							name: 'Test Item',
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.success).toBe(false);
					expect(data.error).toBe('Year must be between 2000 and 2100');
					expect(data.code).toBe('INVALID_YEAR');
				},
			});
		});
	});

	describe('Success Cases', () => {
		beforeEach(() => {
			mockRequireAuth.mockResolvedValue({
				authorized: true as const,
				session: mockRegularSession,
				household_id: mockRegularSession.user.household_id,
				user_id: mockRegularSession.user.id,
			});
		});

		it('should add item with ingredient_id successfully', async () => {
			// Mock ingredient lookup and insert operations
			mockExecute
				.mockResolvedValueOnce([[{ ingredient_id: 123, cost: 2.5, stockcode: 'TOM123', supermarketCategory_id: 5 }], []]) // Ingredient lookup
				.mockResolvedValueOnce([[{ max_sort: 10 }], []]) // Get max sort
				.mockResolvedValueOnce([{ insertId: 789 }, []]); // Insert shopping_list item

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 10,
							year: 2024,
							ingredient_id: 123,
							name: 'Tomatoes',
						}),
					});

					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data.success).toBe(true);
					expect(data.data.id).toBe(789);

					// Verify transaction was committed
					expect(mockBeginTransaction).toHaveBeenCalled();
					expect(mockCommit).toHaveBeenCalled();
					expect(mockRelease).toHaveBeenCalled();

					// Verify ingredient was looked up (route uses ingredients table, not recipe_ingredients)
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('FROM ingredients'), [123]);
				},
			});
		});

		it('should add item with name successfully', async () => {
			mockExecute
				.mockResolvedValueOnce([[{ max_sort: 10 }], []]) // Get max sort
				.mockResolvedValueOnce([{ insertId: 789 }, []]); // Insert shopping_list item

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 10,
							year: 2024,
							name: 'Custom Item',
						}),
					});

					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data.success).toBe(true);
					expect(data.data.id).toBe(789);

					// Verify transaction was committed
					expect(mockBeginTransaction).toHaveBeenCalled();
					expect(mockCommit).toHaveBeenCalled();
					expect(mockRelease).toHaveBeenCalled();
				},
			});
		});

		it('should use existing shopping list if present', async () => {
			// Note: The route always creates items in shopping_lists table, not a separate list
			mockExecute
				.mockResolvedValueOnce([[{ max_sort: 15 }], []]) // Get max sort
				.mockResolvedValueOnce([{ insertId: 789 }, []]); // Insert shopping_list item

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 10,
							year: 2024,
							name: 'Custom Item',
						}),
					});

					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data.success).toBe(true);
					expect(data.data.id).toBe(789);

					// Should have made 2 execute calls
					expect(mockExecute).toHaveBeenCalledTimes(2);
				},
			});
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			mockRequireAuth.mockResolvedValue({
				authorized: true as const,
				session: mockRegularSession,
				household_id: mockRegularSession.user.household_id,
				user_id: mockRegularSession.user.id,
			});
		});

		it('should handle database connection errors', async () => {
			mockGetConnection.mockRejectedValueOnce(new Error('Connection failed'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 10,
							year: 2024,
							name: 'Test Item',
						}),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data.success).toBe(false);
					expect(data.error).toBe('Failed to add item to shopping list');
					expect(data.code).toBe('DATABASE_ERROR');
				},
			});
		});

		it('should rollback transaction on error', async () => {
			mockExecute
				.mockResolvedValueOnce([[{ max_sort: 10 }], []]) // Get max sort
				.mockRejectedValueOnce(new Error('Insert failed')); // Insert fails

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 10,
							year: 2024,
							name: 'Test Item',
						}),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data.success).toBe(false);

					// Verify rollback was called
					expect(mockRollback).toHaveBeenCalled();
					expect(mockCommit).not.toHaveBeenCalled();
					expect(mockRelease).toHaveBeenCalled();
				},
			});
		});

		it('should handle invalid ingredient_id', async () => {
			// Note: ingredient_id requires name field
			mockExecute
				.mockResolvedValueOnce([[], []]) // No ingredient found (will be treated as text)
				.mockResolvedValueOnce([[{ max_sort: 5 }], []]) // Get max sort
				.mockResolvedValueOnce([{ insertId: 790 }, []]); // Insert as text item

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							week: 10,
							year: 2024,
							ingredient_id: 99999,
							name: 'Unknown Item', // Name is required
						}),
					});

					// With unknown ingredient, it still succeeds but adds as text
					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data.success).toBe(true);
					expect(data.data.id).toBe(790);
				},
			});
		});
	});
});
