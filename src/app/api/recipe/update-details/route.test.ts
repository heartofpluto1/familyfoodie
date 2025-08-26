/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { mockAuthenticatedUser, mockNonAuthenticatedUser, clearAllMocks, setupConsoleMocks, standardErrorScenarios } from '@/lib/test-utils';

// Mock the database pool
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
	getConnection: jest.fn(),
}));

// Get the mocked execute function
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);

// Mock the auth middleware to properly handle authentication
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@/lib/auth-middleware', () => require('@/lib/test-utils').authMiddlewareMock);

// Mock the copy-on-write module
jest.mock('@/lib/copy-on-write', () => ({
	triggerCascadeCopyIfNeeded: jest.fn(),
}));

const mockTriggerCascadeCopyIfNeeded = jest.mocked(jest.requireMock('@/lib/copy-on-write').triggerCascadeCopyIfNeeded);

describe('/api/recipe/update-details', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		clearAllMocks();
		consoleMocks = setupConsoleMocks();
		// Reset the mock before each test
		mockTriggerCascadeCopyIfNeeded.mockReset();
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('PUT /api/recipe/update-details', () => {
		it('should successfully update recipe details with all fields when user owns recipe', async () => {
			// Mock copy-on-write: recipe already owned, returns same ID
			mockTriggerCascadeCopyIfNeeded.mockResolvedValueOnce(1);
			
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
						body: JSON.stringify({
							id: 1,
							name: 'Updated Recipe Details',
							description: 'Updated detailed description',
							prepTime: 20,
							cookTime: 45,
							seasonId: 3,
							primaryTypeId: 4,
							secondaryTypeId: 5,
							collectionId: 6,
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe details updated successfully',
					});

					// Verify database call with all parameters
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), [
						'Updated Recipe Details',
						'Updated detailed description',
						20,
						45,
						3,
						4,
						5,
						6,
						1,
					]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should successfully update recipe details with required fields only when user owns recipe', async () => {
			// Mock copy-on-write: recipe already owned, returns same ID
			mockTriggerCascadeCopyIfNeeded.mockResolvedValueOnce(2);
			
			mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							id: 2,
							name: 'Basic Recipe Details',
							description: 'Basic description',
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe details updated successfully',
					});

					// Verify optional fields are passed as null
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), [
						'Basic Recipe Details',
						'Basic description',
						null, // prepTime
						null, // cookTime
						null, // seasonId
						null, // primaryTypeId
						null, // secondaryTypeId
						null, // collectionId
						2,
					]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should trigger copy-on-write when user does not own recipe', async () => {
			// Mock copy-on-write: recipe not owned, returns NEW ID
			const originalRecipeId = 5;
			const copiedRecipeId = 123;
			mockTriggerCascadeCopyIfNeeded.mockResolvedValueOnce(copiedRecipeId);
			
			mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							id: originalRecipeId,
							name: 'Recipe to Copy',
							description: 'This recipe will be copied',
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe details updated successfully',
						newRecipeId: copiedRecipeId,
						copied: true,
					});

					// Verify copy-on-write was called
					expect(mockTriggerCascadeCopyIfNeeded).toHaveBeenCalledWith(
						expect.any(Number), // household_id from auth
						originalRecipeId
					);

					// Verify update was called with the NEW recipe ID
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), [
						'Recipe to Copy',
						'This recipe will be copied',
						null, // prepTime
						null, // cookTime
						null, // seasonId
						null, // primaryTypeId
						null, // secondaryTypeId
						null, // collectionId
						copiedRecipeId, // NEW ID after copy
					]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should convert zero values in time fields to null for backward compatibility', async () => {
			// Mock copy-on-write: recipe already owned, returns same ID
			mockTriggerCascadeCopyIfNeeded.mockResolvedValueOnce(1);
			
			mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

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
							name: 'Zero Time Recipe',
							description: 'No prep or cook time',
							prepTime: 0,
							cookTime: 0,
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe details updated successfully',
					});

					// Verify zero values are converted to null in database call
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), [
						'Zero Time Recipe',
						'No prep or cook time',
						null, // prepTime converted from 0 to null
						null, // cookTime converted from 0 to null
						null, // seasonId
						null, // primaryTypeId
						null, // secondaryTypeId
						null, // collectionId
						1,
					]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 if recipe ID is missing', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							name: 'Recipe Name',
							description: 'Description',
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Recipe ID and name are required');
				},
				requestPatcher: mockAuthenticatedUser,
			});

			// Ensure no database calls were made
			expect(mockExecute).not.toHaveBeenCalled();
		});

		it('should return 400 if recipe name is missing', async () => {
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
							description: 'Description without name',
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Recipe ID and name are required');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 for empty recipe name', async () => {
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
							description: 'Description',
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Recipe ID and name are required');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 404 if recipe not found', async () => {
			// Mock copy-on-write: recipe already owned, returns same ID
			mockTriggerCascadeCopyIfNeeded.mockResolvedValueOnce(999);
			
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
						body: JSON.stringify({
							id: 999,
							name: 'Non-existent Recipe',
							description: 'This recipe does not exist',
						}),
					});

					expect(response.status).toBe(404);
					const data = await response.json();
					expect(data.error).toBe('Recipe not found');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 500 on database error', async () => {
			// Mock copy-on-write: recipe already owned, returns same ID
			mockTriggerCascadeCopyIfNeeded.mockResolvedValueOnce(1);
			
			mockExecute.mockRejectedValueOnce(standardErrorScenarios.databaseError);

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
							name: 'Recipe Name',
							description: 'Description',
						}),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data.error).toBe('Failed to update recipe details');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 401 for unauthenticated users', async () => {
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
							name: 'Recipe Name',
							description: 'Description',
						}),
					});

					expect(response.status).toBe(401);
				},
				requestPatcher: mockNonAuthenticatedUser,
			});
		});

		it('should return 400 for invalid JSON payload', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: 'invalid-json',
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Invalid JSON payload');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle undefined description by converting to null', async () => {
			// Mock copy-on-write: recipe already owned, returns same ID
			mockTriggerCascadeCopyIfNeeded.mockResolvedValueOnce(1);
			
			mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

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
							name: 'Recipe without description',
						}),
					});

					expect(response.status).toBe(200);

					// Verify undefined description is converted to null
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), [
						'Recipe without description',
						null, // description should be null, not undefined
						null, // prepTime
						null, // cookTime
						null, // seasonId
						null, // primaryTypeId
						null, // secondaryTypeId
						null, // collectionId
						1,
					]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 for negative time values', async () => {
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
							name: 'Recipe with negative times',
							description: 'Testing negative values',
							prepTime: -10,
							cookTime: -15,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Prep and cook times must be positive integers or null');

					// Ensure no database calls were made
					expect(mockExecute).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 for unrealistically large time values', async () => {
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
							name: 'Recipe with large times',
							description: 'Testing large values',
							prepTime: 999999,
							cookTime: 888888,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Prep and cook times must not exceed 1440 minutes (24 hours)');

					// Ensure no database calls were made
					expect(mockExecute).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 for negative foreign key IDs', async () => {
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
							name: 'Recipe Name',
							description: 'Description',
							seasonId: -1,
							primaryTypeId: -2,
							secondaryTypeId: -3,
							collectionId: -4,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Foreign key IDs must be positive integers');

					// Ensure no database calls were made
					expect(mockExecute).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should properly parse string ID to integer', async () => {
			// Mock copy-on-write: recipe already owned, returns same ID
			mockTriggerCascadeCopyIfNeeded.mockResolvedValueOnce(123);
			
			mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							id: '123', // String ID
							name: 'Recipe Name',
							description: 'Description',
						}),
					});

					expect(response.status).toBe(200);

					// Verify string ID is parsed to integer
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), [
						'Recipe Name',
						'Description',
						null, // prepTime
						null, // cookTime
						null, // seasonId
						null, // primaryTypeId
						null, // secondaryTypeId
						null, // collectionId
						123, // ID should be parsed to integer
					]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 for non-numeric string ID', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							id: 'not-a-number',
							name: 'Recipe Name',
							description: 'Description',
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Recipe ID must be a valid number');

					// Ensure no database calls were made
					expect(mockExecute).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 for name exceeding database limit', async () => {
			const longName = 'a'.repeat(65); // Database limit is varchar(64)
			const validDescription = 'Valid description';

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
							name: longName,
							description: validDescription,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Recipe name must not exceed 64 characters');

					// Ensure no database calls were made
					expect(mockExecute).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should accept long description within database limits', async () => {
			const validName = 'Valid Recipe Name';
			const longDescription = 'b'.repeat(10000); // longtext can handle this

			// Mock copy-on-write: recipe already owned, returns same ID
			mockTriggerCascadeCopyIfNeeded.mockResolvedValueOnce(1);
			
			mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

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
							name: validName,
							description: longDescription,
						}),
					});

					expect(response.status).toBe(200);

					// Verify long description is accepted (longtext field)
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), expect.arrayContaining([validName, longDescription]));
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle special characters and unicode in text fields', async () => {
			const specialName = 'Recipe™ with "quotes" & émojis 🍕';
			const specialDescription = 'Description with ñoñó, <tags>, & "special" characters™';

			// Mock copy-on-write: recipe already owned, returns same ID
			mockTriggerCascadeCopyIfNeeded.mockResolvedValueOnce(1);
			
			mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

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
							name: specialName,
							description: specialDescription,
						}),
					});

					expect(response.status).toBe(200);

					// Verify special characters are preserved
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), expect.arrayContaining([specialName, specialDescription]));
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle explicit null values for optional fields', async () => {
			// Mock copy-on-write: recipe already owned, returns same ID
			mockTriggerCascadeCopyIfNeeded.mockResolvedValueOnce(1);
			
			mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

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
							name: 'Recipe Name',
							description: 'Description',
							prepTime: null,
							cookTime: null,
							seasonId: null,
							primaryTypeId: null,
							secondaryTypeId: null,
							collectionId: null,
						}),
					});

					expect(response.status).toBe(200);

					// Verify explicit null values are handled properly
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), [
						'Recipe Name',
						'Description',
						null, // prepTime
						null, // cookTime
						null, // seasonId
						null, // primaryTypeId
						null, // secondaryTypeId
						null, // collectionId
						1,
					]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 for whitespace-only recipe name', async () => {
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
							name: '   \t\n   ', // Only whitespace
							description: 'Valid description',
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Recipe name cannot be empty or whitespace only');

					// Ensure no database calls were made
					expect(mockExecute).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 400 when foreign key references do not exist', async () => {
			// Mock copy-on-write: recipe already owned, returns same ID
			mockTriggerCascadeCopyIfNeeded.mockResolvedValueOnce(1);
			
			// Mock database to return foreign key constraint error
			mockExecute.mockRejectedValueOnce({
				code: 'ER_NO_REFERENCED_ROW_2',
				errno: 1452,
				sqlMessage: 'Cannot add or update a child row: a foreign key constraint fails',
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
							name: 'Recipe Name',
							description: 'Description',
							seasonId: 999, // Non-existent season
							primaryTypeId: 888, // Non-existent primary type
							secondaryTypeId: 777, // Non-existent secondary type
							collectionId: 666, // Non-existent collection
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Referenced season, type, or collection does not exist');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should return 500 when copy-on-write fails', async () => {
			// Mock copy-on-write to throw an error
			mockTriggerCascadeCopyIfNeeded.mockRejectedValueOnce(new Error('Failed to copy recipe'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							id: 10,
							name: 'Recipe that fails to copy',
							description: 'This will fail during copy-on-write',
						}),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data.error).toBe('Failed to update recipe details');
					
					// Verify copy-on-write was attempted
					expect(mockTriggerCascadeCopyIfNeeded).toHaveBeenCalledWith(
						expect.any(Number), // household_id from auth
						10
					);
					
					// Verify UPDATE was never called since copy failed
					expect(mockExecute).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});
	});
});
