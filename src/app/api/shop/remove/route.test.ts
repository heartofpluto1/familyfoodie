/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import type { NextRequest } from 'next/server';
import type { User } from '@/types/user';
import * as appHandler from './route';
import { mockAuthenticatedUser, mockNonAuthenticatedUser, clearAllMocks, setupConsoleMocks, MockConnection } from '@/lib/test-utils';

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

// Mock the auth middleware to properly handle authentication
jest.mock('@/lib/auth-middleware', () => jest.requireActual('@/lib/test-utils').authMiddlewareMock);

describe('/api/shop/remove', () => {
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
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('DELETE /api/shop/remove', () => {
		describe('Authentication Tests', () => {
			it('should return 401 for unauthenticated requests', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1 }),
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

			it('should process authenticated requests', async () => {
				// Mock successful deletion
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1 }),
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
			it('should return 400 for missing request body', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Invalid request format',
							code: 'INVALID_REQUEST_FORMAT',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should return 400 when id is missing', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({}),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Item ID is required',
							code: 'VALIDATION_ERROR',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should return 400 when id is null', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: null }),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Item ID is required',
							code: 'VALIDATION_ERROR',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should return 400 when id is undefined', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: undefined }),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Item ID is required',
							code: 'VALIDATION_ERROR',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should return 400 when id is empty string', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: '' }),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Item ID is required',
							code: 'VALIDATION_ERROR',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should accept valid numeric id as string', async () => {
				// Mock successful deletion
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: '123' }),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true });

						// Verify the DELETE query was called with correct parameters
						expect(mockConnection.execute).toHaveBeenCalledWith(
							'DELETE FROM shopping_lists WHERE id = ? AND household_id = ?',
							['123', 1] // household_id from mockAuthenticatedUser
						);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should accept valid numeric id as number', async () => {
				// Mock successful deletion
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 456 }),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true });

						// Verify the DELETE query was called with correct parameters
						expect(mockConnection.execute).toHaveBeenCalledWith(
							'DELETE FROM shopping_lists WHERE id = ? AND household_id = ?',
							[456, 1] // household_id from mockAuthenticatedUser
						);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Database Operation Tests', () => {
			it('should successfully delete an existing item', async () => {
				// Mock successful deletion
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1 }),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true });

						// Verify transaction flow
						expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
						expect(mockConnection.execute).toHaveBeenCalledWith('DELETE FROM shopping_lists WHERE id = ? AND household_id = ?', [1, 1]);
						expect(mockConnection.commit).toHaveBeenCalledTimes(1);
						expect(mockConnection.rollback).not.toHaveBeenCalled();
						expect(mockConnection.release).toHaveBeenCalledTimes(1);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should return 404 when item is not found', async () => {
				// Mock no rows affected (item not found)
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 999 }),
						});

						expect(response.status).toBe(404);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Item not found',
							code: 'RESOURCE_NOT_FOUND',
						});

						// Verify transaction was rolled back
						expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
						expect(mockConnection.execute).toHaveBeenCalledWith('DELETE FROM shopping_lists WHERE id = ? AND household_id = ?', [999, 1]);
						expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
						expect(mockConnection.commit).not.toHaveBeenCalled();
						expect(mockConnection.release).toHaveBeenCalledTimes(1);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle multiple rows affected (edge case)', async () => {
				// Mock multiple rows affected (shouldn't happen with proper DB constraints)
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 2 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1 }),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true });

						// Should still commit since affectedRows > 0
						expect(mockConnection.commit).toHaveBeenCalledTimes(1);
						expect(mockConnection.rollback).not.toHaveBeenCalled();
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should ensure household scoping in database query', async () => {
				// Mock successful deletion
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				// Use custom user with different household_id
				const customUserPatcher = (req: NextRequest & { user?: User; household_id?: number }) => {
					req.user = {
						...mockAuthenticatedUser(req).user,
						household_id: 42,
					};
					return req;
				};

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1 }),
						});

						expect(response.status).toBe(200);

						// Verify household_id is used in the query
						expect(mockConnection.execute).toHaveBeenCalledWith('DELETE FROM shopping_lists WHERE id = ? AND household_id = ?', [1, 42]);
					},
					requestPatcher: customUserPatcher,
				});
			});
		});

		describe('Transaction Management Tests', () => {
			it('should rollback transaction on database error', async () => {
				const databaseError = new Error('Database constraint violation');
				mockConnection.execute.mockRejectedValueOnce(databaseError);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1 }),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Internal server error occurred',
							code: 'INTERNAL_ERROR',
						});

						// Verify transaction was rolled back
						expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
						expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
						expect(mockConnection.commit).not.toHaveBeenCalled();
						expect(mockConnection.release).toHaveBeenCalledTimes(1);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should release connection even when commit fails', async () => {
				// Mock successful execute but failing commit
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
				const commitError = new Error('Commit failed');
				mockConnection.commit.mockRejectedValueOnce(commitError);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1 }),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Internal server error occurred',
							code: 'INTERNAL_ERROR',
						});

						// Verify connection is still released
						expect(mockConnection.release).toHaveBeenCalledTimes(1);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should release connection even when rollback fails', async () => {
				// Mock execute returning no rows, then rollback failing
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
				const rollbackError = new Error('Rollback failed');
				mockConnection.rollback.mockRejectedValueOnce(rollbackError);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1 }),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Internal server error occurred',
							code: 'INTERNAL_ERROR',
						});

						// Verify connection is still released
						expect(mockConnection.release).toHaveBeenCalledTimes(1);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Error Handling Tests', () => {
			it('should handle database connection failures', async () => {
				// Mock the pool.getConnection to throw an error
				const mockPoolGetConnection = jest.requireMock('@/lib/db.js').getConnection;
				mockPoolGetConnection.mockRejectedValueOnce(new Error('Connection pool exhausted'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1 }),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Database connection error',
							code: 'DATABASE_CONNECTION_ERROR',
						});

						// No database operations should have been called
						expect(mockConnection.beginTransaction).not.toHaveBeenCalled();
						expect(mockConnection.execute).not.toHaveBeenCalled();
						expect(mockConnection.release).not.toHaveBeenCalled();
					},
					requestPatcher: mockAuthenticatedUser,
				});

				// Reset the mock for other tests
				mockPoolGetConnection.mockImplementation(() => Promise.resolve(mockConnection));
			});

			it('should handle JSON parsing errors gracefully', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: 'invalid json{',
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Invalid request format',
							code: 'INVALID_REQUEST_FORMAT',
						});

						// Connection should not be acquired for invalid JSON
						expect(mockConnection.beginTransaction).not.toHaveBeenCalled();
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle unexpected error types', async () => {
				// Mock execute to throw a non-Error object
				mockConnection.execute.mockRejectedValueOnce('String error');

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1 }),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Internal server error occurred',
							code: 'INTERNAL_ERROR',
						});

						// Verify transaction cleanup still happens
						expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
						expect(mockConnection.release).toHaveBeenCalledTimes(1);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle Error instances with sanitized messages', async () => {
				const customError = new Error('Custom database error message');
				mockConnection.execute.mockRejectedValueOnce(customError);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1 }),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Internal server error occurred',
							code: 'INTERNAL_ERROR',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Response Format Tests', () => {
			it('should return correct success response format', async () => {
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1 }),
						});

						expect(response.status).toBe(200);
						expect(response.headers.get('content-type')).toContain('application/json');

						const data = await response.json();
						expect(data).toEqual({
							success: true,
						});
						expect(Object.keys(data)).toEqual(['success']);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should return correct error response format for validation errors', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({}),
						});

						expect(response.status).toBe(400);
						expect(response.headers.get('content-type')).toContain('application/json');

						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Item ID is required',
							code: 'VALIDATION_ERROR',
						});
						expect(Object.keys(data).sort()).toEqual(['code', 'error', 'success']);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should return correct error response format for not found errors', async () => {
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 999 }),
						});

						expect(response.status).toBe(404);
						expect(response.headers.get('content-type')).toContain('application/json');

						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Item not found',
							code: 'RESOURCE_NOT_FOUND',
						});
						expect(Object.keys(data).sort()).toEqual(['code', 'error', 'success']);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should return correct error response format for server errors', async () => {
				mockConnection.execute.mockRejectedValueOnce(new Error('Database error'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1 }),
						});

						expect(response.status).toBe(500);
						expect(response.headers.get('content-type')).toContain('application/json');

						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Internal server error occurred',
							code: 'INTERNAL_ERROR',
						});
						expect(Object.keys(data).sort()).toEqual(['code', 'error', 'success']);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Input Edge Cases', () => {
			it('should handle very large ID numbers', async () => {
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
				const largeId = Number.MAX_SAFE_INTEGER;

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: largeId }),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true });

						expect(mockConnection.execute).toHaveBeenCalledWith('DELETE FROM shopping_lists WHERE id = ? AND household_id = ?', [largeId, 1]);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle negative ID numbers', async () => {
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: -1 }),
						});

						expect(response.status).toBe(404);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Item not found',
							code: 'RESOURCE_NOT_FOUND',
						});

						expect(mockConnection.execute).toHaveBeenCalledWith('DELETE FROM shopping_lists WHERE id = ? AND household_id = ?', [-1, 1]);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle zero as ID', async () => {
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 0 }),
						});

						expect(response.status).toBe(404);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Item not found',
							code: 'RESOURCE_NOT_FOUND',
						});

						expect(mockConnection.execute).toHaveBeenCalledWith('DELETE FROM shopping_lists WHERE id = ? AND household_id = ?', [0, 1]);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle additional properties in request body', async () => {
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								extraProperty: 'should be ignored',
								anotherProperty: 42,
							}),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true });

						// Should still work with just the id
						expect(mockConnection.execute).toHaveBeenCalledWith('DELETE FROM shopping_lists WHERE id = ? AND household_id = ?', [1, 1]);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});
	});
});
