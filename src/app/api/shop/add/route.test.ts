/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { setupConsoleMocks, mockAuthenticatedUser, mockNonAuthenticatedUser } from '@/lib/test-utils';
import pool from '@/lib/db.js';
import type { PoolConnection } from 'mysql2/promise';

// Mock database
jest.mock('@/lib/db.js', () => ({
	getConnection: jest.fn(),
}));

// Mock auth middleware
jest.mock('@/lib/auth-middleware', () => jest.requireActual('@/lib/test-utils').authMiddlewareMock);

const mockGetConnection = jest.mocked(pool.getConnection);

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

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('Authentication Tests', () => {
		it('should return 401 for unauthenticated requests', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockNonAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 1,
							year: 2024,
							name: 'Test Item',
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
			});
		});

		it('should proceed with authenticated requests', async () => {
			// Mock successful addition
			mockExecute
				.mockResolvedValueOnce([[{ max_sort: -1 }], []]) // Get max sort
				.mockResolvedValueOnce([{ insertId: 123 }, []]); // Insert

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 1,
							year: 2024,
							name: 'Test Item',
						}),
					});

					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						data: { id: 123 },
					});
					expect(mockBeginTransaction).toHaveBeenCalled();
				},
			});
		});
	});

	describe('Input Validation Tests', () => {
		it('should return 400 when week is missing', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							year: 2024,
							name: 'Test Item',
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
			});
		});

		it('should return 400 when year is missing', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 1,
							name: 'Test Item',
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
			});
		});

		it('should return 400 when name is missing', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 1,
							year: 2024,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Missing required field: name',
						code: 'VALIDATION_ERROR',
						details: {
							field: 'name',
							message: 'Name is required',
						},
					});
				},
			});
		});

		it('should accept request with all required fields', async () => {
			mockExecute.mockResolvedValueOnce([[{ max_sort: 0 }], []]).mockResolvedValueOnce([{ insertId: 456 }, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 1,
							year: 2024,
							name: 'Milk',
						}),
					});

					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						data: { id: 456 },
					});
				},
			});
		});

		it('should accept request with optional ingredient_id', async () => {
			mockExecute
				.mockResolvedValueOnce([
					[
						{
							ingredient_id: 10,
							cost: 2.99,
							stockcode: 'MLK123',
							supermarketCategory_id: 3,
						},
					],
					[],
				]) // Get ingredient
				.mockResolvedValueOnce([[{ max_sort: 0 }], []])
				.mockResolvedValueOnce([{ insertId: 789 }, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 1,
							year: 2024,
							name: 'Milk',
							ingredient_id: 10,
						}),
					});

					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						data: { id: 789 },
					});
				},
			});
		});
	});

	describe('Database Integration Tests', () => {
		it('should add item without ingredient_id (unknown ingredient)', async () => {
			mockExecute.mockResolvedValueOnce([[{ max_sort: 5 }], []]).mockResolvedValueOnce([{ insertId: 100 }, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 2,
							year: 2024,
							name: 'Custom Item',
						}),
					});

					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						data: { id: 100 },
					});

					// Verify the INSERT query for unknown ingredient
					const insertCall = mockExecute.mock.calls[1];
					expect(insertCall[0]).toContain('INSERT INTO shopping_lists');
					expect(insertCall[1]).toEqual([2, 2024, 1, 'Custom Item', 6]); // household_id=1, sort=6
				},
			});
		});

		it('should add item with valid ingredient_id (known ingredient)', async () => {
			const mockIngredient = {
				ingredient_id: 15,
				cost: 4.5,
				stockcode: 'CHKN001',
				supermarketCategory_id: 7,
			};

			mockExecute
				.mockResolvedValueOnce([[mockIngredient], []]) // Get ingredient
				.mockResolvedValueOnce([[{ max_sort: 2 }], []])
				.mockResolvedValueOnce([{ insertId: 200 }, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 3,
							year: 2024,
							name: 'Chicken Breast',
							ingredient_id: 15,
						}),
					});

					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						data: { id: 200 },
					});

					// Verify ingredient lookup query
					const ingredientQuery = mockExecute.mock.calls[0];
					expect(ingredientQuery[0]).toContain('FROM ingredients i');
					expect(ingredientQuery[0]).toContain('WHERE i.id = ? AND i.public = 1');
					expect(ingredientQuery[1]).toEqual([15]);

					// Verify INSERT includes ingredient data
					const insertCall = mockExecute.mock.calls[2];
					expect(insertCall[1]).toEqual([3, 2024, 1, 'Chicken Breast', 3, 4.5, 'CHKN001']);
				},
			});
		});

		it('should handle non-existent ingredient_id gracefully', async () => {
			mockExecute
				.mockResolvedValueOnce([[], []]) // No ingredient found
				.mockResolvedValueOnce([[{ max_sort: 0 }], []])
				.mockResolvedValueOnce([{ insertId: 300 }, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 4,
							year: 2024,
							name: 'Unknown Item',
							ingredient_id: 999,
						}),
					});

					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						data: { id: 300 },
					});

					// Should insert as unknown ingredient (without cost/stockcode)
					const insertCall = mockExecute.mock.calls[2];
					expect(insertCall[1]).toEqual([4, 2024, 1, 'Unknown Item', 1]);
				},
			});
		});

		it('should handle non-public ingredient_id (public=0)', async () => {
			// Query will return empty since WHERE clause includes "public = 1"
			mockExecute
				.mockResolvedValueOnce([[], []]) // No public ingredient found
				.mockResolvedValueOnce([[{ max_sort: 0 }], []])
				.mockResolvedValueOnce([{ insertId: 400 }, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 5,
							year: 2024,
							name: 'Private Item',
							ingredient_id: 20,
						}),
					});

					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						data: { id: 400 },
					});

					// Should insert as unknown ingredient
					const insertCall = mockExecute.mock.calls[2];
					expect(insertCall[1]).toEqual([5, 2024, 1, 'Private Item', 1]);
				},
			});
		});

		it('should correctly calculate sort order for first item', async () => {
			mockExecute
				.mockResolvedValueOnce([[{ max_sort: -1 }], []]) // No items yet
				.mockResolvedValueOnce([{ insertId: 500 }, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 6,
							year: 2024,
							name: 'First Item',
						}),
					});

					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						data: { id: 500 },
					});

					// First item should have sort=0
					const insertCall = mockExecute.mock.calls[1];
					expect(insertCall[1][4]).toBe(0); // sort value
				},
			});
		});

		it('should correctly increment sort order for subsequent items', async () => {
			mockExecute
				.mockResolvedValueOnce([[{ max_sort: 10 }], []]) // Existing items
				.mockResolvedValueOnce([{ insertId: 600 }, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 7,
							year: 2024,
							name: 'New Item',
						}),
					});

					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						data: { id: 600 },
					});

					// Should have sort=11 (max_sort + 1)
					const insertCall = mockExecute.mock.calls[1];
					expect(insertCall[1][4]).toBe(11);
				},
			});
		});

		it('should maintain household isolation', async () => {
			mockExecute.mockResolvedValueOnce([[{ max_sort: 5 }], []]).mockResolvedValueOnce([{ insertId: 700 }, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 8,
							year: 2024,
							name: 'Household Item',
						}),
					});

					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						data: { id: 700 },
					});

					// Verify household_id is included in sort query
					const sortQuery = mockExecute.mock.calls[0];
					expect(sortQuery[0]).toContain('WHERE week = ? AND year = ? AND household_id = ?');
					expect(sortQuery[1]).toEqual([8, 2024, 1]); // household_id from mockAuthenticatedUser
				},
			});
		});
	});

	describe('Known Ingredient Processing Tests', () => {
		it('should fetch and include ingredient cost', async () => {
			mockExecute
				.mockResolvedValueOnce([[{ ingredient_id: 25, cost: 9.99, stockcode: 'STK001', supermarketCategory_id: 5 }], []])
				.mockResolvedValueOnce([[{ max_sort: 0 }], []])
				.mockResolvedValueOnce([{ insertId: 800 }, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 9,
							year: 2024,
							name: 'Expensive Item',
							ingredient_id: 25,
						}),
					});

					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						data: { id: 800 },
					});

					const insertCall = mockExecute.mock.calls[2];
					expect(insertCall[1][5]).toBe(9.99); // cost parameter
				},
			});
		});

		it('should fetch and include ingredient stockcode', async () => {
			mockExecute
				.mockResolvedValueOnce([[{ ingredient_id: 30, cost: 3.5, stockcode: 'ABC123XYZ', supermarketCategory_id: 2 }], []])
				.mockResolvedValueOnce([[{ max_sort: 0 }], []])
				.mockResolvedValueOnce([{ insertId: 900 }, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 10,
							year: 2024,
							name: 'Coded Item',
							ingredient_id: 30,
						}),
					});

					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						data: { id: 900 },
					});

					const insertCall = mockExecute.mock.calls[2];
					expect(insertCall[1][6]).toBe('ABC123XYZ'); // stockcode parameter
				},
			});
		});

		it('should handle null values in ingredient fields', async () => {
			mockExecute
				.mockResolvedValueOnce([[{ ingredient_id: 35, cost: null, stockcode: null, supermarketCategory_id: null }], []])
				.mockResolvedValueOnce([[{ max_sort: 0 }], []])
				.mockResolvedValueOnce([{ insertId: 1000 }, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 11,
							year: 2024,
							name: 'Null Fields Item',
							ingredient_id: 35,
						}),
					});

					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						data: { id: 1000 },
					});

					const insertCall = mockExecute.mock.calls[2];
					expect(insertCall[1][5]).toBe(null); // cost
					expect(insertCall[1][6]).toBe(null); // stockcode
				},
			});
		});
	});

	describe('Transaction Tests', () => {
		it('should rollback on database error during insert', async () => {
			mockExecute.mockResolvedValueOnce([[{ max_sort: 0 }], []]).mockRejectedValueOnce(new Error('Insert failed'));

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 12,
							year: 2024,
							name: 'Failing Item',
						}),
					});

					expect(response.status).toBe(500);
					expect(mockRollback).toHaveBeenCalled();
					expect(mockRelease).toHaveBeenCalled();

					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Failed to add item to shopping list',
						code: 'DATABASE_ERROR',
					});
				},
			});
		});

		it('should rollback on connection errors', async () => {
			mockBeginTransaction.mockRejectedValueOnce(new Error('Transaction failed'));

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 13,
							year: 2024,
							name: 'Transaction Fail Item',
						}),
					});

					expect(response.status).toBe(500);
					expect(mockRollback).toHaveBeenCalled();
					expect(mockRelease).toHaveBeenCalled();
				},
			});
		});

		it('should properly release connection on success', async () => {
			mockExecute.mockResolvedValueOnce([[{ max_sort: 0 }], []]).mockResolvedValueOnce([{ insertId: 1100 }, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 14,
							year: 2024,
							name: 'Success Item',
						}),
					});

					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						data: { id: 1100 },
					});
					expect(mockCommit).toHaveBeenCalled();
					expect(mockRelease).toHaveBeenCalled();
					expect(mockRollback).not.toHaveBeenCalled();
				},
			});
		});

		it('should properly release connection on error', async () => {
			mockCommit.mockRejectedValueOnce(new Error('Commit failed'));

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 15,
							year: 2024,
							name: 'Commit Fail Item',
						}),
					});

					expect(response.status).toBe(500);
					expect(mockRollback).toHaveBeenCalled();
					expect(mockRelease).toHaveBeenCalled();
				},
			});
		});
	});

	describe('Response Format Tests', () => {
		it('should return new item ID on success', async () => {
			mockExecute.mockResolvedValueOnce([[{ max_sort: 0 }], []]).mockResolvedValueOnce([{ insertId: 12345 }, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 16,
							year: 2024,
							name: 'ID Test Item',
						}),
					});

					expect(response.status).toBe(201);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						data: { id: 12345 },
					});
				},
			});
		});

		it('should return proper error structure on failure', async () => {
			// Missing required field to trigger validation error
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 17,
							// Missing year and name
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toHaveProperty('error');
					expect(typeof data.error).toBe('string');
				},
			});
		});
	});

	describe('Error Handling Tests', () => {
		it('should handle database connection errors', async () => {
			mockGetConnection.mockRejectedValueOnce(new Error('Connection pool exhausted'));

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 18,
							year: 2024,
							name: 'Connection Error Item',
						}),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Database connection error',
						code: 'DATABASE_CONNECTION_ERROR',
					});
				},
			});
		});

		it('should handle transaction begin errors', async () => {
			mockBeginTransaction.mockRejectedValueOnce(new Error('Cannot begin transaction'));

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 19,
							year: 2024,
							name: 'Transaction Begin Error',
						}),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Failed to add item to shopping list',
						code: 'DATABASE_ERROR',
					});
				},
			});
		});

		it('should handle query execution errors', async () => {
			mockExecute.mockRejectedValueOnce(new Error('SQL syntax error'));

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 20,
							year: 2024,
							name: 'SQL Error Item',
						}),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Failed to add item to shopping list',
						code: 'DATABASE_ERROR',
					});
				},
			});
		});

		it('should handle JSON parsing errors', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: 'Invalid JSON {',
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Invalid request format',
						code: 'INVALID_REQUEST_FORMAT',
					});
				},
			});
		});

		it('should handle non-Error exceptions', async () => {
			mockExecute.mockImplementationOnce(() => {
				throw 'String error';
			});

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							week: 21,
							year: 2024,
							name: 'String Error Item',
						}),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'An unexpected error occurred',
						code: 'INTERNAL_SERVER_ERROR',
					});
				},
			});
		});
	});
});
