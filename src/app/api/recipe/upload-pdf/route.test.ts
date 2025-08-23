/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { createMockFile, setupConsoleMocks, standardErrorScenarios, mockAuthenticatedUser } from '@/lib/test-utils';

// Mock the auth middleware to properly handle authentication
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@/lib/auth-middleware', () => require('@/lib/test-utils').authMiddlewareMock);

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

// Get the mocked execute function
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);

// Type assertions for mocked modules
const mockUploadFile = uploadFile as jest.MockedFunction<typeof uploadFile>;
const mockGetStorageMode = getStorageMode as jest.MockedFunction<typeof getStorageMode>;
const mockGetRecipePdfUrl = getRecipePdfUrl as jest.MockedFunction<typeof getRecipePdfUrl>;
const mockGenerateVersionedFilename = generateVersionedFilename as jest.MockedFunction<typeof generateVersionedFilename>;

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('/api/recipe/upload-pdf', () => {
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
						filename: expect.stringContaining('.pdf'),
						url: '/uploads/recipe_1_123456.pdf',
						pdfUrl: '/static/recipes/recipe_1_123456.pdf',
						storageMode: 'local',
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
					expect(json.filename).toBe('existing_v2.pdf');
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
					expect(json.success).toBe(true);
					expect(json.message).toBe('PDF uploaded successfully');
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
						error: 'File and recipe ID are required',
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
						error: 'File and recipe ID are required',
					});
					expect(mockExecute).not.toHaveBeenCalled();
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 for invalid file type (PNG)', async () => {
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
						error: 'Only PDF and JPG files are allowed',
					});
					expect(mockExecute).not.toHaveBeenCalled();
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 for invalid file type (text)', async () => {
			const mockFile = createMockFile('test.txt', 'text/plain', 1024);
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
						error: 'Only PDF and JPG files are allowed',
					});
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 for oversized file (>10MB)', async () => {
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
						error: 'File size must be less than 10MB',
					});
					expect(mockExecute).not.toHaveBeenCalled();
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 404 when recipe not found', async () => {
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
						error: 'Recipe not found',
					});
					expect(mockUploadFile).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 500 when upload fails', async () => {
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
						error: 'Storage service unavailable',
					});
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
					expect(json.storageMode).toBe('cloud');
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

		it('handles non-numeric recipe IDs', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', 'abc');

			mockExecute.mockResolvedValueOnce([
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
	});
});
