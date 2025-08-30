/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { createMockFile, setupConsoleMocks, standardErrorScenarios, mockRegularSession } from '@/lib/test-utils';
import { requireAuth } from '@/lib/auth/helpers';

// Mock the OAuth auth helpers
jest.mock('@/lib/auth/helpers', () => ({
	requireAuth: jest.fn(),
}));

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

// Mock the database pool
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
	getConnection: jest.fn(),
}));
// Mock the storage module
jest.mock('@/lib/storage', () => ({
	uploadFile: jest.fn(),
	getStorageMode: jest.fn(),
	deleteFile: jest.fn(),
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

// Mock copy-on-write and permissions
jest.mock('@/lib/copy-on-write', () => ({
	cascadeCopyWithContext: jest.fn(),
}));

jest.mock('@/lib/permissions', () => ({
	canEditResource: jest.fn(),
	validateRecipeInCollection: jest.fn(),
}));

import { uploadFile, getStorageMode, deleteFile } from '@/lib/storage';
import { getRecipeImageUrl, generateVersionedFilename, extractBaseHash } from '@/lib/utils/secureFilename';
import { findAndDeleteHashFiles } from '@/lib/utils/secureFilename.server';
import { canEditResource, validateRecipeInCollection } from '@/lib/permissions';

// Get the mocked database
const mockDatabase = jest.mocked(jest.requireMock('@/lib/db.js'));

// Get mock functions
const mockUploadFile = uploadFile as jest.MockedFunction<typeof uploadFile>;
const mockGetStorageMode = getStorageMode as jest.MockedFunction<typeof getStorageMode>;
const mockDeleteFile = deleteFile as jest.MockedFunction<typeof deleteFile>;
const mockGetRecipeImageUrl = getRecipeImageUrl as jest.MockedFunction<typeof getRecipeImageUrl>;
const mockGenerateVersionedFilename = generateVersionedFilename as jest.MockedFunction<typeof generateVersionedFilename>;
const mockExtractBaseHash = extractBaseHash as jest.MockedFunction<typeof extractBaseHash>;
const mockFindAndDeleteHashFiles = findAndDeleteHashFiles as jest.MockedFunction<typeof findAndDeleteHashFiles>;
const mockCanEditResource = canEditResource as jest.MockedFunction<typeof canEditResource>;
const mockValidateRecipeInCollection = validateRecipeInCollection as jest.MockedFunction<typeof validateRecipeInCollection>;

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
		mockCanEditResource.mockResolvedValue(true); // Default: can edit
		mockValidateRecipeInCollection.mockResolvedValue(true); // Default: recipe is in collection

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
			formData.append('collectionId', '1');

			mockValidateRecipeInCollection.mockResolvedValue(true);
			mockCanEditResource.mockResolvedValue(true);

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
				filename: 'recipe_abc123_v3.jpg',
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
						uploadUrl: '/uploads/recipe_abc123_v3.jpg',
						displayUrl: '/static/recipes/recipe_abc123_v3.jpg',
						storageMode: 'local',
						cleanup: 'Cleaned up 2 old file(s): recipe_abc123_v1.jpg, recipe_abc123_v2.jpg',
					});

					expect(mockExtractBaseHash).toHaveBeenCalledWith('recipe_abc123.jpg');
					expect(mockFindAndDeleteHashFiles).toHaveBeenCalledWith('abc123', 'image');
					expect(mockGenerateVersionedFilename).toHaveBeenCalledWith('recipe_abc123.jpg', 'jpg');
					expect(mockConsoleLog).toHaveBeenCalledWith('Cleaned up 2 old file(s): recipe_abc123_v1.jpg, recipe_abc123_v2.jpg');
				},
			});
		});

		it('successfully updates image when no old files to clean up', async () => {
			const mockFile = createMockFile('updated.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '2');
			formData.append('collectionId', '1');

			mockValidateRecipeInCollection.mockResolvedValue(true);
			mockCanEditResource.mockResolvedValue(true);

			mockDatabase.execute
				.mockResolvedValueOnce([[{ image_filename: 'recipe_def456.jpg', pdf_filename: null }]])
				.mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('def456');
			mockFindAndDeleteHashFiles.mockResolvedValue([]); // No files to clean up
			mockGenerateVersionedFilename.mockReturnValue('recipe_def456_v2.jpg');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_def456_v2.jpg',
				filename: 'recipe_def456_v2.jpg',
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
			});
		});

		it('continues with upload when file cleanup fails', async () => {
			const mockFile = createMockFile('updated.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '3');
			formData.append('collectionId', '1');

			mockValidateRecipeInCollection.mockResolvedValue(true);
			mockCanEditResource.mockResolvedValue(true);

			mockDatabase.execute
				.mockResolvedValueOnce([[{ image_filename: 'recipe_ghi789.jpg', pdf_filename: null }]])
				.mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('ghi789');
			mockFindAndDeleteHashFiles.mockRejectedValue(new Error('Cleanup failed'));
			mockGenerateVersionedFilename.mockReturnValue('recipe_ghi789_v2.jpg');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_ghi789_v2.jpg',
				filename: 'recipe_ghi789_v2.jpg',
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
			});
		});

		it('successfully handles PNG image updates', async () => {
			const mockFile = createMockFile('updated.png', 'image/png', 3072);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '4');
			formData.append('collectionId', '1');

			mockValidateRecipeInCollection.mockResolvedValue(true);
			mockCanEditResource.mockResolvedValue(true);

			mockDatabase.execute
				.mockResolvedValueOnce([[{ image_filename: 'recipe_jkl012.png', pdf_filename: null }]])
				.mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('jkl012');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_jkl012_v2.png');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_jkl012_v2.png',
				filename: 'recipe_jkl012_v2.png',
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
			});
		});

		it('successfully handles WebP image updates', async () => {
			const mockFile = createMockFile('updated.webp', 'image/webp', 2048);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '5');
			formData.append('collectionId', '1');

			mockValidateRecipeInCollection.mockResolvedValue(true);
			mockCanEditResource.mockResolvedValue(true);

			mockDatabase.execute
				.mockResolvedValueOnce([[{ image_filename: 'recipe_mno345.webp', pdf_filename: null }]])
				.mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('mno345');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_mno345_v2.webp');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_mno345_v2.webp',
				filename: 'recipe_mno345_v2.webp',
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
			});
		});

		it('handles image/jpg MIME type variant', async () => {
			const mockFile = createMockFile('updated.jpeg', 'image/jpg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '6');
			formData.append('collectionId', '1');

			mockValidateRecipeInCollection.mockResolvedValue(true);
			mockCanEditResource.mockResolvedValue(true);

			mockDatabase.execute
				.mockResolvedValueOnce([[{ image_filename: 'recipe_pqr678.jpg', pdf_filename: null }]])
				.mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('pqr678');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_pqr678_v2.jpg');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_pqr678_v2.jpg',
				filename: 'recipe_pqr678_v2.jpg',
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
						error: 'Image file, recipe ID, and collection ID are required',
					});
					expect(mockDatabase.execute).not.toHaveBeenCalled();
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
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
						error: 'Image file, recipe ID, and collection ID are required',
					});
					expect(mockDatabase.execute).not.toHaveBeenCalled();
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
			});
		});

		it('returns 400 for invalid file type', async () => {
			const mockFile = createMockFile('test.gif', 'image/gif', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

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
			});
		});

		it('returns 400 for oversized file', async () => {
			const largeFile = createMockFile('large.jpg', 'image/jpeg', 6 * 1024 * 1024); // 6MB
			const formData = new FormData();
			formData.append('image', largeFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

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
			});
		});

		it('returns 404 when recipe not found', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '999');
			formData.append('collectionId', '1');

			mockValidateRecipeInCollection.mockResolvedValue(false); // Recipe not in collection

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
			});
		});

		it('returns 500 when upload fails', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			mockValidateRecipeInCollection.mockResolvedValue(true);
			mockCanEditResource.mockResolvedValue(true);

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
			});
		});

		it('returns 500 when database update fails and attempts file cleanup', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			mockValidateRecipeInCollection.mockResolvedValue(true);
			mockCanEditResource.mockResolvedValue(true);

			mockDatabase.execute.mockResolvedValueOnce([[{ image_filename: 'recipe_abc.jpg', pdf_filename: null }]]).mockResolvedValueOnce([{ affectedRows: 0 }]); // Update fails

			mockExtractBaseHash.mockReturnValue('abc');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_abc_v2.jpg');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_abc_v2.jpg',
				filename: 'recipe_abc_v2.jpg',
			});

			mockDeleteFile.mockResolvedValue(true);

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
					expect(mockDeleteFile).toHaveBeenCalledWith('recipe_abc_v2', 'jpg'); // Should attempt cleanup
					expect(mockConsoleWarn).toHaveBeenCalledWith('Database update failed, cleaning up uploaded file: recipe_abc_v2.jpg');
				},
			});
		});

		it('handles case when extractBaseHash returns null', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			mockValidateRecipeInCollection.mockResolvedValue(true);
			mockCanEditResource.mockResolvedValue(true);

			mockDatabase.execute.mockResolvedValueOnce([[{ image_filename: 'recipe_xyz.jpg', pdf_filename: null }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue(null as unknown as string); // No base hash
			mockGenerateVersionedFilename.mockReturnValue('recipe_xyz_v2.jpg');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_xyz_v2.jpg',
				filename: 'recipe_xyz_v2.jpg',
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
			});
		});

		it('logs storage mode and update details', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			mockValidateRecipeInCollection.mockResolvedValue(true);
			mockCanEditResource.mockResolvedValue(true);

			mockDatabase.execute
				.mockResolvedValueOnce([[{ image_filename: 'recipe_original.jpg', pdf_filename: null }]])
				.mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('original');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_original_v2.jpg');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_original_v2.jpg',
				filename: 'recipe_original_v2.jpg',
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
					expect(json.uploadUrl).toBe('/uploads/recipe_original_v2.jpg');
					expect(json.displayUrl).toBe('/static/recipes/recipe_original_v2.jpg');
				},
			});
		});

		it('handles database query errors gracefully', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			mockValidateRecipeInCollection.mockRejectedValue(standardErrorScenarios.databaseError);

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
			});
		});

		it('handles unknown errors gracefully', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			mockValidateRecipeInCollection.mockRejectedValue('String error');

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
			});
		});

		it('handles non-numeric recipe IDs', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', 'abc');
			formData.append('collectionId', '1');

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
						error: 'Invalid recipe ID format',
					});
					expect(mockDatabase.execute).not.toHaveBeenCalled();
				},
			});
		});

		it('returns 400 for empty file upload', async () => {
			const mockFile = createMockFile('empty.jpg', 'image/jpeg', 0);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

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
						error: 'File cannot be empty',
					});
					expect(mockDatabase.execute).not.toHaveBeenCalled();
				},
			});
		});

		it('handles recipe with null image_filename', async () => {
			const mockFile = createMockFile('new.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			mockValidateRecipeInCollection.mockResolvedValue(true);
			mockCanEditResource.mockResolvedValue(true);

			mockDatabase.execute
				.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: null }]]) // Recipe with no existing image
				.mockResolvedValueOnce([{ affectedRows: 1 }]); // Update successful

			mockGenerateVersionedFilename.mockReturnValue('recipe_new_abc123_v1.jpg');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_new_abc123_v1.jpg',
				filename: 'recipe_new_abc123_v1.jpg',
			});

			mockGetRecipeImageUrl.mockReturnValue('/static/recipes/recipe_new_abc123_v1.jpg');

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
					expect(json.filename).toMatch(/^recipe_.*_v1\.jpg$/);
					expect(json.uploadUrl).toMatch(/^\/uploads\/recipe_.*_v1\.jpg$/);
					expect(json.displayUrl).toMatch(/^\/static\/recipes\/recipe_.*_v1\.jpg$/);
					expect(mockFindAndDeleteHashFiles).not.toHaveBeenCalled(); // No cleanup needed for new images
				},
			});
		});

		it('returns 400 for file extension and MIME type mismatch', async () => {
			// Create a file with PNG extension but JPEG MIME type
			const mockFile = new File([new ArrayBuffer(1024)], 'test.png', { type: 'image/jpeg' });
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

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
						error: 'File extension does not match MIME type',
					});
					expect(mockDatabase.execute).not.toHaveBeenCalled();
				},
			});
		});

		it('returns 500 for invalid storage configuration', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');

			mockGetStorageMode.mockReturnValue(null as unknown as string); // Invalid storage mode

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
						error: 'Storage configuration error',
					});
					expect(mockDatabase.execute).not.toHaveBeenCalled();
				},
			});
		});

		it('handles version conflict during concurrent updates', async () => {
			const mockFile = createMockFile('test.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			mockValidateRecipeInCollection.mockResolvedValue(true);
			mockCanEditResource.mockResolvedValue(true);

			mockDatabase.execute
				.mockResolvedValueOnce([[{ image_filename: 'recipe_abc123.jpg', pdf_filename: null }]])
				.mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('abc123');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_abc123_v2.jpg');

			// Simulate version already exists error
			mockUploadFile.mockResolvedValueOnce({
				success: false,
				error: 'Version conflict: recipe_abc123_v2.jpg already exists',
			});

			// Second attempt with incremented version
			mockGenerateVersionedFilename.mockReturnValue('recipe_abc123_v3.jpg');
			mockUploadFile.mockResolvedValueOnce({
				success: true,
				url: '/uploads/recipe_abc123_v3.jpg',
				filename: 'recipe_abc123_v3.jpg',
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
					expect(json.success).toBe(true);
					expect(json.filename).toBe('recipe_abc123_v3.jpg');
					expect(json.uploadUrl).toBe('/uploads/recipe_abc123_v3.jpg');
					expect(json.displayUrl).toBe('/static/recipes/recipe_abc123_v3.jpg');
					expect(mockUploadFile).toHaveBeenCalledTimes(2); // Retry on conflict
				},
			});
		});

		it('returns 400 for corrupt image data', async () => {
			// Create a file with valid MIME type but invalid image data
			const corruptData = Buffer.from('not an image');
			const mockFile = new File([corruptData], 'corrupt.jpg', { type: 'image/jpeg' });
			const formData = new FormData();
			formData.append('image', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

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
						error: 'Invalid image data',
					});
					expect(mockDatabase.execute).not.toHaveBeenCalled();
				},
			});
		});
	});
});
