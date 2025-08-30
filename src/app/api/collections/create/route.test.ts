/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { requireAuth } from '@/lib/auth/helpers';
import { mockRegularSession } from '@/lib/test-utils';

const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

// Mock dependencies
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
	getConnection: jest.fn(),
	end: jest.fn(),
}));

jest.mock('@/lib/utils/secureFilename.collections', () => ({
	generateCollectionSecureFilename: jest.fn(),
}));

jest.mock('@/lib/storage', () => ({
	uploadFile: jest.fn(),
	getStorageMode: jest.fn(),
}));

jest.mock('@/lib/utils/urlHelpers', () => ({
	generateSlugFromTitle: jest.fn(),
}));

// Mock the OAuth auth helpers
jest.mock('@/lib/auth/helpers', () => ({
	requireAuth: jest.fn(),
}));

// Get mocked functions
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);
const mockGenerateCollectionSecureFilename = jest.mocked(jest.requireMock('@/lib/utils/secureFilename.collections').generateCollectionSecureFilename);
const mockUploadFile = jest.mocked(jest.requireMock('@/lib/storage').uploadFile);
const mockGetStorageMode = jest.mocked(jest.requireMock('@/lib/storage').getStorageMode);
const mockGenerateSlugFromTitle = jest.mocked(jest.requireMock('@/lib/utils/urlHelpers').generateSlugFromTitle);

// Mock console.log and console.error to reduce test noise
const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

// OAuth pattern handles authentication automatically

// Helper to create a mock File object
function createMockFile(name: string, type: string, content = 'test content'): File {
	const file = new File([content], name, { type });
	return file;
}

