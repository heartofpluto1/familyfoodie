/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import { NextResponse } from 'next/server';
import * as appHandler from './route';
import { clearAllMocks, setupConsoleMocks, MockConnection, mockRegularSession } from '@/lib/test-utils';

// Mock the database pool
const mockConnection: MockConnection = {
	beginTransaction: jest.fn(),
	commit: jest.fn(),
	rollback: jest.fn(),
	release: jest.fn(),
	execute: jest.fn(),
};

jest.mock('@/lib/db.js', () => ({
	getConnection: jest.fn(() => Promise.resolve(mockConnection)),
}));

// Mock the auth helpers
jest.mock('@/lib/auth/helpers', () => ({
	requireAuth: jest.fn(),
	requireAdminAuth: jest.fn(),
}));

// Import auth helpers for mocking
import { requireAuth } from '@/lib/auth/helpers';
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

describe('/api/shop/move', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		clearAllMocks();
		consoleMocks = setupConsoleMocks();
		// Reset mock implementations
		mockConnection.beginTransaction.mockReset().mockResolvedValue();
		mockConnection.commit.mockReset().mockResolvedValue();
		mockConnection.rollback.mockReset().mockResolvedValue();
		mockConnection.release.mockReset().mockImplementation(() => {});
		mockConnection.execute.mockReset();

		// Setup successful auth by default
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

	describe('PUT /api/shop/move', () => {
		describe('Authentication Tests', () => {
			it('should return 401 for unauthenticated requests', async () => {
				// Mock authentication failure
				mockRequireAuth.mockResolvedValue({
					authorized: false as const,
					response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
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
								id: 1,
								fresh: true,
								sort: 0,
								week: 45,
								year: 2024,
							}),
						});

						expect(response.status).toBe(401);
						const data = await response.json();
						expect(data).toEqual({
							error: 'Unauthorized',
						});

						// Verify database was never touched
						expect(mockConnection.beginTransaction).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Input Validation', () => {
			it('should return 400 when id is missing', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								fresh: true,
								sort: 0,
								week: 45,
								year: 2024,
							}),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Missing required fields',
							code: 'VALIDATION_ERROR',
							details: 'All fields (id/ids, fresh, sort, week, year) are required',
						});
					},
				});
			});

			it('should return 400 when fresh is missing', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								sort: 0,
								week: 45,
								year: 2024,
							}),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Missing required fields',
							code: 'VALIDATION_ERROR',
							details: 'All fields (id/ids, fresh, sort, week, year) are required',
						});
					},
				});
			});

			it('should return 400 when sort is missing', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								fresh: true,
								week: 45,
								year: 2024,
							}),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Missing required fields',
							code: 'VALIDATION_ERROR',
							details: 'All fields (id/ids, fresh, sort, week, year) are required',
						});
					},
				});
			});

			it('should return 400 when week is missing', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								fresh: true,
								sort: 0,
								year: 2024,
							}),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Missing required fields',
							code: 'VALIDATION_ERROR',
							details: 'All fields (id/ids, fresh, sort, week, year) are required',
						});
					},
				});
			});

			it('should return 400 when year is missing', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								fresh: true,
								sort: 0,
								week: 45,
							}),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Missing required fields',
							code: 'VALIDATION_ERROR',
							details: 'All fields (id/ids, fresh, sort, week, year) are required',
						});
					},
				});
			});

			it('should handle fresh as false (falsy but valid)', async () => {
				// Mock successful execution
				mockConnection.execute
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Update moved item
					.mockResolvedValueOnce([[], []]) // Get items in target list (empty)
					.mockResolvedValue([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								fresh: false,
								sort: 0,
								week: 45,
								year: 2024,
							}),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true, message: 'Item moved successfully' });
					},
				});
			});

			it('should reject negative sort values', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								fresh: true,
								sort: -1,
								week: 45,
								year: 2024,
							}),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Invalid sort value',
							code: 'VALIDATION_ERROR',
							details: 'Sort value must be a number between 0 and 1000',
						});
					},
				});
			});

			it('should reject sort values over 1000', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								fresh: true,
								sort: 1001,
								week: 45,
								year: 2024,
							}),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Invalid sort value',
							code: 'VALIDATION_ERROR',
							details: 'Sort value must be a number between 0 and 1000',
						});
					},
				});
			});

			it('should handle sort as 0 (falsy but valid)', async () => {
				// Mock successful execution
				mockConnection.execute
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Update moved item
					.mockResolvedValueOnce([[], []]) // Get items in target list (empty)
					.mockResolvedValue([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								fresh: true,
								sort: 0,
								week: 45,
								year: 2024,
							}),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true, message: 'Item moved successfully' });
					},
				});
			});
		});

		describe('Moving Items Between Lists', () => {
			it('should successfully move item from pantry to fresh list', async () => {
				// Mock existing items in the fresh list
				const existingFreshItems = [
					{ id: 2, sort: 0 },
					{ id: 3, sort: 1 },
				];

				mockConnection.execute
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Update moved item
					.mockResolvedValueOnce([existingFreshItems, []]) // Get items in target list
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Update sort for item 2
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Update sort for item 3
					.mockResolvedValue([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								fresh: true, // Moving to fresh list
								sort: 0, // Insert at position 0
								week: 45,
								year: 2024,
							}),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true, message: 'Item moved successfully' });

						// Verify the moved item was updated with household context
						expect(mockConnection.execute).toHaveBeenCalledWith(
							'UPDATE shopping_lists SET fresh = ?, sort = ? WHERE id IN (?) AND week = ? AND year = ? AND household_id = ?',
							[true, 0, 1, 45, 2024, 1]
						);

						// Verify getting items excludes the moved item and includes household
						expect(mockConnection.execute).toHaveBeenCalledWith(
							'SELECT id, sort FROM shopping_lists WHERE fresh = ? AND week = ? AND year = ? AND household_id = ? AND id NOT IN (?) ORDER BY sort ASC',
							[true, 45, 2024, 1, 1]
						);

						// Verify sort updates for displaced items
						expect(mockConnection.execute).toHaveBeenCalledWith('UPDATE shopping_lists SET sort = ? WHERE id = ?', [1, 2]);
						expect(mockConnection.execute).toHaveBeenCalledWith('UPDATE shopping_lists SET sort = ? WHERE id = ?', [2, 3]);

						// Verify transaction management
						expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
						expect(mockConnection.commit).toHaveBeenCalledTimes(1);
						expect(mockConnection.rollback).not.toHaveBeenCalled();
						expect(mockConnection.release).toHaveBeenCalledTimes(1);
					},
				});
			});

			it('should successfully move item from fresh to pantry list', async () => {
				// Mock existing items in the pantry list
				const existingPantryItems = [
					{ id: 4, sort: 0 },
					{ id: 5, sort: 1 },
					{ id: 6, sort: 2 },
				];

				mockConnection.execute
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Update moved item
					.mockResolvedValueOnce([existingPantryItems, []]) // Get items in target list
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Update sort for item 5
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Update sort for item 6
					.mockResolvedValue([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								fresh: false, // Moving to pantry list
								sort: 1, // Insert at position 1 (between items 4 and 5)
								week: 45,
								year: 2024,
							}),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true, message: 'Item moved successfully' });

						// Verify the moved item was updated
						expect(mockConnection.execute).toHaveBeenCalledWith(
							'UPDATE shopping_lists SET fresh = ?, sort = ? WHERE id IN (?) AND week = ? AND year = ? AND household_id = ?',
							[false, 1, 1, 45, 2024, 1]
						);

						// Verify items after position 1 are shifted
						expect(mockConnection.execute).toHaveBeenCalledWith('UPDATE shopping_lists SET sort = ? WHERE id = ?', [2, 5]);
						expect(mockConnection.execute).toHaveBeenCalledWith('UPDATE shopping_lists SET sort = ? WHERE id = ?', [3, 6]);
					},
				});
			});

			it('should handle moving to empty list', async () => {
				mockConnection.execute
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Update moved item
					.mockResolvedValueOnce([[], []]) // Get items in target list (empty)
					.mockResolvedValue([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								fresh: true,
								sort: 0,
								week: 45,
								year: 2024,
							}),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true, message: 'Item moved successfully' });

						// Verify no sort updates were needed
						expect(mockConnection.execute).toHaveBeenCalledTimes(2); // Just the move and the select
					},
				});
			});

			it('should handle moving to end of list', async () => {
				const existingItems = [
					{ id: 2, sort: 0 },
					{ id: 3, sort: 1 },
					{ id: 4, sort: 2 },
				];

				mockConnection.execute
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Update moved item
					.mockResolvedValueOnce([existingItems, []]) // Get items in target list
					.mockResolvedValue([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								fresh: true,
								sort: 3, // Insert at end
								week: 45,
								year: 2024,
							}),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true, message: 'Item moved successfully' });

						// Verify no sort updates were needed (item added at end)
						expect(mockConnection.execute).toHaveBeenCalledTimes(2); // Just the move and the select
					},
				});
			});
		});

		describe('Reordering Within Same List', () => {
			it('should successfully reorder item within fresh list', async () => {
				// Item is already in fresh list, just changing sort position
				const existingItems = [
					{ id: 2, sort: 0 },
					{ id: 3, sort: 1 },
					{ id: 4, sort: 2 },
				];

				mockConnection.execute
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Update moved item
					.mockResolvedValueOnce([existingItems, []]) // Get items in target list (excluding item 1)
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Update sort for item 3
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Update sort for item 4
					.mockResolvedValue([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								fresh: true, // Staying in fresh list
								sort: 1, // Move to position 1
								week: 45,
								year: 2024,
							}),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true, message: 'Item moved successfully' });

						// Items after position 1 should be shifted
						expect(mockConnection.execute).toHaveBeenCalledWith('UPDATE shopping_lists SET sort = ? WHERE id = ?', [2, 3]);
						expect(mockConnection.execute).toHaveBeenCalledWith('UPDATE shopping_lists SET sort = ? WHERE id = ?', [3, 4]);
					},
				});
			});
		});

		describe('Database Error Handling', () => {
			it('should rollback transaction on update failure', async () => {
				const dbError = new Error('Database update failed');
				mockConnection.execute.mockRejectedValueOnce(dbError);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								fresh: true,
								sort: 0,
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
							details: 'Database update failed',
						});

						// Verify rollback was called
						expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
						expect(mockConnection.commit).not.toHaveBeenCalled();
						expect(mockConnection.release).toHaveBeenCalledTimes(1);
					},
				});
			});

			it('should rollback transaction on select failure', async () => {
				const dbError = new Error('Database select failed');
				mockConnection.execute
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Update moved item succeeds
					.mockRejectedValueOnce(dbError); // Get items fails

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								fresh: true,
								sort: 0,
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
							details: 'Database select failed',
						});

						// Verify rollback was called
						expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
						expect(mockConnection.commit).not.toHaveBeenCalled();
						expect(mockConnection.release).toHaveBeenCalledTimes(1);
					},
				});
			});

			it('should rollback transaction on sort update failure', async () => {
				const dbError = new Error('Sort update failed');
				const existingItems = [
					{ id: 2, sort: 0 },
					{ id: 3, sort: 1 },
				];

				mockConnection.execute
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Update moved item
					.mockResolvedValueOnce([existingItems, []]) // Get items in target list
					.mockRejectedValueOnce(dbError); // Sort update fails

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								fresh: true,
								sort: 0,
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
							details: 'Sort update failed',
						});

						// Verify rollback was called
						expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
						expect(mockConnection.commit).not.toHaveBeenCalled();
						expect(mockConnection.release).toHaveBeenCalledTimes(1);
					},
				});
			});
		});

		describe('Household Isolation', () => {
			it('should only affect items within the same household', async () => {
				const existingItems = [
					{ id: 2, sort: 0 },
					{ id: 3, sort: 1 },
				];

				mockConnection.execute
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Update moved item
					.mockResolvedValueOnce([existingItems, []]) // Get items in target list
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Update sort
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Update sort
					.mockResolvedValue([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								fresh: true,
								sort: 0,
								week: 45,
								year: 2024,
							}),
						});

						expect(response.status).toBe(200);

						// Verify household_id is included in all queries
						expect(mockConnection.execute).toHaveBeenCalledWith(
							expect.stringContaining('household_id = ?'),
							expect.arrayContaining([1]) // household_id from mockAuthenticatedUser
						);

						// Verify the SELECT query specifically includes household_id
						expect(mockConnection.execute).toHaveBeenCalledWith(
							'SELECT id, sort FROM shopping_lists WHERE fresh = ? AND week = ? AND year = ? AND household_id = ? AND id NOT IN (?) ORDER BY sort ASC',
							[true, 45, 2024, 1, 1]
						);
					},
				});
			});

			it('should not affect items from different household even with same week/year', async () => {
				// Simulate no rows affected (item doesn't belong to user's household)
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]); // Update moved item - no rows affected

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 999, // Item from different household
								fresh: true,
								sort: 0,
								week: 45,
								year: 2024,
							}),
						});

						expect(response.status).toBe(404);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Item(s) not found or access denied',
							code: 'ITEM_NOT_FOUND',
							details: 'Shopping list item(s) not found in week 45/2024 for your household',
						});

						// Verify the update was attempted with household_id constraint
						expect(mockConnection.execute).toHaveBeenCalledWith(
							'UPDATE shopping_lists SET fresh = ?, sort = ? WHERE id IN (?) AND week = ? AND year = ? AND household_id = ?',
							[true, 0, 999, 45, 2024, 1]
						);

						// Verify rollback was called since item wasn't found
						expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
						expect(mockConnection.commit).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Edge Cases', () => {
			it('should handle invalid JSON in request body', async () => {
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
						expect(data).toEqual({
							success: false,
							error: 'Invalid request format',
							code: 'INVALID_JSON',
							details: 'Request body must be valid JSON',
						});
					},
				});
			});

			it('should reject very large sort values', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								fresh: true,
								sort: 999999,
								week: 45,
								year: 2024,
							}),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Invalid sort value',
							code: 'VALIDATION_ERROR',
							details: 'Sort value must be a number between 0 and 1000',
						});
					},
				});
			});

			it('should reject negative sort values', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								fresh: true,
								sort: -1,
								week: 45,
								year: 2024,
							}),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Invalid sort value',
							code: 'VALIDATION_ERROR',
							details: 'Sort value must be a number between 0 and 1000',
						});
					},
				});
			});
		});
	});
});
