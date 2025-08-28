/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { createMockFile, setupConsoleMocks, standardErrorScenarios, mockAuthenticatedUser } from '@/lib/test-utils';

// Mock the auth middleware to properly handle authentication
jest.mock('@/lib/auth-middleware', () => jest.requireActual('@/lib/test-utils').authMiddlewareMock);

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
	getRecipePdfUrl: jest.fn(),
	generateVersionedFilename: jest.fn(),
}));

// Mock the permissions module
jest.mock('@/lib/permissions', () => ({
	canEditResource: jest.fn(),
}));

// Mock jsPDF
jest.mock('jspdf', () => {
	return jest.fn().mockImplementation(() => ({
		setProperties: jest.fn(),
		internal: {
			pageSize: {
				getWidth: jest.fn().mockReturnValue(595),
				getHeight: jest.fn().mockReturnValue(842),
			},
		},
		addImage: jest.fn(),
		output: jest.fn().mockReturnValue(new ArrayBuffer(1024)),
	}));
});

// Mock global Image class for JPG to PDF conversion
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

import { uploadFile, getStorageMode } from '@/lib/storage';
import { getRecipePdfUrl, generateVersionedFilename } from '@/lib/utils/secureFilename';
import { canEditResource } from '@/lib/permissions';

// Get the mocked execute function
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);

