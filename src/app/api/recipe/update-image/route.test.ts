/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { createMockFile, setupConsoleMocks, standardErrorScenarios, mockAuthenticatedUser } from '@/lib/test-utils';

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

// Mock the utils modules
jest.mock('@/lib/utils/secureFilename', () => ({
	getRecipeImageUrl: jest.fn(),
	generateVersionedFilename: jest.fn(),
	extractBaseHash: jest.fn(),
}));

jest.mock('@/lib/utils/secureFilename.server', () => ({
	findAndDeleteHashFiles: jest.fn(),
}));

import { uploadFile, getStorageMode } from '@/lib/storage';
import { getRecipeImageUrl, generateVersionedFilename, extractBaseHash } from '@/lib/utils/secureFilename';
import { findAndDeleteHashFiles } from '@/lib/utils/secureFilename.server';

// Get the mocked database
const mockDatabase = jest.mocked(jest.requireMock('@/lib/db.js'));

// Get mock functions
const mockUploadFile = uploadFile as jest.MockedFunction<typeof uploadFile>;
const mockGetStorageMode = getStorageMode as jest.MockedFunction<typeof getStorageMode>;
const mockGetRecipeImageUrl = getRecipeImageUrl as jest.MockedFunction<typeof getRecipeImageUrl>;
const mockGenerateVersionedFilename = generateVersionedFilename as jest.MockedFunction<typeof generateVersionedFilename>;
const mockExtractBaseHash = extractBaseHash as jest.MockedFunction<typeof extractBaseHash>;
const mockFindAndDeleteHashFiles = findAndDeleteHashFiles as jest.MockedFunction<typeof findAndDeleteHashFiles>;

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();