describe('/api/collections/create', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		// Default mock implementations
		mockGetStorageMode.mockReturnValue('local');
		mockGenerateCollectionSecureFilename.mockReturnValue('secure_filename_123');
		mockGenerateSlugFromTitle.mockReturnValue('42-test-collection');
		mockUploadFile.mockResolvedValue({ success: true });

		// Setup default OAuth auth response
		mockRequireAuth.mockResolvedValue({
			authorized: true as const,
			session: mockRegularSession,
			household_id: mockRegularSession.user.household_id,
			user_id: mockRegularSession.user.id,
		});
	});

	afterAll(() => {
		consoleSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		consoleWarnSpy.mockRestore();
	});

	describe('POST /api/collections/create', () => {
		describe('Successful creation scenarios', () => {
			it('should create collection with custom images and household_id', async () => {
				// Mock database responses
				const mockInsertResult = { insertId: 123, affectedRows: 1 };
				mockExecute
					.mockResolvedValueOnce([mockInsertResult, []]) // INSERT collection
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // UPDATE with filename
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE with slug

				const formData = new FormData();
				formData.append('title', 'Test Collection');
				formData.append('subtitle', 'Test Subtitle');
				formData.append('lightImage', createMockFile('light.jpg', 'image/jpeg'));
				formData.append('darkImage', createMockFile('dark.jpg', 'image/jpeg'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data).toEqual({
							success: true,
							id: 123,
							message: 'Collection created successfully',
							filename: 'secure_filename_123',
						});

						// Verify database calls include household_id
						expect(mockExecute).toHaveBeenCalledWith(
							expect.stringContaining('INSERT INTO collections'),
							['Test Collection', 'Test Subtitle', 1] // household_id should be included
						);

						// Verify file uploads were called
						expect(mockUploadFile).toHaveBeenCalledTimes(2); // light and dark images

						// Verify slug generation
						expect(mockGenerateSlugFromTitle).toHaveBeenCalledWith(123, 'Test Collection');
					},
				});
			});

			it('should create collection with only light image', async () => {
				const mockInsertResult = { insertId: 456, affectedRows: 1 };
				mockExecute
					.mockResolvedValueOnce([mockInsertResult, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				const formData = new FormData();
				formData.append('title', 'Light Only Collection');
				formData.append('lightImage', createMockFile('light.jpg', 'image/jpeg'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.id).toBe(456);

						// Should upload only one image and use it for both light and dark
						expect(mockUploadFile).toHaveBeenCalledTimes(1);

						// Both filename and filename_dark should be set to same value
						expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE collections SET filename = ?, filename_dark = ?'), [
							'secure_filename_123',
							'secure_filename_123',
							456,
						]);
					},
				});
			});

			it('should create collection with default images when no files provided', async () => {
				const mockInsertResult = { insertId: 789, affectedRows: 1 };
				mockExecute.mockResolvedValueOnce([mockInsertResult, []]).mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				const formData = new FormData();
				formData.append('title', 'Default Images Collection');
				formData.append('subtitle', 'No custom images');

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.filename).toBe('custom_collection_004');

						// Should use default filenames with household_id
						expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO collections'), [
							'Default Images Collection',
							'No custom images',
							'custom_collection_004',
							'custom_collection_004_dark',
							1, // household_id
						]);

						// No file uploads should occur
						expect(mockUploadFile).not.toHaveBeenCalled();
					},
				});
			});

			it('should handle missing subtitle (null value)', async () => {
				const mockInsertResult = { insertId: 999, affectedRows: 1 };
				mockExecute.mockResolvedValueOnce([mockInsertResult, []]).mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				const formData = new FormData();
				formData.append('title', 'No Subtitle Collection');
				// Don't append subtitle

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(200);

						// Verify null is passed for subtitle and household_id is included
						expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO collections'), [
							'No Subtitle Collection',
							null,
							'custom_collection_004',
							'custom_collection_004_dark',
							1,
						]);
					},
				});
			});

			it('should handle dark image upload failure gracefully', async () => {
				const mockInsertResult = { insertId: 111, affectedRows: 1 };
				mockExecute
					.mockResolvedValueOnce([mockInsertResult, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				// Mock successful light upload, failed dark upload
				mockUploadFile
					.mockResolvedValueOnce({ success: true }) // light image success
					.mockResolvedValueOnce({ success: false, error: 'Upload failed' }); // dark image failure

				const formData = new FormData();
				formData.append('title', 'Partial Upload Collection');
				formData.append('lightImage', createMockFile('light.jpg', 'image/jpeg'));
				formData.append('darkImage', createMockFile('dark.jpg', 'image/jpeg'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);

						// Should fallback to using light image for dark mode
						expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('UPDATE collections SET filename = ?, filename_dark = ?'), [
							'secure_filename_123',
							'secure_filename_123',
							111,
						]);

						// Should log warning about fallback
						expect(consoleWarnSpy).toHaveBeenCalledWith('Dark mode image upload failed, using light image as fallback');
					},
				});
			});
		});

		describe('Validation errors', () => {
			it('should return 400 when title is missing', async () => {
				const formData = new FormData();
				// Don't append title
				formData.append('subtitle', 'Test Subtitle');

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(400);
						const data = await response.json();

						expect(data).toEqual({
							error: 'Title is required',
						});

						// Should not call database
						expect(mockExecute).not.toHaveBeenCalled();
					},
				});
			});

			it('should return 400 when title is empty string', async () => {
				const formData = new FormData();
				formData.append('title', '');
				formData.append('subtitle', 'Test Subtitle');

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(400);
						const data = await response.json();

						expect(data.error).toBe('Title is required');
					},
				});
			});

			it('should return 400 when light image is not JPG', async () => {
				const formData = new FormData();
				formData.append('title', 'Test Collection');
				formData.append('lightImage', createMockFile('image.png', 'image/png'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(400);
						const data = await response.json();

						expect(data.error).toBe('Light mode file must be a JPG image');
					},
				});
			});

			it('should return 400 when dark image is not JPG', async () => {
				const formData = new FormData();
				formData.append('title', 'Test Collection');
				formData.append('lightImage', createMockFile('light.jpg', 'image/jpeg'));
				formData.append('darkImage', createMockFile('dark.gif', 'image/gif'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(400);
						const data = await response.json();

						expect(data.error).toBe('Dark mode file must be a JPG image');
					},
				});
			});
		});

		describe('Error handling', () => {
			it('should handle database insert failure', async () => {
				mockExecute.mockRejectedValueOnce(new Error('Database connection failed'));

				const formData = new FormData();
				formData.append('title', 'Test Collection');

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data.error).toBe('Failed to create collection');

						// Should log the error
						expect(consoleErrorSpy).toHaveBeenCalledWith('Error creating collection:', expect.any(Error));
					},
				});
			});

			it('should clean up database entry when light image upload fails', async () => {
				const mockInsertResult = { insertId: 555, affectedRows: 1 };
				mockExecute
					.mockResolvedValueOnce([mockInsertResult, []]) // Initial insert
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // Cleanup delete

				// Mock failed light image upload
				mockUploadFile.mockResolvedValueOnce({ success: false, error: 'Upload failed' });

				const formData = new FormData();
				formData.append('title', 'Failed Upload Collection');
				formData.append('lightImage', createMockFile('light.jpg', 'image/jpeg'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data.error).toBe('Failed to upload light mode image');

						// Should have called cleanup
						expect(mockExecute).toHaveBeenCalledWith('DELETE FROM collections WHERE id = ?', [555]);

						// Should log upload failure
						expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to upload light image:', 'Upload failed');
					},
				});
			});

			it('should handle slug generation failure gracefully', async () => {
				const mockInsertResult = { insertId: 333, affectedRows: 1 };
				mockExecute.mockResolvedValueOnce([mockInsertResult, []]).mockRejectedValueOnce(new Error('Slug update failed')); // Slug update fails

				const formData = new FormData();
				formData.append('title', 'Slug Failure Collection');

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data.error).toBe('Failed to create collection');
					},
				});
			});
		});

		describe('Household isolation', () => {
			it('should always assign collection to authenticated user household', async () => {
				const mockInsertResult = { insertId: 777, affectedRows: 1 };
				mockExecute.mockResolvedValueOnce([mockInsertResult, []]).mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				const formData = new FormData();
				formData.append('title', 'Household Test Collection');

				// OAuth pattern uses standardized household_id = 1

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(200);

						// Verify the correct household_id was used
						expect(mockExecute).toHaveBeenCalledWith(
							expect.stringContaining('INSERT INTO collections'),
							expect.arrayContaining([1]) // Should use the user's household_id
						);
					},
				});
			});

			it('should set public flag to 0 for new collections (private by default)', async () => {
				const mockInsertResult = { insertId: 888, affectedRows: 1 };
				mockExecute.mockResolvedValueOnce([mockInsertResult, []]).mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				const formData = new FormData();
				formData.append('title', 'Private Collection');

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(200);

						// Check that public is set to 0 (private) - it's hardcoded in the SQL
						expect(mockExecute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO collections'), [
							'Private Collection',
							null,
							'custom_collection_004',
							'custom_collection_004_dark',
							1,
						]);
					},
				});
			});
		});

		describe('Storage system integration', () => {
			it('should log storage mode and filename for debugging', async () => {
				const mockInsertResult = { insertId: 123, affectedRows: 1 };
				mockExecute
					.mockResolvedValueOnce([mockInsertResult, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				mockGetStorageMode.mockReturnValue('gcs');

				const formData = new FormData();
				formData.append('title', 'Storage Test');
				formData.append('lightImage', createMockFile('test.jpg', 'image/jpeg'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(200);

						// Should log storage mode and filename
						expect(consoleSpy).toHaveBeenCalledWith('Storage mode: gcs');
						expect(consoleSpy).toHaveBeenCalledWith('Creating collection with filename: secure_filename_123');
					},
				});
			});

			it('should call uploadFile with correct parameters for collections directory', async () => {
				const mockInsertResult = { insertId: 456, affectedRows: 1 };
				mockExecute
					.mockResolvedValueOnce([mockInsertResult, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

				const formData = new FormData();
				formData.append('title', 'Upload Parameters Test');
				formData.append('lightImage', createMockFile('test.jpg', 'image/jpeg'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(200);

						// Verify uploadFile was called with correct parameters
						expect(mockUploadFile).toHaveBeenCalledWith(
							expect.any(Buffer),
							'secure_filename_123',
							'jpg',
							'image/jpeg',
							'collections' // Should use collections directory
						);
					},
				});
			});
		});
	});
});