// Type assertions for mocked modules
const mockUploadFile = uploadFile as jest.MockedFunction<typeof uploadFile>;
const mockGetStorageMode = getStorageMode as jest.MockedFunction<typeof getStorageMode>;
const mockGetRecipePdfUrl = getRecipePdfUrl as jest.MockedFunction<typeof getRecipePdfUrl>;
const mockGenerateVersionedFilename = generateVersionedFilename as jest.MockedFunction<typeof generateVersionedFilename>;
const mockCanEditResource = canEditResource as jest.MockedFunction<typeof canEditResource>;

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('/api/recipe/upload-pdf', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();
		mockGetStorageMode.mockReturnValue('local');
		mockCanEditResource.mockResolvedValue(true); // Default: can edit
	});

	afterAll(() => {
		consoleMocks.cleanup();
		mockConsoleLog.mockRestore();
		mockConsoleError.mockRestore();
	});

	describe('POST /api/recipe/upload-pdf', () => {
		it('successfully uploads a PDF file for a recipe without existing PDF', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 2048);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');

			mockExecute
				.mockResolvedValueOnce([
					[{ image_filename: 'recipe_1.jpg', pdf_filename: null }], // Recipe exists without PDF
				])
				.mockResolvedValueOnce([{ affectedRows: 1 }]); // Update successful

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_1_123456.pdf',
				filename: 'recipe_1_123456.pdf',
			});

			mockGetRecipePdfUrl.mockReturnValue('/static/recipes/recipe_1_123456.pdf');

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
						message: 'PDF uploaded successfully',
						recipe: {
							id: 1,
							pdfUrl: '/static/recipes/recipe_1_123456.pdf',
							filename: expect.stringMatching(/^recipe_\d+_\d+\.pdf$/),
						},
						upload: {
							storageUrl: '/uploads/recipe_1_123456.pdf',
							storageMode: 'local',
							timestamp: expect.any(String),
							fileSize: expect.any(String),
						},
					});
					expect(mockUploadFile).toHaveBeenCalled();
					expect(mockExecute).toHaveBeenCalledTimes(2);
					expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Set database pdf_filename'));
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('successfully updates existing PDF with versioned filename', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 3072);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '2');

			mockExecute
				.mockResolvedValueOnce([
					[{ image_filename: 'recipe_2.jpg', pdf_filename: 'existing.pdf' }], // Has existing PDF
				])
				.mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockGenerateVersionedFilename.mockReturnValue('existing_v2.pdf');

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/existing_v2.pdf',
				filename: 'existing_v2.pdf',
			});

			mockGetRecipePdfUrl.mockReturnValue('/static/recipes/existing_v2.pdf');

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
					expect(json.recipe.filename).toBe('existing_v2.pdf');
					expect(mockGenerateVersionedFilename).toHaveBeenCalledWith('existing.pdf', 'pdf');
					expect(mockConsoleLog).toHaveBeenCalledWith('Updating PDF from existing.pdf to existing_v2.pdf');
					expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Updated database pdf_filename'));
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('successfully converts JPG to PDF', async () => {
			const mockFile = createMockFile('photo.jpg', 'image/jpeg', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '3');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: null }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_3_123456.pdf',
				filename: 'recipe_3_123456.pdf',
			});

			mockGetRecipePdfUrl.mockReturnValue('/static/recipes/recipe_3_123456.pdf');

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
						message: 'PDF uploaded successfully',
						recipe: {
							id: 3,
							pdfUrl: '/static/recipes/recipe_3_123456.pdf',
							filename: expect.stringMatching(/^recipe_\d+_\d+\.pdf$/),
						},
						upload: {
							storageUrl: '/uploads/recipe_3_123456.pdf',
							storageMode: 'local',
							timestamp: expect.any(String),
							fileSize: expect.any(String),
						},
						conversion: {
							originalFormat: 'image/jpeg',
							convertedTo: 'application/pdf',
							originalFileName: 'photo.jpg',
						},
					});
					// Should upload as PDF even though input was JPG
					expect(mockUploadFile).toHaveBeenCalledWith(expect.any(Buffer), expect.any(String), 'pdf', 'application/pdf');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('successfully converts JPG (image/jpg MIME type) to PDF', async () => {
			const mockFile = createMockFile('photo.jpg', 'image/jpg', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '4');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: null }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_4_123456.pdf',
				filename: 'recipe_4_123456.pdf',
			});

			mockGetRecipePdfUrl.mockReturnValue('/static/recipes/recipe_4_123456.pdf');

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
					expect(mockUploadFile).toHaveBeenCalledWith(expect.any(Buffer), expect.any(String), 'pdf', 'application/pdf');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 when PDF file is missing', async () => {
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
						error: 'PDF file is required.',
						field: 'pdf',
						message: 'Please select a PDF or JPEG file to upload.',
					});
					expect(mockExecute).not.toHaveBeenCalled();
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 when recipe ID is missing', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);

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
						error: 'Recipe ID is required.',
						field: 'recipeId',
						message: 'Please specify which recipe to update.',
					});
					expect(mockExecute).not.toHaveBeenCalled();
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 for invalid file type with detailed error', async () => {
			const mockFile = createMockFile('test.png', 'image/png', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
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
						error: 'Invalid file type. Only PDF and JPEG files are supported.',
						supportedTypes: ['application/pdf', 'image/jpeg'],
						receivedType: 'image/png',
						fileName: 'test.png',
						message: 'Please upload a PDF document or JPEG image.',
					});
					expect(mockExecute).not.toHaveBeenCalled();
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
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
							error: 'Invalid file type. Only PDF and JPEG files are supported.',
							supportedTypes: ['application/pdf', 'image/jpeg'],
							receivedType: testCase.type,
							fileName: testCase.name,
							message: 'Please upload a PDF document or JPEG image.',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			}
		});

		it('returns 400 for oversized file with helpful context', async () => {
			const largeFile = createMockFile('large.pdf', 'application/pdf', 11 * 1024 * 1024); // 11MB
			const formData = new FormData();
			formData.append('pdf', largeFile);
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
						error: 'File size exceeds maximum limit.',
						maxSizeAllowed: '10MB',
						receivedSize: '11MB',
						fileName: 'large.pdf',
						message: 'Please compress your file or use a smaller PDF/image.',
						suggestion: 'Try reducing image quality or splitting large documents into smaller files.',
					});
					expect(mockExecute).not.toHaveBeenCalled();
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 404 when recipe not found with helpful message', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
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
						error: 'Recipe not found.',
						recipeId: '999',
						message: 'The specified recipe does not exist or has been deleted.',
						suggestion: 'Please check the recipe ID and try again.',
					});
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 500 when upload fails with user-friendly message', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
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
						error: 'Unable to save the PDF file. Please try again.',
						retryable: true,
						message: 'There was a temporary problem with file storage.',
						suggestion: 'If this problem persists, please contact support.',
						supportContact: 'support@familyfoodie.com',
					});
					// Internal error should be logged but not exposed
					expect(mockConsoleError).toHaveBeenCalledWith('Upload failed:', 'Storage service unavailable');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 500 when database update fails', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: null }]]).mockResolvedValueOnce([{ affectedRows: 0 }]); // Update fails

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_1_123456.pdf',
				filename: 'recipe_1_123456.pdf',
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
						error: 'Failed to update recipe PDF filename',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('logs storage mode and upload details', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: null }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_1.pdf',
				filename: 'recipe_1.pdf',
			});

			mockGetStorageMode.mockReturnValue('cloud');
			mockGetRecipePdfUrl.mockReturnValue('/static/recipes/recipe_1.pdf');

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
					expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Uploading PDF with filename:'));
					expect(json.upload.storageMode).toBe('cloud');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('handles database query errors gracefully', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
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
						error: 'Failed to upload PDF',
					});
					expect(mockConsoleError).toHaveBeenCalledWith('Error uploading PDF:', expect.any(Error));
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('handles unknown errors gracefully', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
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
						error: 'Failed to upload PDF',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 when recipe ID is not a valid number', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', 'not-a-number');

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
						error: 'Recipe ID must be a valid number.',
						field: 'recipeId',
						receivedValue: 'not-a-number',
						message: 'Please provide a valid numeric recipe ID.',
					});
					expect(mockExecute).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('handles JPG to PDF conversion with landscape orientation', async () => {
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

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: null }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_5_123456.pdf',
				filename: 'recipe_5_123456.pdf',
			});

			mockGetRecipePdfUrl.mockReturnValue('/static/recipes/recipe_5_123456.pdf');

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
					// jsPDF should be called with landscape orientation due to aspect ratio
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('handles JPG to PDF conversion with portrait orientation', async () => {
			// Mock a tall image (portrait)
			global.Image = class {
				width = 600;
				height = 800;
				onload: (() => void) | null = null;
				onerror: ((error: Error) => void) | null = null;
				src = '';

				constructor() {
					setTimeout(() => {
						if (this.onload) this.onload();
					}, 0);
				}
			} as typeof Image;

			const mockFile = createMockFile('portrait.jpg', 'image/jpeg', 2048);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '6');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: null }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/recipe_6_123456.pdf',
				filename: 'recipe_6_123456.pdf',
			});

			mockGetRecipePdfUrl.mockReturnValue('/static/recipes/recipe_6_123456.pdf');

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
					// jsPDF should be called with portrait orientation due to aspect ratio
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 401 when user is not authenticated', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						body: formData,
					});
					const json = await response.json();

					expect(response.status).toBe(401);
					expect(json).toEqual({
						success: false,
						error: 'Authentication required',
						code: 'UNAUTHORIZED',
					});
					expect(mockExecute).not.toHaveBeenCalled();
				},
				// No requestPatcher - simulates unauthenticated user
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
						error: 'Invalid or corrupted image file.',
						message: 'The uploaded image could not be processed.',
						fileName: 'corrupted.jpg',
						suggestion: 'Please try uploading a different image or convert it to PDF first.',
					});
					expect(mockExecute).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 for empty recipe ID', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '');

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
						error: 'Recipe ID is required.',
						field: 'recipeId',
						message: 'Please specify which recipe to update.',
					});
					expect(mockExecute).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 for zero recipe ID', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '0');

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
						error: 'Recipe ID must be a positive number.',
						field: 'recipeId',
						receivedValue: '0',
						message: 'Recipe ID must be greater than zero.',
					});
					expect(mockExecute).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 for negative recipe ID', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '-5');

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
						error: 'Recipe ID must be a positive number.',
						field: 'recipeId',
						receivedValue: '-5',
						message: 'Recipe ID must be greater than zero.',
					});
					expect(mockExecute).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('handles extremely large file sizes with detailed error', async () => {
			const extremeLargeFile = createMockFile('enormous.pdf', 'application/pdf', 50 * 1024 * 1024); // 50MB
			const formData = new FormData();
			formData.append('pdf', extremeLargeFile);
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
						error: 'File size exceeds maximum limit.',
						maxSizeAllowed: '10MB',
						receivedSize: '50MB',
						fileName: 'enormous.pdf',
						message: 'Please compress your file or use a smaller PDF/image.',
						suggestion: 'Try reducing image quality or splitting large documents into smaller files.',
					});
					expect(mockExecute).not.toHaveBeenCalled();
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});
	});
});
