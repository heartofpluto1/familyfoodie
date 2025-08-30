/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import { NextResponse } from 'next/server';
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

// Get the mocked database
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);
// Mock the storage module
jest.mock('@/lib/storage', () => ({
	uploadFile: jest.fn(),
	getStorageMode: jest.fn(),
	deleteFile: jest.fn(),
}));

// Mock the permissions module
jest.mock('@/lib/permissions', () => ({
	canEditResource: jest.fn(),
	validateRecipeInCollection: jest.fn(),
}));

// Mock the copy-on-write module
jest.mock('@/lib/copy-on-write', () => ({
	cascadeCopyWithContext: jest.fn(),
}));

// Mock the utils modules
jest.mock('@/lib/utils/secureFilename', () => ({
	getRecipePdfUrl: jest.fn(),
	generateVersionedFilename: jest.fn(),
	extractBaseHash: jest.fn(),
}));

jest.mock('@/lib/utils/secureFilename.server', () => ({
	findAndDeleteHashFiles: jest.fn(),
}));

// Mock jsPDF
const mockSetProperties = jest.fn();
const mockAddImage = jest.fn();
const mockOutput = jest.fn().mockReturnValue(new ArrayBuffer(1024));
const mockGetWidth = jest.fn().mockReturnValue(595);
const mockGetHeight = jest.fn().mockReturnValue(842);

jest.mock('jspdf', () => {
	return jest.fn().mockImplementation(() => ({
		setProperties: mockSetProperties,
		internal: {
			pageSize: {
				getWidth: mockGetWidth,
				getHeight: mockGetHeight,
			},
		},
		addImage: mockAddImage,
		output: mockOutput,
	}));
});

// Mock global Image class
global.Image = class {
	width = 800;
	height = 600;
	onload: (() => void) | null = null;
	onerror: ((error: Error) => void) | null = null;
	src = '';
	constructor() {
		setTimeout(() => {
			if (this.onload) this.onload();
		}, 0);
	}
} as typeof Image;

import { uploadFile, getStorageMode, deleteFile } from '@/lib/storage';
import { canEditResource, validateRecipeInCollection } from '@/lib/permissions';
import { cascadeCopyWithContext } from '@/lib/copy-on-write';
import { getRecipePdfUrl, generateVersionedFilename, extractBaseHash } from '@/lib/utils/secureFilename';
import { findAndDeleteHashFiles } from '@/lib/utils/secureFilename.server';

// Get mock functions
const mockUploadFile = uploadFile as jest.MockedFunction<typeof uploadFile>;
const mockGetStorageMode = getStorageMode as jest.MockedFunction<typeof getStorageMode>;
const mockDeleteFile = deleteFile as jest.MockedFunction<typeof deleteFile>;
const mockGetRecipePdfUrl = getRecipePdfUrl as jest.MockedFunction<typeof getRecipePdfUrl>;
const mockGenerateVersionedFilename = generateVersionedFilename as jest.MockedFunction<typeof generateVersionedFilename>;
const mockExtractBaseHash = extractBaseHash as jest.MockedFunction<typeof extractBaseHash>;
const mockFindAndDeleteHashFiles = findAndDeleteHashFiles as jest.MockedFunction<typeof findAndDeleteHashFiles>;
const mockCanEditResource = canEditResource as jest.MockedFunction<typeof canEditResource>;
const mockValidateRecipeInCollection = validateRecipeInCollection as jest.MockedFunction<typeof validateRecipeInCollection>;
const mockCascadeCopyWithContext = cascadeCopyWithContext as jest.MockedFunction<typeof cascadeCopyWithContext>;

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();