describe('/api/recipe/update-image', () => {
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
		mockConsoleWarn.mockRestore();
	});

	describe('POST /api/recipe/update-image', () => {
		it('successfully updates recipe image with file cleanup', async () => {
			const mockFile = createMockFile('updated.jpg', 'image/jpeg', 2048);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');

			mockDatabase.execute
				.mockResolvedValueOnce([
					[{ image_filename: 'recipe_abc123.jpg', pdf_filename: 'recipe_1.pdf' }], // Recipe with existing image
				])
				.mockResolvedValueOnce([{ affectedRows: 1 }]); // Update successful

			mockExtractBaseHash.mockReturnValue('abc123');
			mockFindAndDeleteHashFiles.mockResolvedValue(['recipe_abc123_v1.jpg', 'recipe_abc123_v2.jpg']);
			mockGenerateVersionedFilename.mockReturnValue('recipe_abc123_v3.jpg');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_abc123_v3.jpg',
			});

			mockGetRecipeImageUrl.mockReturnValue('/static/recipes/recipe_abc123_v3.jpg');

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
						message: 'Recipe image updated successfully',
						filename: 'recipe_abc123_v3.jpg',
						url: '/uploads/recipe_abc123_v3.jpg',
						imageUrl: '/static/recipes/recipe_abc123_v3.jpg',
						storageMode: 'local',
						cleanup: 'Cleaned up 2 old file(s): recipe_abc123_v1.jpg, recipe_abc123_v2.jpg',
					});

					expect(mockExtractBaseHash).toHaveBeenCalledWith('recipe_abc123.jpg');
					expect(mockFindAndDeleteHashFiles).toHaveBeenCalledWith('abc123', 'image');
					expect(mockGenerateVersionedFilename).toHaveBeenCalledWith('recipe_abc123.jpg', 'jpg');
					expect(mockConsoleLog).toHaveBeenCalledWith('Cleaned up 2 old file(s): recipe_abc123_v1.jpg, recipe_abc123_v2.jpg');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('successfully updates image when no old files to clean up', async () => {
			const mockFile = createMockFile('updated.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '2');

			mockDatabase.execute
				.mockResolvedValueOnce([[{ image_filename: 'recipe_def456.jpg', pdf_filename: null }]])
				.mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('def456');
			mockFindAndDeleteHashFiles.mockResolvedValue([]); // No files to clean up
			mockGenerateVersionedFilename.mockReturnValue('recipe_def456_v2.jpg');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_def456_v2.jpg',
			});

			mockGetRecipeImageUrl.mockReturnValue('/static/recipes/recipe_def456_v2.jpg');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						body: formData,
					});
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json.cleanup).toBe('No old files to clean up');
					expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('Cleaned up'));
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('continues with upload when file cleanup fails', async () => {
			const mockFile = createMockFile('updated.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '3');

			mockDatabase.execute
				.mockResolvedValueOnce([[{ image_filename: 'recipe_ghi789.jpg', pdf_filename: null }]])
				.mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('ghi789');
			mockFindAndDeleteHashFiles.mockRejectedValue(new Error('Cleanup failed'));
			mockGenerateVersionedFilename.mockReturnValue('recipe_ghi789_v2.jpg');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_ghi789_v2.jpg',
			});

			mockGetRecipeImageUrl.mockReturnValue('/static/recipes/recipe_ghi789_v2.jpg');

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
					expect(json.cleanup).toBe('No old files to clean up');
					expect(mockConsoleWarn).toHaveBeenCalledWith('File cleanup failed but continuing with upload:', expect.any(Error));
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('successfully handles PNG image updates', async () => {
			const mockFile = createMockFile('updated.png', 'image/png', 3072);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '4');

			mockDatabase.execute
				.mockResolvedValueOnce([[{ image_filename: 'recipe_jkl012.png', pdf_filename: null }]])
				.mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('jkl012');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_jkl012_v2.png');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_jkl012_v2.png',
			});

			mockGetRecipeImageUrl.mockReturnValue('/static/recipes/recipe_jkl012_v2.png');

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
					expect(mockGenerateVersionedFilename).toHaveBeenCalledWith('recipe_jkl012.png', 'png');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('successfully handles WebP image updates', async () => {
			const mockFile = createMockFile('updated.webp', 'image/webp', 2048);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '5');

			mockDatabase.execute
				.mockResolvedValueOnce([[{ image_filename: 'recipe_mno345.webp', pdf_filename: null }]])
				.mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('mno345');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_mno345_v2.webp');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_mno345_v2.webp',
			});

			mockGetRecipeImageUrl.mockReturnValue('/static/recipes/recipe_mno345_v2.webp');

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
					expect(mockGenerateVersionedFilename).toHaveBeenCalledWith('recipe_mno345.webp', 'webp');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('handles image/jpg MIME type variant', async () => {
			const mockFile = createMockFile('updated.jpeg', 'image/jpg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '6');

			mockDatabase.execute
				.mockResolvedValueOnce([[{ image_filename: 'recipe_pqr678.jpg', pdf_filename: null }]])
				.mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('pqr678');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_pqr678_v2.jpg');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_pqr678_v2.jpg',
			});

			mockGetRecipeImageUrl.mockReturnValue('/static/recipes/recipe_pqr678_v2.jpg');

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
					expect(mockGenerateVersionedFilename).toHaveBeenCalledWith('recipe_pqr678.jpg', 'jpg');
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
					expect(mockDatabase.execute).not.toHaveBeenCalled();
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
					expect(mockDatabase.execute).not.toHaveBeenCalled();
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 for invalid file type', async () => {
			const mockFile = createMockFile('test.gif', 'image/gif', 1024);
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
					expect(mockDatabase.execute).not.toHaveBeenCalled();
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 for oversized file', async () => {
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
						error: 'Image size must be less than 5MB',
					});
					expect(mockDatabase.execute).not.toHaveBeenCalled();
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

			mockDatabase.execute.mockResolvedValueOnce([
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

			mockDatabase.execute.mockResolvedValueOnce([[{ image_filename: 'recipe_abc.jpg', pdf_filename: null }]]);

			mockExtractBaseHash.mockReturnValue('abc');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_abc_v2.jpg');

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

		it('returns 500 when database update fails', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');

			mockDatabase.execute.mockResolvedValueOnce([[{ image_filename: 'recipe_abc.jpg', pdf_filename: null }]]).mockResolvedValueOnce([{ affectedRows: 0 }]); // Update fails

			mockExtractBaseHash.mockReturnValue('abc');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_abc_v2.jpg');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_abc_v2.jpg',
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

		it('handles case when extractBaseHash returns null', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');

			mockDatabase.execute.mockResolvedValueOnce([[{ image_filename: 'recipe_xyz.jpg', pdf_filename: null }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue(null as unknown as string); // No base hash
			mockGenerateVersionedFilename.mockReturnValue('recipe_xyz_v2.jpg');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_xyz_v2.jpg',
			});

			mockGetRecipeImageUrl.mockReturnValue('/static/recipes/recipe_xyz_v2.jpg');

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
					expect(json.cleanup).toBe('No old files to clean up');
					expect(mockFindAndDeleteHashFiles).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('logs storage mode and update details', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');

			mockDatabase.execute
				.mockResolvedValueOnce([[{ image_filename: 'recipe_original.jpg', pdf_filename: null }]])
				.mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('original');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_original_v2.jpg');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_original_v2.jpg',
			});

			mockGetRecipeImageUrl.mockReturnValue('/static/recipes/recipe_original_v2.jpg');
			mockGetStorageMode.mockReturnValue('cloud');

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
					expect(mockConsoleLog).toHaveBeenCalledWith('Updating image from recipe_original.jpg to recipe_original_v2.jpg');
					expect(mockConsoleLog).toHaveBeenCalledWith('Updated database image_filename to recipe_original_v2.jpg for recipe 1');
					expect(json.storageMode).toBe('cloud');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('handles database query errors gracefully', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');

			mockDatabase.execute.mockRejectedValue(standardErrorScenarios.databaseError);

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
						error: 'Failed to update recipe image',
					});
					expect(mockConsoleError).toHaveBeenCalledWith('Error updating recipe image:', expect.any(Error));
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('handles unknown errors gracefully', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');

			mockDatabase.execute.mockRejectedValue('String error');

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
						error: 'Failed to update recipe image',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('handles non-numeric recipe IDs', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', 'abc');

			mockDatabase.execute.mockResolvedValueOnce([
				[], // Query will work but return no results due to NaN conversion
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
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});
	});
});
