/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import { NextResponse } from 'next/server';
import * as appHandler from './route';
import { clearAllMocks, setupConsoleMocks, standardErrorScenarios, mockRegularSession } from '@/lib/test-utils';
import { requireAuth } from '@/lib/auth/helpers';

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

// Mock the database pool
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
	getConnection: jest.fn(),
}));

// Get the mocked execute function
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);

// Mock the OAuth auth helpers
jest.mock('@/lib/auth/helpers', () => ({
	requireAuth: jest.fn(),
}));

// Mock the copy-on-write module
jest.mock('@/lib/copy-on-write', () => ({
	cascadeCopyWithContext: jest.fn(),
}));

jest.mock('@/lib/permissions', () => ({
	validateRecipeInCollection: jest.fn(),
	canEditResource: jest.fn(),
}));

const mockCascadeCopyWithContext = jest.mocked(jest.requireMock('@/lib/copy-on-write').cascadeCopyWithContext);
const mockValidateRecipeInCollection = jest.mocked(jest.requireMock('@/lib/permissions').validateRecipeInCollection);
const mockCanEditResource = jest.mocked(jest.requireMock('@/lib/permissions').canEditResource);

describe('/api/recipe/update-details', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		clearAllMocks();
		consoleMocks = setupConsoleMocks();
		// Reset the mocks before each test
		mockExecute.mockReset();
		mockCascadeCopyWithContext.mockReset();
		mockValidateRecipeInCollection.mockReset();
		mockCanEditResource.mockReset();

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

	describe('PUT /api/recipe/update-details', () => {
		it('should successfully update recipe details with all fields when user owns recipe', async () => {
			// Mock permissions
			mockValidateRecipeInCollection.mockResolvedValueOnce(true);
			mockCanEditResource.mockResolvedValueOnce(true); // User owns the recipe

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
							currentCollectionId: 6,
							newCollectionId: 6,
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe details updated successfully',
						name: 'Updated Recipe Details',
						description: 'Updated detailed description',
						prepTime: 20,
						cookTime: 45,
						seasonId: 3,
						primaryTypeId: 4,
						secondaryTypeId: 5,
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
						1,
					]);
				},
			});
		});

		it('should successfully update recipe details with required fields only when user owns recipe', async () => {
			// Mock permissions
			mockValidateRecipeInCollection.mockResolvedValueOnce(true);
			mockCanEditResource.mockResolvedValueOnce(true); // User owns the recipe

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
							name: 'Basic Recipe Update',
							currentCollectionId: 1,
							newCollectionId: 1,
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe details updated successfully',
						name: 'Basic Recipe Update',
						description: null,
						prepTime: null,
						cookTime: null,
						seasonId: null,
						primaryTypeId: null,
						secondaryTypeId: null,
					});

					// Verify optional fields are passed as null
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), [
						'Basic Recipe Update',
						null, // description
						null, // prepTime
						null, // cookTime
						null, // seasonId
						null, // primaryTypeId
						null, // secondaryTypeId
						1,
					]);
				},
			});
		});

		it('should trigger copy-on-write when user does not own recipe', async () => {
			// Mock permissions
			mockValidateRecipeInCollection.mockResolvedValueOnce(true);
			mockCanEditResource.mockResolvedValueOnce(false); // User doesn't own the recipe

			// Mock copy-on-write: recipe not owned, returns NEW ID
			const originalRecipeId = 5;
			const copiedRecipeId = 123;
			mockCascadeCopyWithContext.mockResolvedValueOnce({
				newCollectionId: 1,
				newRecipeId: copiedRecipeId,
				actionsTaken: ['recipe_copied'],
				newRecipeSlug: 'copied-recipe',
				newCollectionSlug: 'copied-collection',
			});

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
							name: 'Copied Recipe',
							description: 'Copied description',
							currentCollectionId: 1,
							newCollectionId: 1,
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe copied and details updated successfully',
						wasCopied: true,
						newRecipeSlug: 'copied-recipe',
						newCollectionSlug: 'copied-collection',
						name: 'Copied Recipe',
						description: 'Copied description',
						prepTime: null,
						cookTime: null,
						seasonId: null,
						primaryTypeId: null,
						secondaryTypeId: null,
					});

					// Verify copy-on-write was called
					expect(mockCascadeCopyWithContext).toHaveBeenCalledWith(
						expect.any(Number), // household_id from auth
						1, // collectionId
						originalRecipeId
					);

					// Verify update was called with the NEW recipe ID
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), [
						'Copied Recipe',
						'Copied description',
						null, // prepTime
						null, // cookTime
						null, // seasonId
						null, // primaryTypeId
						null, // secondaryTypeId
						copiedRecipeId, // NEW ID after copy
					]);
				},
			});
		});

		it('should convert zero values in time fields to null for backward compatibility', async () => {
			// Mock permissions
			mockValidateRecipeInCollection.mockResolvedValueOnce(true);
			mockCanEditResource.mockResolvedValueOnce(true); // User owns the recipe

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
							name: 'Recipe with zeros',
							prepTime: 0,
							cookTime: 0,
							currentCollectionId: 1,
							newCollectionId: 1,
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe details updated successfully',
						name: 'Recipe with zeros',
						description: null,
						prepTime: null,
						cookTime: null,
						seasonId: null,
						primaryTypeId: null,
						secondaryTypeId: null,
					});

					// Verify zero values are converted to null in database call
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), [
						'Recipe with zeros',
						null,
						null, // prepTime converted from 0 to null
						null, // cookTime converted from 0 to null
						null, // seasonId
						null, // primaryTypeId
						null, // secondaryTypeId
						1,
					]);
				},
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
					expect(data.error).toBe('Recipe ID, current collection ID, and new collection ID are required');
				},
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
					expect(data.error).toBe('Recipe ID, current collection ID, and new collection ID are required');
				},
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
							currentCollectionId: 1,
							newCollectionId: 1,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Recipe name is required');
				},
			});
		});

		it('should return 404 if recipe not found', async () => {
			// Mock permissions - recipe doesn't exist in collection
			mockValidateRecipeInCollection.mockResolvedValueOnce(false);

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
							currentCollectionId: 1,
							newCollectionId: 1,
						}),
					});

					expect(response.status).toBe(404);
					const data = await response.json();
					expect(data.error).toBe('Recipe not found in current collection');
				},
			});
		});

		it('should return 500 on database error', async () => {
			// Mock permissions
			mockValidateRecipeInCollection.mockResolvedValueOnce(true);
			mockCanEditResource.mockResolvedValueOnce(true); // User owns the recipe

			// Mock the UPDATE query to throw database error
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
							currentCollectionId: 1,
							newCollectionId: 1, // Same collection, no move
						}),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data.error).toBe('Failed to update recipe details');
				},
			});
		});

		it('should return 401 for unauthenticated users', async () => {
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
						body: JSON.stringify({
							id: 1,
							name: 'Recipe Name',
							description: 'Description',
							currentCollectionId: 1,
							newCollectionId: 1,
						}),
					});

					expect(response.status).toBe(401);
				},
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
			});
		});

		it('should handle undefined description by converting to null', async () => {
			// Mock permissions
			mockValidateRecipeInCollection.mockResolvedValueOnce(true);
			mockCanEditResource.mockResolvedValueOnce(true); // User owns the recipe

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
							currentCollectionId: 1,
							newCollectionId: 1,
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
						1,
					]);
				},
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
							currentCollectionId: 1,
							newCollectionId: 1,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Prep and cook times must be positive integers or null');

					// Ensure no database calls were made
					expect(mockExecute).not.toHaveBeenCalled();
				},
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
							currentCollectionId: 1,
							newCollectionId: 1,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Prep and cook times must not exceed 1440 minutes (24 hours)');

					// Ensure no database calls were made
					expect(mockExecute).not.toHaveBeenCalled();
				},
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
							currentCollectionId: -4,
							newCollectionId: -4,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Current collection ID must be a positive integer');

					// Ensure no database calls were made
					expect(mockExecute).not.toHaveBeenCalled();
				},
			});
		});

		it('should properly parse string ID to integer', async () => {
			// Mock permissions
			mockValidateRecipeInCollection.mockResolvedValueOnce(true);
			mockCanEditResource.mockResolvedValueOnce(true); // User owns the recipe

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
							currentCollectionId: 1,
							newCollectionId: 1,
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
						123, // ID should be parsed to integer
					]);
				},
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
							currentCollectionId: 1,
							newCollectionId: 1,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Recipe ID must be a valid number');

					// Ensure no database calls were made
					expect(mockExecute).not.toHaveBeenCalled();
				},
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
							currentCollectionId: 1,
							newCollectionId: 1,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Recipe name must not exceed 64 characters');

					// Ensure no database calls were made
					expect(mockExecute).not.toHaveBeenCalled();
				},
			});
		});

		it('should accept long description within database limits', async () => {
			const validName = 'Valid Recipe Name';
			const longDescription = 'b'.repeat(10000); // longtext can handle this

			// Mock permissions
			mockValidateRecipeInCollection.mockResolvedValueOnce(true);
			mockCanEditResource.mockResolvedValueOnce(true); // User owns the recipe

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
							currentCollectionId: 1,
							newCollectionId: 1,
						}),
					});

					expect(response.status).toBe(200);

					// Verify long description is accepted (longtext field)
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), expect.arrayContaining([validName, longDescription]));
				},
			});
		});

		it('should handle special characters and unicode in text fields', async () => {
			const specialName = 'Recipe™ with "quotes" & émojis 🍕';
			const specialDescription = 'Description with ñoñó, <tags>, & "special" characters™';

			// Mock permissions
			mockValidateRecipeInCollection.mockResolvedValueOnce(true);
			mockCanEditResource.mockResolvedValueOnce(true); // User owns the recipe

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
							currentCollectionId: 1,
							newCollectionId: 1,
						}),
					});

					expect(response.status).toBe(200);

					// Verify special characters are preserved
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), expect.arrayContaining([specialName, specialDescription]));
				},
			});
		});

		it('should handle explicit null values for optional fields', async () => {
			// Mock permissions
			mockValidateRecipeInCollection.mockResolvedValueOnce(true);
			mockCanEditResource.mockResolvedValueOnce(true); // User owns the recipe

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
							currentCollectionId: 1,
							newCollectionId: 1,
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
						1,
					]);
				},
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
							currentCollectionId: 1,
							newCollectionId: 1,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Recipe name cannot be empty or whitespace only');

					// Ensure no database calls were made
					expect(mockExecute).not.toHaveBeenCalled();
				},
			});
		});

		it('should return 400 when foreign key references do not exist', async () => {
			// Mock permissions - recipe exists in collection, user owns it
			mockValidateRecipeInCollection.mockResolvedValueOnce(true);
			mockCanEditResource.mockResolvedValueOnce(true); // User owns the recipe

			// Mock database to return foreign key constraint error on UPDATE
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
							currentCollectionId: 1, // Valid collection
							newCollectionId: 1,
						}),
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('Referenced season, type, or collection does not exist');
				},
			});
		});

		it('should return 500 when copy-on-write fails', async () => {
			// Mock permissions
			mockValidateRecipeInCollection.mockResolvedValueOnce(true);
			mockCanEditResource.mockResolvedValueOnce(false); // User doesn't own the recipe

			// Mock copy-on-write to throw an error
			mockCascadeCopyWithContext.mockRejectedValueOnce(new Error('Failed to copy recipe'));

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
							currentCollectionId: 1,
							newCollectionId: 1,
						}),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data.error).toBe('Failed to update recipe details');

					// Verify copy-on-write was attempted
					expect(mockCascadeCopyWithContext).toHaveBeenCalledWith(
						expect.any(Number), // household_id from auth
						1, // collectionId
						10 // recipeId
					);

					// Verify UPDATE was never called since copy failed
					expect(mockExecute).not.toHaveBeenCalled();
				},
			});
		});

		// Collection Move Tests
		describe('Collection Move Functionality', () => {
			it('should update recipe without moving when currentCollectionId equals newCollectionId', async () => {
				// User owns the recipe
				mockValidateRecipeInCollection.mockResolvedValueOnce(true);
				mockCanEditResource.mockResolvedValueOnce(true);

				// Recipe update succeeds
				mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								id: 1,
								name: 'Updated Recipe',
								description: 'Updated description',
								currentCollectionId: 5,
								newCollectionId: 5, // Same as current
							}),
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.message).toBe('Recipe details updated successfully');
						expect(data.recipeMoved).toBeUndefined();

						// Verify no DELETE/INSERT for collection move
						expect(mockExecute).toHaveBeenCalledTimes(1); // Only UPDATE
						expect(mockExecute).not.toHaveBeenCalledWith(expect.stringContaining('DELETE FROM collection_recipes'), expect.any(Array));
					},
				});
			});

			it('should successfully move owned recipe to a new collection', async () => {
				// User owns the recipe
				mockValidateRecipeInCollection.mockResolvedValueOnce(true);
				mockCanEditResource
					.mockResolvedValueOnce(true) // owns recipe
					.mockResolvedValueOnce(true); // has access to new collection

				// Recipe update succeeds
				mockExecute
					.mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE
					.mockResolvedValueOnce([{ affectedRows: 1 }]) // DELETE from old collection
					.mockResolvedValueOnce([{ affectedRows: 1 }]) // INSERT to new collection
					.mockResolvedValueOnce([[{ url_slug: 'new-collection' }], []]); // SELECT collection slug

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								id: 1,
								name: 'Recipe to Move',
								description: 'Moving to new collection',
								currentCollectionId: 5,
								newCollectionId: 10, // Different collection
							}),
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.message).toBe('Recipe details updated and moved to new collection successfully');
						expect(data.wasMoved).toBe(true);
						expect(data.newCollectionId).toBe(10);

						// Verify DELETE and INSERT were called
						expect(mockExecute).toHaveBeenCalledWith(
							expect.stringContaining('DELETE FROM collection_recipes'),
							[5, 1] // currentCollectionId, recipeId
						);
						expect(mockExecute).toHaveBeenCalledWith(
							expect.stringContaining('INSERT INTO collection_recipes'),
							[10, 1] // newCollectionId, recipeId (display_order is hardcoded as 0)
						);
					},
				});
			});

			it('should copy recipe and move to new collection when user does not own recipe', async () => {
				// Recipe exists in collection
				mockValidateRecipeInCollection.mockResolvedValueOnce(true);

				// User doesn't own recipe but has access to new collection
				mockCanEditResource
					.mockResolvedValueOnce(false) // doesn't own recipe
					.mockResolvedValueOnce(true); // has access to new collection

				// Copy-on-write triggers
				mockCascadeCopyWithContext.mockResolvedValueOnce({
					newCollectionId: 5, // Same as current (no collection copy needed)
					newRecipeId: 100, // New recipe ID after copy
					actionsTaken: ['recipe_copied'],
					newRecipeSlug: 'copied-recipe',
				});

				// Recipe update and move succeed
				mockExecute
					.mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE copied recipe
					.mockResolvedValueOnce([{ affectedRows: 1 }]) // DELETE from old collection
					.mockResolvedValueOnce([{ affectedRows: 1 }]) // INSERT to new collection
					.mockResolvedValueOnce([[{ url_slug: 'target-collection' }], []]); // SELECT collection slug

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								id: 1,
								name: 'Recipe to Copy and Move',
								description: 'Will be copied then moved',
								currentCollectionId: 5,
								newCollectionId: 10,
							}),
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.message).toBe('Recipe copied, moved to new collection, and details updated successfully');
						expect(data.wasCopied).toBe(true);
						expect(data.wasMoved).toBe(true);
						expect(data.newCollectionId).toBe(10);
						expect(data.newRecipeSlug).toBe('copied-recipe');

						// Verify copy-on-write was called
						expect(mockCascadeCopyWithContext).toHaveBeenCalledWith(
							expect.any(Number), // household_id
							5, // currentCollectionId
							1 // recipeId
						);

						// Verify move operations used the COPIED recipe ID
						expect(mockExecute).toHaveBeenCalledWith(
							expect.stringContaining('DELETE FROM collection_recipes'),
							[5, 100] // currentCollectionId, COPIED recipeId
						);
						expect(mockExecute).toHaveBeenCalledWith(
							expect.stringContaining('INSERT INTO collection_recipes'),
							[10, 100] // newCollectionId, COPIED recipeId (display_order is hardcoded as 0)
						);
					},
				});
			});

			it('should update recipe but skip move when user lacks permission to target collection', async () => {
				// Recipe exists in collection
				mockValidateRecipeInCollection.mockResolvedValueOnce(true);

				// User owns recipe but doesn't have access to new collection
				mockCanEditResource
					.mockResolvedValueOnce(true) // owns recipe
					.mockResolvedValueOnce(false); // NO access to new collection

				// Recipe update succeeds, but no move operations
				mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE only

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								id: 1,
								name: 'Recipe Cannot Move',
								description: 'User lacks permission to target collection',
								currentCollectionId: 5,
								newCollectionId: 10, // User doesn't have access to this
							}),
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						// Update succeeds but move is silently skipped
						expect(data.success).toBe(true);
						expect(data.message).toBe('Recipe details updated successfully');
						expect(data.recipeMoved).toBeUndefined(); // No move happened
						expect(data.movedToCollectionId).toBeUndefined();

						// Verify permission check for new collection
						expect(mockCanEditResource).toHaveBeenCalledWith(
							expect.any(Number), // household_id
							'collections',
							10 // newCollectionId
						);

						// Verify no DELETE/INSERT operations
						expect(mockExecute).toHaveBeenCalledTimes(1); // Only UPDATE
						expect(mockExecute).not.toHaveBeenCalledWith(expect.stringContaining('DELETE FROM collection_recipes'), expect.any(Array));
						expect(mockExecute).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO collection_recipes'), expect.any(Array));
					},
				});
			});

			it('should not attempt move when currentCollectionId equals newCollectionId even with copy-on-write', async () => {
				// Recipe exists in collection
				mockValidateRecipeInCollection.mockResolvedValueOnce(true);

				// User doesn't own recipe, triggering copy-on-write
				mockCanEditResource.mockResolvedValueOnce(false); // doesn't own recipe

				// Copy-on-write changes the collection
				mockCascadeCopyWithContext.mockResolvedValueOnce({
					newCollectionId: 15, // Different from original due to copy
					newRecipeId: 100,
					actionsTaken: ['collection_copied', 'recipe_copied'],
					newRecipeSlug: 'copied-recipe',
					newCollectionSlug: 'copied-collection',
				});

				// Only UPDATE should happen, no move operations
				mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE only

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								id: 1,
								name: 'Recipe Same Collection',
								description: 'No move requested',
								currentCollectionId: 5,
								newCollectionId: 5, // Same as current - no move intended
							}),
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						// Copy happened but no move
						expect(data.success).toBe(true);
						expect(data.message).toBe('Recipe copied and details updated successfully');
						expect(data.wasCopied).toBe(true);
						expect(data.newRecipeSlug).toBe('copied-recipe');
						expect(data.newCollectionSlug).toBe('copied-collection');
						expect(data.recipeMoved).toBeUndefined(); // No move, even though copy changed collection

						// Verify copy-on-write was called
						expect(mockCascadeCopyWithContext).toHaveBeenCalledWith(
							expect.any(Number), // household_id
							5, // currentCollectionId
							1 // recipeId
						);

						// Verify no DELETE/INSERT operations (no move attempted)
						expect(mockExecute).toHaveBeenCalledTimes(1); // Only UPDATE
						expect(mockExecute).not.toHaveBeenCalledWith(expect.stringContaining('DELETE FROM collection_recipes'), expect.any(Array));
						expect(mockExecute).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO collection_recipes'), expect.any(Array));
					},
				});
			});

			it('should skip move silently after copy-on-write when user lacks access to target collection', async () => {
				// Recipe exists in collection
				mockValidateRecipeInCollection.mockResolvedValueOnce(true);

				// User doesn't own recipe and doesn't have access to new collection
				mockCanEditResource
					.mockResolvedValueOnce(false) // doesn't own recipe
					.mockResolvedValueOnce(false); // NO access to new collection

				// Copy-on-write happens
				mockCascadeCopyWithContext.mockResolvedValueOnce({
					newCollectionId: 15, // Changed due to collection copy
					newRecipeId: 100,
					actionsTaken: ['collection_copied', 'recipe_copied'],
					newRecipeSlug: 'copied-recipe',
					newCollectionSlug: 'copied-collection',
				});

				// Only UPDATE should happen, move is skipped
				mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE only

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								id: 1,
								name: 'Recipe Copy but No Move',
								description: 'Copy happens but move is denied',
								currentCollectionId: 5,
								newCollectionId: 10, // User doesn't have access to this
							}),
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						// Copy succeeded but move was silently skipped
						expect(data.success).toBe(true);
						expect(data.message).toBe('Recipe copied and details updated successfully');
						expect(data.wasCopied).toBe(true);
						expect(data.newRecipeSlug).toBe('copied-recipe');
						expect(data.newCollectionSlug).toBe('copied-collection');
						expect(data.recipeMoved).toBeUndefined(); // Move was skipped
						expect(data.movedToCollectionId).toBeUndefined();

						// Verify copy-on-write was called
						expect(mockCascadeCopyWithContext).toHaveBeenCalledWith(
							expect.any(Number), // household_id
							5, // currentCollectionId
							1 // recipeId
						);

						// Verify permission check for new collection
						expect(mockCanEditResource).toHaveBeenCalledWith(
							expect.any(Number), // household_id
							'collections',
							10 // newCollectionId that was requested
						);

						// Verify no DELETE/INSERT operations (move was denied)
						expect(mockExecute).toHaveBeenCalledTimes(1); // Only UPDATE
						expect(mockExecute).not.toHaveBeenCalledWith(expect.stringContaining('DELETE FROM collection_recipes'), expect.any(Array));
						expect(mockExecute).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO collection_recipes'), expect.any(Array));
					},
				});
			});
		});
	});
});
