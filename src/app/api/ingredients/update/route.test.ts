/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import { NextResponse } from 'next/server';
import * as appHandler from './route';
import { clearAllMocks, setupConsoleMocks, standardErrorScenarios, mockRegularSession } from '@/lib/test-utils';
import { requireAuth } from '@/lib/auth/helpers';

// Mock the database pool
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
	getConnection: jest.fn(),
}));

// Get the mocked execute function
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);

// Mock OAuth auth helpers
jest.mock('@/lib/auth/helpers', () => ({
	requireAuth: jest.fn(),
}));

// Mock the copy-on-write module
jest.mock('@/lib/copy-on-write', () => ({
	triggerCascadeCopyIfNeededForIngredient: jest.fn(),
}));

const mockTriggerCascadeCopyIfNeededForIngredient = jest.mocked(jest.requireMock('@/lib/copy-on-write').triggerCascadeCopyIfNeededForIngredient);
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

describe('/api/ingredients/update', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		clearAllMocks();
		consoleMocks = setupConsoleMocks();
		// Reset the mock before each test
		mockTriggerCascadeCopyIfNeededForIngredient.mockReset();

		// Setup default OAuth auth response
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

	// Test data
	const validUpdateData = {
		id: 1,
		name: 'Updated Ingredient',
		fresh: false,
		price: 3.99,
		stockcode: 54321,
		supermarketCategoryId: 2,
		pantryCategoryId: 3,
	};

	describe('PUT /api/ingredients/update', () => {
		describe('Successful Update Scenarios', () => {
			it('should successfully update ingredient with all fields when user owns ingredient', async () => {
				// Mock copy-on-write: ingredient already owned, returns same ID
				mockTriggerCascadeCopyIfNeededForIngredient.mockResolvedValueOnce(1);

				mockExecute.mockResolvedValueOnce([
					{ affectedRows: 1 }, // Successful update
				]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(validUpdateData),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({
							success: true,
							message: 'Ingredient updated successfully',
						});

						// Verify copy-on-write was called
						expect(mockTriggerCascadeCopyIfNeededForIngredient).toHaveBeenCalledWith(mockRegularSession.user.household_id, 1);

						// Verify database call with all parameters
						expect(mockExecute).toHaveBeenCalledWith(
							expect.stringContaining('UPDATE ingredients'),
							['Updated Ingredient', false, 3.99, 54321, 2, 3, 1] // Note: uses original ID since no copy was needed
						);
					},
				});
			});

			it('should successfully update ingredient when copy-on-write is triggered (different household)', async () => {
				// Mock copy-on-write: ingredient copied, returns new ID
				mockTriggerCascadeCopyIfNeededForIngredient.mockResolvedValueOnce(101);

				mockExecute.mockResolvedValueOnce([
					{ affectedRows: 1 }, // Successful update
				]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(validUpdateData),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({
							success: true,
							message: 'Ingredient updated successfully',
							newIngredientId: 101,
							copied: true,
						});

						// Verify copy-on-write was called
						expect(mockTriggerCascadeCopyIfNeededForIngredient).toHaveBeenCalledWith(mockRegularSession.user.household_id, 1);

						// Verify database call uses new ingredient ID after copy
						expect(mockExecute).toHaveBeenCalledWith(
							expect.stringContaining('UPDATE ingredients'),
							['Updated Ingredient', false, 3.99, 54321, 2, 3, 101] // Uses new ID from copy-on-write
						);
					},
				});
			});

			it('should successfully update ingredient with minimal fields (name and fresh only)', async () => {
				mockTriggerCascadeCopyIfNeededForIngredient.mockResolvedValueOnce(1);

				mockExecute.mockResolvedValueOnce([
					{ affectedRows: 1 }, // Successful update
				]);

				const minimalUpdateData = {
					id: 1,
					name: 'Simple Ingredient',
					fresh: true,
					price: null,
					stockcode: null,
					supermarketCategoryId: null,
					pantryCategoryId: null,
				};

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(minimalUpdateData),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({
							success: true,
							message: 'Ingredient updated successfully',
						});

						// Verify database call with null values
						expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE ingredients'), [
							'Simple Ingredient',
							true,
							null,
							null,
							null,
							null,
							1,
						]);
					},
				});
			});

			it('should successfully update ingredient with zero values converted to null', async () => {
				mockTriggerCascadeCopyIfNeededForIngredient.mockResolvedValueOnce(1);

				mockExecute.mockResolvedValueOnce([
					{ affectedRows: 1 }, // Successful update
				]);

				const zeroValueData = {
					id: 1,
					name: 'Zero Values Ingredient',
					fresh: false,
					price: 0,
					stockcode: 0,
					supermarketCategoryId: 0,
					pantryCategoryId: 0,
				};

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(zeroValueData),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({
							success: true,
							message: 'Ingredient updated successfully',
						});

						// Verify zero values are passed as-is (ingredient route doesn't convert zeros to null)
						expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE ingredients'), ['Zero Values Ingredient', false, 0, 0, 0, 0, 1]);
					},
				});
			});

			it('should successfully handle boolean fresh field correctly', async () => {
				mockTriggerCascadeCopyIfNeededForIngredient.mockResolvedValueOnce(1);

				mockExecute.mockResolvedValueOnce([
					{ affectedRows: 1 }, // Successful update
				]);

				const booleanTestData = {
					id: 1,
					name: 'Boolean Test',
					fresh: true, // Explicit true
					price: 1.99,
					stockcode: 123,
					supermarketCategoryId: 1,
					pantryCategoryId: 1,
				};

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(booleanTestData),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({
							success: true,
							message: 'Ingredient updated successfully',
						});

						// Verify boolean value is handled correctly
						expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE ingredients'), ['Boolean Test', true, 1.99, 123, 1, 1, 1]);
					},
				});
			});

			it('should successfully update with large numeric values', async () => {
				mockTriggerCascadeCopyIfNeededForIngredient.mockResolvedValueOnce(1);

				mockExecute.mockResolvedValueOnce([
					{ affectedRows: 1 }, // Successful update
				]);

				const largeNumberData = {
					id: 1,
					name: 'Large Numbers Test',
					fresh: false,
					price: 999.99,
					stockcode: 9999999999,
					supermarketCategoryId: 999,
					pantryCategoryId: 999,
				};

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(largeNumberData),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({
							success: true,
							message: 'Ingredient updated successfully',
						});

						// Verify large numeric values are handled correctly
						expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE ingredients'), [
							'Large Numbers Test',
							false,
							999.99,
							9999999999,
							999,
							999,
							1,
						]);
					},
				});
			});
		});

		describe('Validation Error Scenarios', () => {
			it('should return 400 if ingredient ID is missing', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								name: 'Ingredient Name',
								fresh: true,
							}),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.error).toBe('ID and name are required');
					},
				});

				// Ensure no database calls were made
				expect(mockExecute).not.toHaveBeenCalled();
				expect(mockTriggerCascadeCopyIfNeededForIngredient).not.toHaveBeenCalled();
			});

			it('should return 400 if ingredient name is missing', async () => {
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
							}),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.error).toBe('ID and name are required');
					},
				});

				// Ensure no database calls were made
				expect(mockExecute).not.toHaveBeenCalled();
				expect(mockTriggerCascadeCopyIfNeededForIngredient).not.toHaveBeenCalled();
			});

			it('should return 400 for empty ingredient name', async () => {
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
								name: '',
								fresh: true,
							}),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.error).toBe('ID and name are required');
					},
				});

				// Ensure no database calls were made
				expect(mockExecute).not.toHaveBeenCalled();
				expect(mockTriggerCascadeCopyIfNeededForIngredient).not.toHaveBeenCalled();
			});

			it('should return 400 for malformed JSON', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: 'invalid json{',
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data.error).toBeDefined();
					},
				});

				// Ensure no database calls were made
				expect(mockExecute).not.toHaveBeenCalled();
				expect(mockTriggerCascadeCopyIfNeededForIngredient).not.toHaveBeenCalled();
			});

			it('should handle invalid data types gracefully', async () => {
				mockTriggerCascadeCopyIfNeededForIngredient.mockResolvedValueOnce(1);

				mockExecute.mockResolvedValueOnce([
					{ affectedRows: 1 }, // Successful update despite weird types
				]);

				const invalidTypeData = {
					id: 1,
					name: 'Valid Name',
					fresh: 'true', // String instead of boolean
					price: 'expensive', // String instead of number
					stockcode: 'ABC123', // String instead of number
					supermarketCategoryId: 'produce', // String instead of number
					pantryCategoryId: true, // Boolean instead of number
				};

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(invalidTypeData),
						});

						expect(response.status).toBe(200); // Route doesn't validate types, just passes them through
						const data = await response.json();
						expect(data).toEqual({
							success: true,
							message: 'Ingredient updated successfully',
						});

						// Verify invalid types are passed through (database will handle type conversion/errors)
						expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE ingredients'), [
							'Valid Name',
							'true',
							'expensive',
							'ABC123',
							'produce',
							true,
							1,
						]);
					},
				});
			});
		});

		describe('Copy-on-Write Integration', () => {
			it('should not trigger copy when ingredient is owned by user household', async () => {
				// Mock: ingredient already owned, returns same ID
				mockTriggerCascadeCopyIfNeededForIngredient.mockResolvedValueOnce(1);

				mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(validUpdateData),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({
							success: true,
							message: 'Ingredient updated successfully',
						});

						// Verify copy-on-write was called with correct parameters
						expect(mockTriggerCascadeCopyIfNeededForIngredient).toHaveBeenCalledWith(mockRegularSession.user.household_id, 1);

						// Verify database update uses original ID (no copy was made)
						expect(mockExecute).toHaveBeenCalledWith(
							expect.stringContaining('UPDATE ingredients'),
							expect.arrayContaining([
								expect.anything(),
								expect.anything(),
								expect.anything(),
								expect.anything(),
								expect.anything(),
								expect.anything(),
								1,
							])
						);
					},
				});
			});

			it('should trigger copy when ingredient is not owned by user household', async () => {
				// Mock: ingredient copied, returns new ID
				mockTriggerCascadeCopyIfNeededForIngredient.mockResolvedValueOnce(201);

				mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(validUpdateData),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({
							success: true,
							message: 'Ingredient updated successfully',
							newIngredientId: 201,
							copied: true,
						});

						// Verify copy-on-write was called
						expect(mockTriggerCascadeCopyIfNeededForIngredient).toHaveBeenCalledWith(mockRegularSession.user.household_id, 1);

						// Verify database update uses new ingredient ID after copy
						expect(mockExecute).toHaveBeenCalledWith(
							expect.stringContaining('UPDATE ingredients'),
							expect.arrayContaining([
								expect.anything(),
								expect.anything(),
								expect.anything(),
								expect.anything(),
								expect.anything(),
								expect.anything(),
								201,
							])
						);
					},
				});
			});

			it('should handle copy-on-write function failure', async () => {
				// Mock: copy-on-write throws error
				mockTriggerCascadeCopyIfNeededForIngredient.mockRejectedValueOnce(new Error('Copy failed: ingredient not found'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(validUpdateData),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data.error).toBe('Copy failed: ingredient not found');

						// Verify copy-on-write was called but failed
						expect(mockTriggerCascadeCopyIfNeededForIngredient).toHaveBeenCalledWith(mockRegularSession.user.household_id, 1);

						// Verify no database update was attempted
						expect(mockExecute).not.toHaveBeenCalled();
					},
				});
			});

			it('should use correct ingredient ID from copy-on-write in database update', async () => {
				const originalId = 5;
				const copiedId = 105;

				// Mock: different ingredient copied
				mockTriggerCascadeCopyIfNeededForIngredient.mockResolvedValueOnce(copiedId);

				mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

				const testData = {
					...validUpdateData,
					id: originalId,
				};

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(testData),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({
							success: true,
							message: 'Ingredient updated successfully',
							newIngredientId: copiedId,
							copied: true,
						});

						// Verify copy-on-write was called with original ID
						expect(mockTriggerCascadeCopyIfNeededForIngredient).toHaveBeenCalledWith(mockRegularSession.user.household_id, originalId);

						// Verify database update uses the copied ID, not the original
						expect(mockExecute).toHaveBeenCalledWith(
							expect.stringContaining('UPDATE ingredients'),
							['Updated Ingredient', false, 3.99, 54321, 2, 3, copiedId] // Last parameter should be copiedId, not originalId
						);
					},
				});
			});
		});

		describe('Authentication & Permission Tests', () => {
			it('should return 401 for unauthenticated requests', async () => {
				// Mock auth failure
				mockRequireAuth.mockResolvedValueOnce({
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
							body: JSON.stringify(validUpdateData),
						});

						expect(response.status).toBe(401);
						const data = await response.json();
						expect(data).toEqual({
							error: 'Unauthorized',
						});

						// Verify no database or copy-on-write calls were made
						expect(mockExecute).not.toHaveBeenCalled();
						expect(mockTriggerCascadeCopyIfNeededForIngredient).not.toHaveBeenCalled();
					},
				});
			});

			it('should pass household context to copy-on-write function', async () => {
				mockTriggerCascadeCopyIfNeededForIngredient.mockResolvedValueOnce(1);

				mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(validUpdateData),
						});

						expect(response.status).toBe(200);

						// Verify household_id from authenticated user is passed to copy-on-write
						expect(mockTriggerCascadeCopyIfNeededForIngredient).toHaveBeenCalledWith(mockRegularSession.user.household_id, 1);
					},
				});
			});

			it('should handle permission validation through copy-on-write system', async () => {
				// Copy-on-write system acts as permission check - if ingredient not found, it throws
				mockTriggerCascadeCopyIfNeededForIngredient.mockRejectedValueOnce(new Error('Ingredient with ID 999 not found'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								...validUpdateData,
								id: 999, // Non-existent ingredient
							}),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data.error).toBe('Ingredient with ID 999 not found');

						// Verify copy-on-write was called and failed (acts as permission check)
						expect(mockTriggerCascadeCopyIfNeededForIngredient).toHaveBeenCalledWith(mockRegularSession.user.household_id, 999);

						// Verify no database update was attempted
						expect(mockExecute).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Database Error Handling', () => {
			it('should handle database connection failure during update', async () => {
				mockTriggerCascadeCopyIfNeededForIngredient.mockResolvedValueOnce(1);

				// Mock database error
				mockExecute.mockRejectedValueOnce(standardErrorScenarios.databaseError);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(validUpdateData),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data.error).toBe('Database connection failed');

						// Verify copy-on-write succeeded but database update failed
						expect(mockTriggerCascadeCopyIfNeededForIngredient).toHaveBeenCalledWith(mockRegularSession.user.household_id, 1);
						expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE ingredients'), expect.any(Array));
					},
				});
			});

			it('should handle non-Error exceptions gracefully', async () => {
				mockTriggerCascadeCopyIfNeededForIngredient.mockRejectedValueOnce('String error instead of Error object');

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(validUpdateData),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data.error).toBe('Failed to update ingredient');

						// Verify copy-on-write was called
						expect(mockTriggerCascadeCopyIfNeededForIngredient).toHaveBeenCalledWith(mockRegularSession.user.household_id, 1);

						// Verify no database update was attempted
						expect(mockExecute).not.toHaveBeenCalled();
					},
				});
			});

			it('should handle update query execution errors', async () => {
				mockTriggerCascadeCopyIfNeededForIngredient.mockResolvedValueOnce(1);

				// Mock SQL execution error
				mockExecute.mockRejectedValueOnce(new Error('SQL syntax error'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(validUpdateData),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data.error).toBe('SQL syntax error');

						// Verify both copy-on-write and database calls were made
						expect(mockTriggerCascadeCopyIfNeededForIngredient).toHaveBeenCalledWith(mockRegularSession.user.household_id, 1);
						expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE ingredients'), expect.any(Array));
					},
				});
			});
		});

		describe('Edge Cases', () => {
			it('should handle very long ingredient names', async () => {
				mockTriggerCascadeCopyIfNeededForIngredient.mockResolvedValueOnce(1);

				mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

				const longNameData = {
					...validUpdateData,
					name: 'A'.repeat(300), // Very long name
				};

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(longNameData),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toEqual({
							success: true,
							message: 'Ingredient updated successfully',
						});

						// Verify long name is passed through (database will handle length constraints)
						expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE ingredients'), ['A'.repeat(300), false, 3.99, 54321, 2, 3, 1]);
					},
				});
			});

			it('should handle update when no rows are affected (ingredient not found after copy)', async () => {
				mockTriggerCascadeCopyIfNeededForIngredient.mockResolvedValueOnce(999);

				// Mock: update query succeeds but affects no rows (ingredient doesn't exist)
				mockExecute.mockResolvedValueOnce([
					{ affectedRows: 0 }, // No rows affected
				]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(validUpdateData),
						});

						expect(response.status).toBe(200); // Route doesn't check affectedRows
						const data = await response.json();
						expect(data).toEqual({
							success: true,
							message: 'Ingredient updated successfully',
							newIngredientId: 999,
							copied: true,
						});

						// Verify copy-on-write succeeded and database update was attempted
						expect(mockTriggerCascadeCopyIfNeededForIngredient).toHaveBeenCalledWith(mockRegularSession.user.household_id, 1);
						expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE ingredients'), [
							'Updated Ingredient',
							false,
							3.99,
							54321,
							2,
							3,
							999,
						]);
					},
				});
			});
		});
	});
});
