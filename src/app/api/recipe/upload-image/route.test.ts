/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { createMockFile, setupConsoleMocks, standardErrorScenarios, mockAuthenticatedUser } from '@/lib/test-utils';
import type { NextRequest } from 'next/server';

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

// Mock the database pool
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
	getConnection: jest.fn(),
}));
// Mock the storage module
jest.mock('@/lib/storage', () => ({
	uploadFile: jest.fn(),
	getStorageMode: jest.fn(),
}));

// Mock the utils module
jest.mock('@/lib/utils/secureFilename', () => ({
	getRecipeImageUrl: jest.fn(),
}));

// Get the mocked execute function
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);

import { uploadFile, getStorageMode } from '@/lib/storage';
import { getRecipeImageUrl } from '@/lib/utils/secureFilename';

// Type assertions for mocked modules
const mockUploadFile = uploadFile as jest.MockedFunction<typeof uploadFile>;
const mockGetStorageMode = getStorageMode as jest.MockedFunction<typeof getStorageMode>;
const mockGetRecipeImageUrl = getRecipeImageUrl as jest.MockedFunction<typeof getRecipeImageUrl>;

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('/api/recipe/upload-image', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();
		mockGetStorageMode.mockReturnValue('local');
	});

	afterAll(() => {
		consoleMocks.cleanup();
		mockConsoleLog.mockRestore();
		mockConsoleError.mockRestore();
	});

	describe('POST /api/recipe/upload-image', () => {
		it('successfully uploads a JPEG image for a recipe without existing image', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');

			mockExecute
				.mockResolvedValueOnce([
					[{ image_filename: null, pdf_filename: 'recipe_1.pdf' }], // Recipe exists without image
				])
				.mockResolvedValueOnce([{ affectedRows: 1 }]); // Update successful

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_1_123456.jpg',
			});

			mockGetRecipeImageUrl.mockReturnValue('/static/recipes/recipe_1_123456.jpg');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						body: formData,
					});
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json).toEqual({
						success: true,
						message: 'Image uploaded successfully',
						filename: expect.stringContaining('.jpg'),
						url: '/uploads/recipe_1_123456.jpg',
						imageUrl: '/static/recipes/recipe_1_123456.jpg',
						storageMode: 'local',
					});
					expect(mockUploadFile).toHaveBeenCalled();
					expect(mockExecute).toHaveBeenCalledTimes(2);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('successfully uploads a PNG image', async () => {
			const mockFile = createMockFile('test.png', 'image/png', 2048);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '2');

			mockExecute.mockResolvedValueOnce([[{ image_filename: 'existing.jpg', pdf_filename: 'recipe_2.pdf' }]]);

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/existing.png',
			});

			mockGetRecipeImageUrl.mockReturnValue('/static/recipes/existing.png');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						body: formData,
					});
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json.success).toBe(true);
					expect(mockUploadFile).toHaveBeenCalledWith(expect.any(Buffer), expect.any(String), 'png', 'image/png');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('successfully uploads a WebP image', async () => {
			const mockFile = createMockFile('test.webp', 'image/webp', 3072);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '3');

			mockExecute
				.mockResolvedValueOnce([
					[{ image_filename: null, pdf_filename: null }],
					[], // fields array (second element of mysql2 result)
				])
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // Update successful

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_3_123456.webp',
			});

			mockGetRecipeImageUrl.mockReturnValue('/static/recipes/recipe_3_123456.webp');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						body: formData,
					});
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json.success).toBe(true);
					expect(mockUploadFile).toHaveBeenCalledWith(expect.any(Buffer), expect.any(String), 'webp', 'image/webp');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 when image file is missing', async () => {
			const formData = new FormData();
			formData.append('recipeId', '1');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						body: formData,
					});
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json).toEqual({
						error: 'Image file and recipe ID are required',
					});
					expect(mockExecute).not.toHaveBeenCalled();
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 when recipe ID is missing', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						body: formData,
					});
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json).toEqual({
						error: 'Image file and recipe ID are required',
					});
					expect(mockExecute).not.toHaveBeenCalled();
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 for invalid file type (PDF)', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						body: formData,
					});
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json).toEqual({
						error: 'Only JPEG, PNG, and WebP images are allowed',
					});
					expect(mockExecute).not.toHaveBeenCalled();
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 for oversized file (>5MB)', async () => {
			const largeFile = createMockFile('large.jpg', 'image/jpeg', 6 * 1024 * 1024); // 6MB
			const formData = new FormData();
			formData.append('image', largeFile);
			formData.append('recipeId', '1');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						body: formData,
					});
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json).toEqual({
						error: 'File size must be less than 5MB',
					});
					expect(mockExecute).not.toHaveBeenCalled();
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 404 when recipe not found', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '999');

			mockExecute.mockResolvedValueOnce([
				[], // No recipe found
			]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						body: formData,
					});
					const json = await response.json();

					expect(response.status).toBe(404);
					expect(json).toEqual({
						error: 'Recipe not found',
					});
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 500 when upload fails', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: null }]]);

			mockUploadFile.mockResolvedValue({
				success: false,
				error: 'Storage service unavailable',
			});

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						body: formData,
					});
					const json = await response.json();

					expect(response.status).toBe(500);
					expect(json).toEqual({
						error: 'Storage service unavailable',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 500 when database update fails for new image', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');

			mockExecute
				.mockResolvedValueOnce([
					[{ image_filename: null, pdf_filename: null }], // Recipe without image
				])
				.mockResolvedValueOnce([{ affectedRows: 0 }]); // Update fails

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_1_123456.jpg',
			});

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						body: formData,
					});
					const json = await response.json();

					expect(response.status).toBe(500);
					expect(json).toEqual({
						error: 'Failed to update recipe image filename',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('logs storage mode and upload details', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');

			mockExecute.mockResolvedValueOnce([[{ image_filename: 'existing.jpg', pdf_filename: null }]]);

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/existing.jpg',
			});

			mockGetStorageMode.mockReturnValue('cloud');
			mockGetRecipeImageUrl.mockReturnValue('/static/recipes/existing.jpg');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						body: formData,
					});
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(mockConsoleLog).toHaveBeenCalledWith('Storage mode: cloud');
					expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Uploading image with filename:'));
					expect(json.storageMode).toBe('cloud');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('handles different MIME type variations for JPEG', async () => {
			const mockFile = createMockFile('test.jpeg', 'image/jpg', 1024); // Note: image/jpg variant
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: null }]]).mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE result

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_1.jpg',
			});

			mockGetRecipeImageUrl.mockReturnValue('/static/recipes/recipe_1.jpg');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						body: formData,
					});
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json.success).toBe(true);
					// Should convert image/jpg to jpg extension
					expect(mockUploadFile).toHaveBeenCalledWith(expect.any(Buffer), expect.any(String), 'jpg', 'image/jpg');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('handles database query errors gracefully', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');

			mockExecute.mockRejectedValue(standardErrorScenarios.databaseError);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						body: formData,
					});
					const json = await response.json();

					expect(response.status).toBe(500);
					expect(json).toEqual({
						error: 'Failed to upload image',
					});
					expect(mockConsoleError).toHaveBeenCalledWith('Error uploading image:', expect.any(Error));
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('handles unknown errors gracefully', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');

			mockExecute.mockRejectedValue('String error');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						body: formData,
					});
					const json = await response.json();

					expect(response.status).toBe(500);
					expect(json).toEqual({
						error: 'Failed to upload image',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('updates existing recipe with image filename correctly', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '5');

			mockExecute.mockResolvedValueOnce([[{ image_filename: 'old_image.jpg', pdf_filename: 'recipe_5.pdf' }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/old_image.jpg',
			});

			mockGetRecipeImageUrl.mockReturnValue('/static/recipes/old_image.jpg');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						body: formData,
					});
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json.success).toBe(true);
					// Should NOT try to update database since image_filename already exists
					expect(mockExecute).toHaveBeenCalledTimes(1); // Only the SELECT query
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('handles non-numeric recipe IDs', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', 'abc');

			// When parseInt returns NaN, it causes an error in the route
			mockExecute.mockRejectedValueOnce(new Error('Invalid recipe ID'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						body: formData,
					});
					const json = await response.json();

					expect(response.status).toBe(500);
					expect(json).toEqual({
						error: 'Failed to upload image',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});
	});
});
