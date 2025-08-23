/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { mockAuthenticatedUser, mockNonAuthenticatedUser, clearAllMocks } from '@/lib/test-utils';

// Mock the database pool
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
	getConnection: jest.fn(),
}));

// Get the mocked execute function
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);
// Mock the auth middleware to properly handle authentication
jest.mock('@/lib/auth-middleware', () => ({
	withAuth: (handler: (request: unknown, session: unknown) => Promise<unknown>) => {
		return async (request: { user?: unknown }) => {
			// Check if user is set by requestPatcher
			if (!request.user) {
				return new Response(
					JSON.stringify({
						success: false,
						error: 'Authentication required!!',
					}),
					{ status: 401, headers: { 'Content-Type': 'application/json' } }
				);
			}
			return handler(request, request.user);
		};
	},
}));

// Already defined above as mockExecute

describe('/api/recipe/update-details', () => {
	beforeEach(() => {
		clearAllMocks();
	});

	describe('PUT /api/recipe/update-details', () => {
		it('should successfully update recipe details with all fields', async () => {
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

		it('should successfully update recipe details with required fields only', async () => {
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

		it('should handle zero values for time fields', async () => {
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

					// Verify zero values are converted to null (0 || null = null)
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), [
						'Zero Time Recipe',
						'No prep or cook time',
						null, // prepTime: 0 || null = null
						null, // cookTime: 0 || null = null
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
			mockExecute.mockRejectedValueOnce(new Error('Database constraint violation'));

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

		it('should handle invalid JSON payload', async () => {
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

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data.error).toBe('Failed to update recipe details');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle undefined description', async () => {
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

					// Verify undefined description is passed through
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), expect.arrayContaining([undefined]));
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle negative time values', async () => {
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
							name: 'Recipe with negative times',
							description: 'Testing negative values',
							prepTime: -10,
							cookTime: -15,
						}),
					});

					expect(response.status).toBe(200);

					// Verify negative values are passed through (no validation)
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), expect.arrayContaining([-10, -15]));
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle very large time values', async () => {
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
							name: 'Recipe with large times',
							description: 'Testing large values',
							prepTime: 999999,
							cookTime: 888888,
						}),
					});

					expect(response.status).toBe(200);

					// Verify large values are passed through
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), expect.arrayContaining([999999, 888888]));
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle negative foreign key IDs', async () => {
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
							seasonId: -1,
							primaryTypeId: -2,
							secondaryTypeId: -3,
							collectionId: -4,
						}),
					});

					expect(response.status).toBe(200);

					// Verify negative foreign key IDs are passed through
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), expect.arrayContaining([-1, -2, -3, -4]));
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle string ID conversion', async () => {
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

					// Verify string ID is used as-is
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), expect.arrayContaining(['123']));
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle very long name and description strings', async () => {
			const longName = 'a'.repeat(2000);
			const longDescription = 'b'.repeat(10000);

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
							name: longName,
							description: longDescription,
						}),
					});

					expect(response.status).toBe(200);

					// Verify long strings are passed through
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), expect.arrayContaining([longName, longDescription]));
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle special characters and unicode in text fields', async () => {
			const specialName = 'Recipe™ with "quotes" & émojis 🍕';
			const specialDescription = 'Description with ñoñó, <tags>, & "special" characters™';

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
	});
});
