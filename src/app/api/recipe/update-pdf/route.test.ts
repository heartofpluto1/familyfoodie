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

// Get the mocked database
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);
// Mock the storage module
jest.mock('@/lib/storage', () => ({
	uploadFile: jest.fn(),
	getStorageMode: jest.fn(),
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

import { uploadFile, getStorageMode } from '@/lib/storage';
import { getRecipePdfUrl, generateVersionedFilename, extractBaseHash } from '@/lib/utils/secureFilename';
import { findAndDeleteHashFiles } from '@/lib/utils/secureFilename.server';

// Get mock functions
const mockUploadFile = uploadFile as jest.MockedFunction<typeof uploadFile>;
const mockGetStorageMode = getStorageMode as jest.MockedFunction<typeof getStorageMode>;
const mockGetRecipePdfUrl = getRecipePdfUrl as jest.MockedFunction<typeof getRecipePdfUrl>;
const mockGenerateVersionedFilename = generateVersionedFilename as jest.MockedFunction<typeof generateVersionedFilename>;
const mockExtractBaseHash = extractBaseHash as jest.MockedFunction<typeof extractBaseHash>;
const mockFindAndDeleteHashFiles = findAndDeleteHashFiles as jest.MockedFunction<typeof findAndDeleteHashFiles>;

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

			mockExecute
				.mockResolvedValueOnce([[{ image_filename: 'recipe_1.jpg', pdf_filename: 'recipe_abc123.pdf' }]])
				.mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('abc123');
			mockFindAndDeleteHashFiles.mockResolvedValue(['recipe_abc123_v1.pdf', 'recipe_abc123_v2.pdf']);
			mockGenerateVersionedFilename.mockReturnValue('recipe_abc123_v3.pdf');
			mockUploadFile.mockResolvedValue({ success: true, url: '/uploads/recipe_abc123_v3.pdf' });
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
						filename: 'recipe_abc123_v3.pdf',
						url: '/uploads/recipe_abc123_v3.pdf',
						pdfUrl: '/static/recipes/recipe_abc123_v3.pdf',
						storageMode: 'local',
						cleanup: 'Cleaned up 2 old file(s): recipe_abc123_v1.pdf, recipe_abc123_v2.pdf',
					});
					expect(mockConsoleLog).toHaveBeenCalledWith('Cleaned up 2 old file(s): recipe_abc123_v1.pdf, recipe_abc123_v2.pdf');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('successfully converts JPG to PDF for update', async () => {
			const mockFile = createMockFile('photo.jpg', 'image/jpeg', 2048);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '2');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: 'recipe_def456.pdf' }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('def456');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_def456_v2.pdf');
			mockUploadFile.mockResolvedValue({ success: true, url: '/uploads/recipe_def456_v2.pdf' });
			mockGetRecipePdfUrl.mockReturnValue('/static/recipes/recipe_def456_v2.pdf');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json.success).toBe(true);
					expect(mockUploadFile).toHaveBeenCalledWith(expect.any(Buffer), expect.any(String), 'pdf', 'application/pdf');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('continues with update when file cleanup fails', async () => {
			const mockFile = createMockFile('updated.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '3');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: 'recipe_ghi789.pdf' }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('ghi789');
			mockFindAndDeleteHashFiles.mockRejectedValue(new Error('Cleanup failed'));
			mockGenerateVersionedFilename.mockReturnValue('recipe_ghi789_v2.pdf');
			mockUploadFile.mockResolvedValue({ success: true, url: '/uploads/recipe_ghi789_v2.pdf' });
			mockGetRecipePdfUrl.mockReturnValue('/static/recipes/recipe_ghi789_v2.pdf');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json.success).toBe(true);
					expect(json.cleanup).toBe('No old files to clean up');
					expect(mockConsoleWarn).toHaveBeenCalledWith('File cleanup failed but continuing with upload:', expect.any(Error));
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 when file is missing', async () => {
			const formData = new FormData();
			formData.append('recipeId', '1');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json).toEqual({ error: 'File and recipe ID are required' });
					expect(mockExecute).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 for invalid file type', async () => {
			const mockFile = createMockFile('test.png', 'image/png', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json).toEqual({ error: 'Only PDF and JPG files are allowed' });
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 400 for oversized file', async () => {
			const largeFile = createMockFile('large.pdf', 'application/pdf', 11 * 1024 * 1024); // 11MB
			const formData = new FormData();
			formData.append('pdf', largeFile);
			formData.append('recipeId', '1');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json).toEqual({ error: 'File size must be less than 10MB' });
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 404 when recipe not found', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '999');

			mockExecute.mockResolvedValueOnce([[]]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(404);
					expect(json).toEqual({ error: 'Recipe not found' });
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
					expect(json).toEqual({ error: 'Storage unavailable' });
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('returns 500 when database update fails', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: 'recipe_abc.pdf' }]]).mockResolvedValueOnce([{ affectedRows: 0 }]); // Update fails

			mockExtractBaseHash.mockReturnValue('abc');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_abc_v2.pdf');
			mockUploadFile.mockResolvedValue({ success: true, url: '/uploads/recipe_abc_v2.pdf' });

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(500);
					expect(json).toEqual({ error: 'Failed to update recipe PDF filename' });
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('logs storage mode and update details', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: 'recipe_original.pdf' }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('original');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_original_v2.pdf');
			mockUploadFile.mockResolvedValue({ success: true, url: '/uploads/recipe_original_v2.pdf' });
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
					expect(json.storageMode).toBe('cloud');
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('handles database errors gracefully', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');

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
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(500);
					expect(json).toEqual({ error: 'Failed to update recipe PDF' });
				},
				requestPatcher: mockAuthenticatedUser,
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

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: 'recipe_test.pdf' }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue('test');
			mockFindAndDeleteHashFiles.mockResolvedValue([]);
			mockGenerateVersionedFilename.mockReturnValue('recipe_test_v2.pdf');
			mockUploadFile.mockResolvedValue({ success: true, url: '/uploads/recipe_test_v2.pdf' });
			mockGetRecipePdfUrl.mockReturnValue('/static/recipes/recipe_test_v2.pdf');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json.success).toBe(true);
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});

		it('handles when no base hash can be extracted', async () => {
			const mockFile = createMockFile('test.pdf', 'application/pdf', 1024);
			const formData = new FormData();
			formData.append('pdf', mockFile);
			formData.append('recipeId', '1');

			mockExecute.mockResolvedValueOnce([[{ image_filename: null, pdf_filename: 'recipe_xyz.pdf' }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

			mockExtractBaseHash.mockReturnValue(null as unknown as string); // No base hash
			mockGenerateVersionedFilename.mockReturnValue('recipe_xyz_v2.pdf');
			mockUploadFile.mockResolvedValue({ success: true, url: '/uploads/recipe_xyz_v2.pdf' });
			mockGetRecipePdfUrl.mockReturnValue('/static/recipes/recipe_xyz_v2.pdf');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST', body: formData });
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json.success).toBe(true);
					expect(json.cleanup).toBe('No old files to clean up');
					expect(mockFindAndDeleteHashFiles).not.toHaveBeenCalled();
				},
				requestPatcher: mockAuthenticatedUser,
			});
		});
	});
});