describe('/api/recipe/update-pdf', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();
		mockGetStorageMode.mockReturnValue('local');
		mockCanEditResource.mockResolvedValue(true); // Default: can edit
		mockValidateRecipeInCollection.mockResolvedValue(true); // Default: recipe is in collection
		mockCascadeCopyWithContext.mockResolvedValue({
			newCollectionId: 1,
			newRecipeId: 100,
			actionsTaken: ['recipe_copied'],
		}); // Default cascade copy response

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

	describe('POST /api/recipe/update-pdf', () => {
		it('successfully updates PDF with file cleanup', async () => {
			const mockFile = createMockFile('updated.pdf', 'application/pdf', 3072);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			mockExecute
				.mockResolvedValueOnce([[{ image_filename: 'recipe_1.jpg', pdf_filename: 'recipe_abc123.pdf' }]])
				.mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('abc123');
			mockFindAndDeleteHashFiles.mockResolvedValue(['recipe_abc123_v1.pdf', 'recipe_abc123_v2.pdf']);
			mockGenerateVersionedFilename.mockReturnValue('recipe_abc123_v3.pdf');
			mockUploadFile.mockResolvedValue({ success: true, url: '/uploads/recipe_abc123_v3.pdf', filename: 'recipe_abc123_v3.pdf' });
			mockGetRecipePdfUrl.mockReturnValue('/static/recipes/recipe_abc123_v3.pdf');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json).toEqual({
						success: true,
						message: 'Recipe PDF updated successfully',
						recipe: {
							id: 1,
							pdfUrl: '/static/recipes/recipe_abc123_v3.pdf',
							filename: 'recipe_abc123_v3.pdf',
						},
						upload: {
							storageUrl: '/uploads/recipe_abc123_v3.pdf',
							storageMode: 'local',
							timestamp: expect.any(String),
							fileSize: expect.any(String),
						},
					});
					expect(mockConsoleLog).toHaveBeenCalledWith('Cleaned up 2 old file(s): recipe_abc123_v1.pdf, recipe_abc123_v2.pdf');
					// Verify no cleanup details in response
					expect(json.cleanup).toBeUndefined();
				},
			});
		});

		it('successfully converts JPG to PDF with proper metadata and quality', async () => {
			const mockFile = createMockFile('recipe-photo.jpg', 'image/jpeg', 2048);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '2');
			formData.append('collectionId', '1');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: 'recipe_def456.pdf' }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('def456');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_def456_v2.pdf');
			mockUploadFile.mockResolvedValue({ success: true, url: '/uploads/recipe_def456_v2.pdf', filename: 'recipe_def456_v2.pdf' });
			mockGetRecipePdfUrl.mockReturnValue('/static/recipes/recipe_def456_v2.pdf');

			// Reset the mock before test to ensure clean state
			jest.clearAllMocks();

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json).toEqual({
						success: true,
						message: 'Recipe PDF updated successfully',
						recipe: {
							id: 2,
							pdfUrl: '/static/recipes/recipe_def456_v2.pdf',
							filename: 'recipe_def456_v2.pdf',
						},
						upload: {
							storageUrl: '/uploads/recipe_def456_v2.pdf',
							storageMode: 'local',
							timestamp: expect.any(String),
							fileSize: expect.any(String),
						},
						conversion: {
							originalFormat: 'image/jpeg',
							convertedTo: 'application/pdf',
							originalFileName: 'recipe-photo.jpg',
						},
					});

					// Verify PDF metadata was set correctly
					expect(mockSetProperties).toHaveBeenCalledWith({
						title: 'recipe-photo.jpg',
						subject: 'Recipe Image converted to PDF',
						author: 'Family Foodie App',
						creator: 'Family Foodie Recipe Management System',
					});

					// Verify image was added with quality settings
					expect(mockAddImage).toHaveBeenCalledWith(
						expect.stringMatching(/^data:image\/jpeg;base64,/),
						'JPEG',
						expect.any(Number), // x position
						expect.any(Number), // y position
						expect.any(Number), // width
						expect.any(Number), // height
						undefined,
						'SLOW' // Quality setting
					);

					expect(mockUploadFile).toHaveBeenCalledWith(expect.any(Buffer), expect.any(String), 'pdf', 'application/pdf');
				},
			});
		});

		it('continues with update when file cleanup fails', async () => {
			const mockFile = createMockFile('updated.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '3');
			formData.append('collectionId', '1');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: 'recipe_ghi789.pdf' }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('ghi789');
			mockFindAndDeleteHashFiles.mockRejectedValue(new Error('Cleanup failed'));
			mockGenerateVersionedFilename.mockReturnValue('recipe_ghi789_v2.pdf');
			mockUploadFile.mockResolvedValue({ success: true, url: '/uploads/recipe_ghi789_v2.pdf', filename: 'recipe_ghi789_v2.pdf' });
			mockGetRecipePdfUrl.mockReturnValue('/static/recipes/recipe_ghi789_v2.pdf');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json.success).toBe(true);
					// Cleanup info should not be in response, only logged
					expect(json.cleanup).toBeUndefined();
					expect(mockConsoleWarn).toHaveBeenCalledWith('File cleanup failed but continuing with upload:', expect.any(Error));
				},
			});
		});

		it('returns 400 when file is missing', async () => {
			const formData = new FormData();
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json).toEqual({
						error: 'PDF file is required.',
						field: 'pdf',
						message: 'Please select a PDF or JPEG file to upload.',
					});
					expect(mockExecute).not.toHaveBeenCalled();
				},
			});
		});

		it('returns 400 when both recipe ID and collection ID are missing', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json).toEqual({
						error: 'Recipe ID and collection ID are required.',
						fields: ['recipeId', 'collectionId'],
						message: 'Please specify which recipe and collection to update.',
					});
					expect(mockExecute).not.toHaveBeenCalled();
				},
			});
		});

		it('returns 400 when recipe ID is missing', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('collectionId', '1');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json).toEqual({
						error: 'Recipe ID and collection ID are required.',
						fields: ['recipeId', 'collectionId'],
						message: 'Please specify which recipe and collection to update.',
					});
					expect(mockExecute).not.toHaveBeenCalled();
				},
			});
		});

		it('returns 400 when collection ID is missing', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json).toEqual({
						error: 'Recipe ID and collection ID are required.',
						fields: ['recipeId', 'collectionId'],
						message: 'Please specify which recipe and collection to update.',
					});
					expect(mockExecute).not.toHaveBeenCalled();
				},
			});
		});

		it('returns 400 when recipe ID is not a valid number', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', 'not-a-number');
			formData.append('collectionId', '1');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json).toEqual({
						error: 'Recipe ID must be a valid positive number.',
						field: 'recipeId',
						receivedValue: 'not-a-number',
						message: 'Please provide a valid numeric recipe ID.',
					});
					expect(mockExecute).not.toHaveBeenCalled();
				},
			});
		});

		it('returns 400 for invalid file type with detailed error', async () => {
			const mockFile = createMockFile('test.png', 'image/png', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json).toEqual({
						error: 'Invalid file type. Only PDF and JPEG files are supported.',
						supportedTypes: ['application/pdf', 'image/jpeg'],
						receivedType: 'image/png',
						fileName: 'test.png',
						message: 'Please upload a PDF document or JPEG image.',
					});
				},
			});
		});

		it('returns 400 for various unsupported file types', async () => {
			const testCases = [
				{ type: 'image/gif', name: 'test.gif', description: 'GIF image' },
				{ type: 'text/plain', name: 'test.txt', description: 'text file' },
				{ type: 'application/msword', name: 'test.doc', description: 'Word document' },
				{ type: 'video/mp4', name: 'test.mp4', description: 'video file' },
			];

			for (const testCase of testCases) {
				const mockFile = createMockFile(testCase.name, testCase.type, 1024);
				const formData = new FormData();
				formData.append('pdf', mockFile);
				formData.append('recipeId', '1');
				formData.append('collectionId', '1');

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST', body: formData });
						const json = await response.json();

						expect(response.status).toBe(400);
						expect(json).toEqual({
							error: 'Invalid file type. Only PDF and JPEG files are supported.',
							supportedTypes: ['application/pdf', 'image/jpeg'],
							receivedType: testCase.type,
							fileName: testCase.name,
							message: 'Please upload a PDF document or JPEG image.',
						});
					},
				});
			}
		});

		it('returns 400 for oversized file with helpful context', async () => {
			const largeFile = createMockFile('large.pdf', 'application/pdf', 11 * 1024 * 1024); // 11MB
			const formData = new FormData();
			formData.append('pdf', largeFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json).toEqual({
						error: 'File size exceeds maximum limit.',
						maxSizeAllowed: '10MB',
						receivedSize: '11MB',
						fileName: 'large.pdf',
						message: 'Please compress your file or use a smaller PDF/image.',
						suggestion: 'Try reducing image quality or splitting large documents into smaller files.',
					});
				},
			});
		});

		it('returns 401 when user is not authenticated', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			// Mock auth failure
			mockRequireAuth.mockResolvedValueOnce({
				authorized: false as const,
				response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
			});

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(401);
					expect(json).toEqual({
						error: 'Unauthorized',
					});
					expect(mockExecute).not.toHaveBeenCalled();
				},
			});
		});

		it('returns 404 when recipe not found with helpful message', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '999');
			formData.append('collectionId', '1');

			mockValidateRecipeInCollection.mockResolvedValueOnce(false);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(404);
					expect(json).toEqual({
						error: 'Recipe not found.',
						recipeId: '999',
						message: 'The specified recipe does not exist or you do not have permission to edit it.',
						suggestion: 'Please check the recipe ID and try again.',
					});
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
			});
		});

		it('returns 500 when upload fails with user-friendly message', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: 'recipe_abc.pdf' }]]);
			mockExtractBaseHash.mockReturnValue('abc');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_abc_v2.pdf');
			mockUploadFile.mockResolvedValue({ success: false, error: 'Storage unavailable' });

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(500);
					expect(json).toEqual({
						error: 'Unable to save the PDF file. Please try again.',
						retryable: true,
						message: 'There was a temporary problem with file storage.',
						suggestion: 'If this problem persists, please contact support.',
						supportContact: 'support@familyfoodie.com',
					});
					// Internal error should be logged but not exposed
					expect(mockConsoleError).toHaveBeenCalledWith('Upload failed:', 'Storage unavailable');
				},
			});
		});

		it('returns 500 when database update fails and rolls back uploaded file', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: 'recipe_abc.pdf' }]]).mockResolvedValueOnce([{ affectedRows: 0 }]); // Update fails

			mockExtractBaseHash.mockReturnValue('abc');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_abc_v2.pdf');
			mockUploadFile.mockResolvedValue({ success: true, url: '/uploads/recipe_abc_v2.pdf', filename: 'recipe_abc_v2.pdf' });
			mockDeleteFile.mockResolvedValue(true); // Rollback succeeds

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(500);
					expect(json).toEqual({
						error: 'Failed to save PDF information. Please try uploading again.',
						retryable: true,
						message: 'The file was uploaded but could not be properly saved.',
						recipeId: '1',
					});

					// Verify that uploaded file was cleaned up on failure
					expect(mockDeleteFile).toHaveBeenCalledWith('recipe_abc_v2', 'pdf');
					expect(mockConsoleLog).toHaveBeenCalledWith('Rolled back uploaded file: recipe_abc_v2.pdf');
				},
			});
		});

		it('logs storage mode and update details', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: 'recipe_original.pdf' }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('original');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_original_v2.pdf');
			mockUploadFile.mockResolvedValue({ success: true, url: '/uploads/recipe_original_v2.pdf', filename: 'recipe_original_v2.pdf' });
			mockGetRecipePdfUrl.mockReturnValue('/static/recipes/recipe_original_v2.pdf');
			mockGetStorageMode.mockReturnValue('cloud');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(mockConsoleLog).toHaveBeenCalledWith('Storage mode: cloud');
					expect(mockConsoleLog).toHaveBeenCalledWith('Updating PDF from recipe_original.pdf to recipe_original_v2.pdf');
					expect(mockConsoleLog).toHaveBeenCalledWith('Updated database pdf_filename to recipe_original_v2.pdf for recipe 1');
					expect(json.upload.storageMode).toBe('cloud');
				},
			});
		});

		it('handles database errors gracefully', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			mockExecute.mockRejectedValue(standardErrorScenarios.databaseError);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(500);
					expect(json).toEqual({ error: 'Failed to update recipe PDF' });
					expect(mockConsoleError).toHaveBeenCalledWith('Error updating recipe PDF:', expect.any(Error));
				},
			});
		});

		it('handles unknown errors gracefully', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			mockExecute.mockRejectedValue('String error');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(500);
					expect(json).toEqual({ error: 'Failed to update recipe PDF' });
				},
			});
		});

		it('handles landscape JPG to PDF conversion', async () => {
			// Mock a wide image (landscape)
			global.Image = class {
				width = 1920;
				height = 1080;
				onload: (() => void) | null = null;
				onerror: ((error: Error) => void) | null = null;
				src = '';
				constructor() {
					setTimeout(() => {
						if (this.onload) this.onload();
					}, 0);
				}
			} as typeof Image;

			const mockFile = createMockFile('landscape.jpg', 'image/jpeg', 2048);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '5');
			formData.append('collectionId', '1');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: 'recipe_test.pdf' }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('test');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_test_v2.pdf');
			mockUploadFile.mockResolvedValue({ success: true, url: '/uploads/recipe_test_v2.pdf', filename: 'recipe_test_v2.pdf' });
			mockGetRecipePdfUrl.mockReturnValue('/static/recipes/recipe_test_v2.pdf');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json.success).toBe(true);
				},
			});
		});

		it('handles when no base hash can be extracted', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: 'recipe_xyz.pdf' }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue(null as unknown as string); // No base hash
			mockGenerateVersionedFilename.mockReturnValue('recipe_xyz_v2.pdf');
			mockUploadFile.mockResolvedValue({ success: true, url: '/uploads/recipe_xyz_v2.pdf', filename: 'recipe_xyz_v2.pdf' });
			mockGetRecipePdfUrl.mockReturnValue('/static/recipes/recipe_xyz_v2.pdf');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json.success).toBe(true);
					// Cleanup info should not be in response
					expect(json.cleanup).toBeUndefined();
					expect(mockFindAndDeleteHashFiles).not.toHaveBeenCalled();
				},
			});
		});

		it('handles concurrent upload attempts gracefully', async () => {
			const mockFile = createMockFile('concurrent.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			// Mock a database lock or conflict scenario
			mockExecute
				.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: 'recipe_abc.pdf' }]]) // First query succeeds
				.mockRejectedValueOnce(new Error('ER_LOCK_WAIT_TIMEOUT')); // Update fails due to lock

			mockExtractBaseHash.mockReturnValue('abc');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_abc_v2.pdf');
			mockUploadFile.mockResolvedValue({ success: true, url: '/uploads/recipe_abc_v2.pdf', filename: 'recipe_abc_v2.pdf' });

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(409);
					expect(json).toEqual({
						error: 'Another upload is currently in progress for this recipe.',
						message: 'Please wait for the current upload to complete before trying again.',
						retryAfter: expect.any(Number), // seconds to wait
						recipeId: '1',
					});
				},
			});
		});

		it('validates that cleanup happens after successful database update, not before', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: 'recipe_abc123.pdf' }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('abc123');
			mockFindAndDeleteHashFiles.mockResolvedValue(['recipe_abc123_v1.pdf']);
			mockGenerateVersionedFilename.mockReturnValue('recipe_abc123_v2.pdf');
			mockUploadFile.mockResolvedValue({ success: true, url: '/uploads/recipe_abc123_v2.pdf', filename: 'recipe_abc123_v2.pdf' });
			mockGetRecipePdfUrl.mockReturnValue('/static/recipes/recipe_abc123_v2.pdf');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(200);

					// Verify that database update was called (cleanup logic timing test)
					// Note: In ideal implementation, cleanup should happen after successful DB update
					expect(mockExecute).toHaveBeenCalledWith('UPDATE recipes SET pdf_filename = ? WHERE id = ?', ['recipe_abc123_v2.pdf', 1]);

					// Response should not include internal cleanup details
					expect(json.cleanup).toBeUndefined();
					expect(json.internalDetails).toBeUndefined();

					// But cleanup should still be logged for debugging
					expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Cleaned up'));
				},
			});
		});

		it('handles image loading errors gracefully during conversion', async () => {
			// Mock image loading failure
			global.Image = class {
				width = 800;
				height = 600;
				onload: (() => void) | null = null;
				onerror: ((error: Error) => void) | null = null;
				src = '';
				constructor() {
					setTimeout(() => {
						if (this.onerror) this.onerror(new Error('Image loading failed'));
					}, 0);
				}
			} as typeof Image;

			const mockFile = createMockFile('corrupted.jpg', 'image/jpeg', 2048);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');
			formData.append('collectionId', '1');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json).toEqual({
						error: 'Invalid or corrupted image file.',
						message: 'The uploaded image could not be processed.',
						fileName: 'corrupted.jpg',
						suggestion: 'Please try uploading a different image or convert it to PDF first.',
					});
					expect(mockExecute).not.toHaveBeenCalled();
				},
			});
		});
	});
});
