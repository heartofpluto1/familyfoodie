/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import type { NextRequest } from 'next/server';
import type { SessionUser } from '@/types/auth';
import * as appHandler from './route';
import { mockAuthenticatedUser, mockNonAuthenticatedUser, clearAllMocks, setupConsoleMocks, MockConnection } from '@/lib/test-utils';
import pool from '@/lib/db.js';
import type { PoolConnection } from 'mysql2/promise';

// Mock the database pool
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
	getConnection: jest.fn(),
}));

const mockPoolExecute = jest.mocked(pool.execute);
const mockPoolGetConnection = jest.mocked(pool.getConnection);

// Mock connection for transaction tests
const mockConnection: MockConnection = {
	beginTransaction: jest.fn(),
	commit: jest.fn(),
	rollback: jest.fn(),
	release: jest.fn(),
	execute: jest.fn(),
};

// Mock the auth middleware to properly handle authentication
jest.mock('@/lib/auth-middleware', () => jest.requireActual('@/lib/test-utils').authMiddlewareMock);

describe('/api/shop/purchase', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		clearAllMocks();
		consoleMocks = setupConsoleMocks();
		// Reset mock implementations
		mockPoolExecute.mockReset();
		mockPoolGetConnection.mockReset();
		mockConnection.beginTransaction.mockReset().mockResolvedValue();
		mockConnection.commit.mockReset().mockResolvedValue();
		mockConnection.rollback.mockReset().mockResolvedValue();
		mockConnection.release.mockReset().mockImplementation(() => {});
		mockConnection.execute.mockReset();

		// Setup default connection mock for transaction-based tests
		mockPoolGetConnection.mockResolvedValue(mockConnection as unknown as PoolConnection);
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('POST /api/shop/purchase', () => {
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
							body: JSON.stringify({ id: 1, purchased: true }),
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
				// Mock successful update
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1, purchased: true }),
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
							method: 'POST',
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
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ purchased: true }),
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

			it('should return 400 when purchased is missing', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1 }),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Purchased status is required',
							code: 'VALIDATION_ERROR',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should return 400 when both id and purchased are missing', async () => {
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
							error: 'Item ID and purchased status are required',
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
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: null, purchased: true }),
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

			it('should return 400 when purchased is not a boolean', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1, purchased: 'true' }),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Purchased status must be a boolean',
							code: 'VALIDATION_ERROR',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should return 400 when purchased is a number', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1, purchased: 1 }),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Purchased status must be a boolean',
							code: 'VALIDATION_ERROR',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should accept zero as valid ID', async () => {
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 0, purchased: true }),
						});

						// Should proceed with the update (even though it affects 0 rows)
						// This test expects production quality - should return 404
						expect(response.status).toBe(404);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Item not found',
							code: 'RESOURCE_NOT_FOUND',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Database Operation Tests', () => {
			it('should successfully update purchase status to true', async () => {
				// For production quality, expect connection with transaction
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 123, purchased: true }),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true });

						// Verify proper transaction flow is expected
						expect(mockPoolGetConnection).toHaveBeenCalled();
						expect(mockConnection.beginTransaction).toHaveBeenCalled();
						expect(mockConnection.execute).toHaveBeenCalledWith(
							'UPDATE shopping_lists SET purchased = ? WHERE id = ? AND household_id = ?',
							[1, 123, 1] // 1 for true, household_id from mockAuthenticatedUser
						);
						expect(mockConnection.commit).toHaveBeenCalled();
						expect(mockConnection.release).toHaveBeenCalled();
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should successfully update purchase status to false', async () => {
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 456, purchased: false }),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true });

						expect(mockConnection.execute).toHaveBeenCalledWith(
							'UPDATE shopping_lists SET purchased = ? WHERE id = ? AND household_id = ?',
							[0, 456, 1] // 0 for false
						);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should return 404 when item does not exist', async () => {
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 999, purchased: true }),
						});

						expect(response.status).toBe(404);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Item not found',
							code: 'RESOURCE_NOT_FOUND',
						});

						// Verify rollback on no rows affected
						expect(mockConnection.rollback).toHaveBeenCalled();
						expect(mockConnection.commit).not.toHaveBeenCalled();
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle idempotent operations (same status twice)', async () => {
				// Even setting same value should return success if row exists
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1, purchased: true }),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true });
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Household Permission Boundary Tests 🔐', () => {
			it('should return 404 when item belongs to different household', async () => {
				// UPDATE returns 0 rows when household_id doesn't match
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1, purchased: true }),
						});

						// Should return 404, not distinguishable from non-existent item
						expect(response.status).toBe(404);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Item not found', // Generic message to prevent information leakage
							code: 'RESOURCE_NOT_FOUND',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should properly scope UPDATE query with household_id', async () => {
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				// Custom user with different household_id
				const customUserPatcher = (req: NextRequest & { user?: SessionUser; household_id?: number }) => {
					mockAuthenticatedUser(req);
					req.user = {
						...req.user!,
						household_id: 42,
					};
					return req;
				};

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1, purchased: false }),
						});

						expect(response.status).toBe(200);

						// Verify household_id 42 is used in the query
						expect(mockConnection.execute).toHaveBeenCalledWith('UPDATE shopping_lists SET purchased = ? WHERE id = ? AND household_id = ?', [0, 1, 42]);
					},
					requestPatcher: customUserPatcher,
				});
			});

			it('should prevent cross-household updates', async () => {
				// User from household 1 trying to update item from household 2
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 123, purchased: true }),
						});

						expect(response.status).toBe(404);
						const data = await response.json();
						// Should not reveal that item exists in another household
						expect(data).toEqual({
							success: false,
							error: 'Item not found',
							code: 'RESOURCE_NOT_FOUND',
						});
						expect(data.error).not.toContain('household');
						expect(data.error).not.toContain('permission');
						expect(data.error).not.toContain('unauthorized');
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should return identical response for non-existent vs wrong household', async () => {
				// Test 1: Item doesn't exist at all
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

				interface ErrorResponse {
					success: false;
					error: string;
					code: string;
				}

				let response1Data: ErrorResponse | undefined;
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 99999, purchased: true }),
						});
						response1Data = (await response.json()) as ErrorResponse;
					},
					requestPatcher: mockAuthenticatedUser,
				});

				// Test 2: Item exists but in different household
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

				let response2Data: ErrorResponse | undefined;
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1, purchased: true }),
						});
						response2Data = (await response.json()) as ErrorResponse;
					},
					requestPatcher: mockAuthenticatedUser,
				});

				// Both should return identical responses to prevent information leakage
				expect(response1Data).toEqual(response2Data);
				expect(response1Data).toEqual({
					success: false,
					error: 'Item not found',
					code: 'RESOURCE_NOT_FOUND',
				});
			});

			it('should allow multiple users in same household to update same item', async () => {
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				// Create another user in the same household
				const sameHouseholdUserPatcher = (req: NextRequest & { user?: SessionUser; household_id?: number }) => {
					req.user = {
						id: 99,
						username: 'anotheruser',
						first_name: 'Another',
						last_name: 'User',
						email: 'another@example.com',
						is_admin: false,
						is_active: true,
						household_id: 1, // Same household as mockAuthenticatedUser
						household_name: 'Test Household',
					} as SessionUser;
					return req;
				};

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1, purchased: true }),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true });

						// Verify same household_id is used
						expect(mockConnection.execute).toHaveBeenCalledWith('UPDATE shopping_lists SET purchased = ? WHERE id = ? AND household_id = ?', [1, 1, 1]);
					},
					requestPatcher: sameHouseholdUserPatcher,
				});
			});
		});

		describe('Transaction Management Tests', () => {
			it('should use transactions for database operations', async () => {
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1, purchased: true }),
						});

						expect(response.status).toBe(200);

						// Verify full transaction flow
						expect(mockPoolGetConnection).toHaveBeenCalledTimes(1);
						expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
						expect(mockConnection.execute).toHaveBeenCalledTimes(1);
						expect(mockConnection.commit).toHaveBeenCalledTimes(1);
						expect(mockConnection.rollback).not.toHaveBeenCalled();
						expect(mockConnection.release).toHaveBeenCalledTimes(1);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should rollback transaction on database error', async () => {
				const dbError = new Error('Database constraint violation');
				mockConnection.execute.mockRejectedValueOnce(dbError);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1, purchased: true }),
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
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
				const commitError = new Error('Commit failed');
				mockConnection.commit.mockRejectedValueOnce(commitError);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1, purchased: true }),
						});

						expect(response.status).toBe(500);

						// Verify connection is still released
						expect(mockConnection.release).toHaveBeenCalledTimes(1);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should release connection even when rollback fails', async () => {
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 0 }, []]);
				const rollbackError = new Error('Rollback failed');
				mockConnection.rollback.mockRejectedValueOnce(rollbackError);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1, purchased: true }),
						});

						expect(response.status).toBe(500);

						// Verify connection is still released
						expect(mockConnection.release).toHaveBeenCalledTimes(1);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Error Handling Tests', () => {
			it('should handle database connection failures', async () => {
				mockPoolGetConnection.mockRejectedValueOnce(new Error('Connection pool exhausted'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1, purchased: true }),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Database connection error',
							code: 'DATABASE_CONNECTION_ERROR',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle JSON parsing errors', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
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
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle unexpected error types', async () => {
				mockConnection.execute.mockRejectedValueOnce('String error');

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1, purchased: true }),
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

			it('should sanitize error messages for security', async () => {
				const dbError = new Error('SELECT * FROM users WHERE password = "leaked"');
				mockConnection.execute.mockRejectedValueOnce(dbError);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1, purchased: true }),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Internal server error occurred',
							code: 'INTERNAL_ERROR',
						});
						// Should not leak internal query details
						expect(JSON.stringify(data)).not.toContain('SELECT');
						expect(JSON.stringify(data)).not.toContain('password');
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
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1, purchased: true }),
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
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ purchased: true }),
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
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 999, purchased: false }),
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
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1, purchased: true }),
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
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: largeId, purchased: true }),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true });

						expect(mockConnection.execute).toHaveBeenCalledWith('UPDATE shopping_lists SET purchased = ? WHERE id = ? AND household_id = ?', [
							1,
							largeId,
							1,
						]);
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
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: -1, purchased: true }),
						});

						expect(response.status).toBe(404);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Item not found',
							code: 'RESOURCE_NOT_FOUND',
						});
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
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								id: 1,
								purchased: false,
								extraProperty: 'should be ignored',
								anotherProperty: 42,
							}),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true });

						// Should still work with just id and purchased
						expect(mockConnection.execute).toHaveBeenCalledWith('UPDATE shopping_lists SET purchased = ? WHERE id = ? AND household_id = ?', [0, 1, 1]);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should reject boolean strings instead of actual booleans', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: 1, purchased: 'false' }),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Purchased status must be a boolean',
							code: 'VALIDATION_ERROR',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle numeric strings for ID', async () => {
				mockConnection.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ id: '123', purchased: true }),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({ success: true });

						// Should convert string to number
						expect(mockConnection.execute).toHaveBeenCalledWith('UPDATE shopping_lists SET purchased = ? WHERE id = ? AND household_id = ?', [
							1,
							'123',
							1,
						]);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});
	});
});
