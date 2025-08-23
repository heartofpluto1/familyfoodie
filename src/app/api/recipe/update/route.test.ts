/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { mockAuthenticatedUser, mockNonAuthenticatedUser, clearAllMocks } from '@/lib/test-utils';
import type { NextRequest } from 'next/server';

// Mock the database pool
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
	getConnection: jest.fn(),
}));
// Mock the auth middleware to properly handle authentication
jest.mock('@/lib/auth-middleware', () => ({
	withAuth: (handler: (request: NextRequest, session: unknown) => Promise<Response>) => {
		return async (request: NextRequest & { user?: unknown }) => {
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

// Get the mocked execute function
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);

describe('/api/recipe/update', () => {
	beforeEach(() => {
		clearAllMocks();
	});

	describe('PUT /api/recipe/update', () => {
		it('should successfully update recipe with all fields', async () => {
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
							name: 'Updated Recipe Name',
							description: 'Updated recipe description',
							prepTime: 15,
							cookTime: 30,
							seasonId: 2,
							primaryTypeId: 3,
							secondaryTypeId: 4,
							collectionId: 5,
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe updated successfully',
					});

					// Verify database call with all parameters
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), [
						'Updated Recipe Name',
						'Updated recipe description',
						15,
						30,
						2,
						3,
						4,
						5,
						1,
					]);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should successfully update recipe with required fields only', async () => {
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
							name: 'Minimal Recipe',
							description: 'Simple description',
						}),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Recipe updated successfully',
					});

					// Verify optional fields are passed as null
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), [
						'Minimal Recipe',
						'Simple description',
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

		it('should convert zero values to null for optional time fields', async () => {
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
							name: 'Recipe With Zero Times',
							description: 'Description',
							prepTime: 0,
							cookTime: 0,
						}),
					});

					expect(response.status).toBe(200);

					// Verify zero values are converted to null (falsy || null = null)
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), [
						'Recipe With Zero Times',
						'Description',
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

		it('should return 400 if both ID and name are missing', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							description: 'Description',
							prepTime: 15,
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
							description: 'Description',
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
			mockExecute.mockRejectedValueOnce(new Error('Database connection failed'));

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
					expect(data.error).toBe('Failed to update recipe');
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
					expect(data.error).toBe('Failed to update recipe');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle empty name string', async () => {
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

		it('should handle empty description string', async () => {
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
							description: '', // Empty string should be allowed
						}),
					});

					expect(response.status).toBe(200);

					// Verify empty description is passed through
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), expect.arrayContaining(['Recipe Name', '']));
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
							name: 'Recipe Name',
							description: 'Description',
							prepTime: -5,
							cookTime: -10,
						}),
					});

					expect(response.status).toBe(200);

					// Verify negative values are passed through (no validation in route)
					expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE recipes'), expect.arrayContaining([-5, -10]));
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
							name: 'Recipe Name',
							description: 'Description',
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

		it('should handle negative ID values', async () => {
			mockExecute.mockResolvedValueOnce([
				{ affectedRows: 0 }, // No rows affected for negative ID
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
							id: -1,
							name: 'Recipe Name',
							description: 'Description',
						}),
					});

					expect(response.status).toBe(404);
					const data = await response.json();
					expect(data.error).toBe('Recipe not found');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle string ID by implicit conversion', async () => {
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
							id: '1', // String ID
							name: 'Recipe Name',
							description: 'Description',
						}),
					});

					expect(response.status).toBe(200);

					// Verify string ID is used as-is (no explicit parsing in this route)
					expect(mockExecute).toHaveBeenCalledWith(
						expect.stringContaining('UPDATE recipes'),
						expect.arrayContaining(['1']) // String passed through
					);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('should handle very long recipe name and description', async () => {
			const longName = 'a'.repeat(1000);
			const longDescription = 'b'.repeat(5000);

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

		it('should handle special characters in name and description', async () => {
			const specialName = 'Recipe™ with "quotes" & <tags>';
			const specialDescription = 'Description with émojis 🍕 and ñoñó characters';

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

		it('should handle null values for optional foreign key fields', async () => {
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
							seasonId: null,
							primaryTypeId: null,
							secondaryTypeId: null,
							collectionId: null,
						}),
					});

					expect(response.status).toBe(200);

					// Verify explicit null values are handled correctly
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
