/**
 * @jest-environment node
 */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { createMockFile, setupConsoleMocks, mockRegularSession } from '@/lib/test-utils';
import { requireAuth } from '@/lib/auth/helpers';
import { canEditResource } from '@/lib/permissions';
import { NextResponse } from 'next/server';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Mock all dependencies
jest.mock('@/lib/auth/helpers', () => ({
	requireAuth: jest.fn(),
}));

jest.mock('@/lib/permissions', () => ({
	canEditResource: jest.fn(),
}));

// Mock the database pool - the default export IS the pool object with execute method
jest.mock('@/lib/db.js', () => {
	const mockPool = {
		execute: jest.fn(),
		getConnection: jest.fn(),
		end: jest.fn(),
	};
	return {
		__esModule: true,
		default: mockPool,
	};
});

jest.mock('@/lib/storage', () => ({
	uploadFile: jest.fn(),
	deleteFile: jest.fn(),
}));

jest.mock('@/lib/utils/secureFilename.collections', () => ({
	generateCollectionSecureFilename: jest.fn(),
}));

jest.mock('@/lib/utils/urlHelpers', () => ({
	generateSlugFromTitle: jest.fn(),
}));

jest.mock('@/lib/utils/secureFilename', () => ({
	generateVersionedFilename: jest.fn(),
	extractBaseHash: jest.fn(),
}));

jest.mock('@/lib/utils/secureFilename.server', () => ({
	findAndDeleteHashFiles: jest.fn(),
}));

// Import the mocked functions
import { uploadFile, deleteFile } from '@/lib/storage';
import { generateVersionedFilename, extractBaseHash } from '@/lib/utils/secureFilename';
import { findAndDeleteHashFiles } from '@/lib/utils/secureFilename.server';
import { generateSlugFromTitle } from '@/lib/utils/urlHelpers';
import { generateCollectionSecureFilename } from '@/lib/utils/secureFilename.collections';

// Get the mocked database pool
const mockDatabase = jest.mocked(jest.requireMock('@/lib/db.js').default);

// Get mock functions
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockCanEditResource = canEditResource as jest.MockedFunction<typeof canEditResource>;
const mockUploadFile = uploadFile as jest.MockedFunction<typeof uploadFile>;
const mockDeleteFile = deleteFile as jest.MockedFunction<typeof deleteFile>;
const mockGenerateFilename = generateCollectionSecureFilename as jest.MockedFunction<typeof generateCollectionSecureFilename>;
const mockGenerateSlug = generateSlugFromTitle as jest.MockedFunction<typeof generateSlugFromTitle>;
const mockGenerateVersionedFilename = generateVersionedFilename as jest.MockedFunction<typeof generateVersionedFilename>;
const mockExtractBaseHash = extractBaseHash as jest.MockedFunction<typeof extractBaseHash>;
const mockFindAndDeleteHashFiles = findAndDeleteHashFiles as jest.MockedFunction<typeof findAndDeleteHashFiles>;

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();

describe('/api/collections/update', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();
		
		// Setup default auth response
		mockRequireAuth.mockResolvedValue({
			authorized: true as const,
			session: mockRegularSession,
			household_id: mockRegularSession.user.household_id,
			user_id: mockRegularSession.user.id,
		});
		mockCanEditResource.mockResolvedValue(true);
	});

	afterEach(() => {
		consoleMocks.cleanup();
	});

	afterAll(() => {
		mockConsoleLog.mockRestore();
		mockConsoleError.mockRestore();
		mockConsoleWarn.mockRestore();
	});

	describe('Authentication and Authorization', () => {
		it('should return 401 when user is not authenticated', async () => {
			mockRequireAuth.mockResolvedValueOnce({
				authorized: false as const,
				response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
			});

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('collection_id', '1');
					formData.append('title', 'Test Collection');

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(401);
					expect(data.error).toBe('Unauthorized');
				},
			});
		});

		it('should return 403 when user does not have permission to edit', async () => {
			mockRequireAuth.mockResolvedValueOnce({
				authorized: true as const,
				session: mockRegularSession,
				household_id: mockRegularSession.user.household_id,
				user_id: mockRegularSession.user.id,
			});
			mockCanEditResource.mockResolvedValueOnce(false);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('collection_id', '1');
					formData.append('title', 'Test Collection');

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(403);
					expect(data.error).toBe('Permission denied');
					expect(data.code).toBe('PERMISSION_DENIED');
				},
			});
		});
	});

	describe('Input Validation', () => {
		beforeEach(() => {
			mockRequireAuth.mockResolvedValue({
				authorized: true as const,
				session: mockRegularSession,
				household_id: mockRegularSession.user.household_id,
				user_id: mockRegularSession.user.id,
			});
		});

		it('should return 422 when collection_id is missing', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('title', 'Test Collection');

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(422);
					expect(data.error).toBe('Collection ID is required');
					expect(data.code).toBe('MISSING_FIELD');
				},
			});
		});

		it('should return 422 when title is missing', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('collection_id', '1');

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(422);
					expect(data.error).toBe('Title is required');
					expect(data.code).toBe('MISSING_FIELD');
				},
			});
		});

		it('should return 422 when title is empty string', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('collection_id', '1');
					formData.append('title', '   ');

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(422);
					expect(data.error).toBe('Title is required');
				},
			});
		});

		it('should return 422 when collection_id is not a number', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('collection_id', 'abc');
					formData.append('title', 'Test Collection');

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(422);
					expect(data.error).toBe('Invalid collection ID');
					expect(data.code).toBe('INVALID_FIELD');
				},
			});
		});
	});

	describe('Collection Updates', () => {
		beforeEach(() => {
			mockRequireAuth.mockResolvedValue({
				authorized: true as const,
				session: mockRegularSession,
				household_id: mockRegularSession.user.household_id,
				user_id: mockRegularSession.user.id,
			});
			mockCanEditResource.mockResolvedValue(true);
		});

		it('should return 404 when collection does not exist', async () => {
			mockDatabase.execute.mockResolvedValueOnce([[], []]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('collection_id', '999');
					formData.append('title', 'Test Collection');

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(404);
					expect(data.error).toBe('Collection not found');
					expect(data.code).toBe('NOT_FOUND');
				},
			});
		});

		it('should successfully update title and regenerate slug', async () => {
			const mockCollection = {
				id: 1,
				title: 'Old Title',
				subtitle: 'Old Subtitle',
				filename: 'custom_collection_004.jpg',
				filename_dark: 'custom_collection_004_dark.jpg',
				show_overlay: true,
				url_slug: '1-old-title',
			};

			mockDatabase.execute
				.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []]) // Get current collection
				.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader, []]) // Update query
				.mockResolvedValueOnce([[{ ...mockCollection, title: 'New Title', url_slug: '1-new-title' }] as RowDataPacket[], []]); // Get updated collection

			mockGenerateSlug.mockReturnValue('1-new-title');

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('collection_id', '1');
					formData.append('title', 'New Title');

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(200);
					expect(data.success).toBe(true);
					expect(data.message).toBe('Collection updated successfully');
					expect(data.data.title).toBe('New Title');
					expect(data.data.url_slug).toBe('1-new-title');
					expect(mockGenerateSlug).toHaveBeenCalledWith(1, 'New Title');
				},
			});
		});

		it('should successfully update subtitle', async () => {
			const mockCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: 'Old Subtitle',
				filename: 'custom_collection_004.jpg',
				filename_dark: 'custom_collection_004_dark.jpg',
				show_overlay: true,
				url_slug: '1-test-collection',
			};

			mockDatabase.execute
				.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []])
				.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader, []])
				.mockResolvedValueOnce([[{ ...mockCollection, subtitle: 'New Subtitle' }] as RowDataPacket[], []]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('collection_id', '1');
					formData.append('title', 'Test Collection');
					formData.append('subtitle', 'New Subtitle');

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(200);
					expect(data.success).toBe(true);
					expect(data.data.subtitle).toBe('New Subtitle');
				},
			});
		});

		it('should successfully update show_overlay to false', async () => {
			const mockCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: 'Subtitle',
				filename: 'custom_collection_004.jpg',
				filename_dark: 'custom_collection_004_dark.jpg',
				show_overlay: true,
				url_slug: '1-test-collection',
			};

			mockDatabase.execute
				.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []])
				.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader, []])
				.mockResolvedValueOnce([[{ ...mockCollection, show_overlay: false }] as RowDataPacket[], []]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('collection_id', '1');
					formData.append('title', 'Test Collection');
					formData.append('show_overlay', 'false');

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(200);
					expect(data.success).toBe(true);
					expect(data.data.show_overlay).toBe(false);
				},
			});
		});
	});

	describe('Image Handling', () => {
		beforeEach(() => {
			mockRequireAuth.mockResolvedValue({
				authorized: true as const,
				session: mockRegularSession,
				household_id: mockRegularSession.user.household_id,
				user_id: mockRegularSession.user.id,
			});
			mockCanEditResource.mockResolvedValue(true);
		});

		it('should successfully revert to default images and delete orphaned files', async () => {
			const mockCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: 'Subtitle',
				filename: 'hash123.jpg',
				filename_dark: 'hash456.jpg',
				show_overlay: true,
				url_slug: '1-test-collection',
			};

			mockDatabase.execute
				.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []]) // Get current collection
				.mockResolvedValueOnce([[{ count: 0 }] as RowDataPacket[], []]) // Check orphan for light image
				.mockResolvedValueOnce([[{ count: 0 }] as RowDataPacket[], []]) // Check orphan for dark image
				.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader, []]) // Update query
				.mockResolvedValueOnce([
					[
						{
							...mockCollection,
							filename: 'custom_collection_004',
							filename_dark: 'custom_collection_004_dark',
						},
					] as RowDataPacket[],
					[],
				]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('collection_id', '1');
					formData.append('title', 'Test Collection');
					formData.append('revert_to_default', 'true');

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(200);
					expect(data.data.filename).toBe('custom_collection_004');
					expect(data.data.filename_dark).toBe('custom_collection_004_dark');
					expect(mockDeleteFile).toHaveBeenCalledWith('hash123', 'jpg', 'collections');
					expect(mockDeleteFile).toHaveBeenCalledWith('hash456', 'jpg', 'collections');
				},
			});
		});

		it('should not delete images that are used by other collections', async () => {
			const mockCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: 'Subtitle',
				filename: 'shared_image.jpg',
				filename_dark: 'shared_dark.jpg',
				show_overlay: true,
				url_slug: '1-test-collection',
			};

			mockDatabase.execute
				.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []])
				.mockResolvedValueOnce([[{ count: 2 }] as RowDataPacket[], []]) // Image is used by other collections
				.mockResolvedValueOnce([[{ count: 1 }] as RowDataPacket[], []]) // Dark image is used by other collections
				.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader, []])
				.mockResolvedValueOnce([
					[
						{
							...mockCollection,
							filename: 'custom_collection_004',
							filename_dark: 'custom_collection_004_dark',
						},
					] as RowDataPacket[],
					[],
				]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('collection_id', '1');
					formData.append('title', 'Test Collection');
					formData.append('revert_to_default', 'true');

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					await response.json();
					expect(mockDeleteFile).not.toHaveBeenCalled();
				},
			});
		});

		it('should validate and reject oversized image files', async () => {
			const mockCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: 'Subtitle',
				filename: 'existing.jpg',
				filename_dark: 'existing_dark.jpg',
				show_overlay: true,
				url_slug: '1-test-collection',
			};

			mockDatabase.execute.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					// Create a mock file that's too large (6MB)
					const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });

					const formData = new FormData();
					formData.append('collection_id', '1');
					formData.append('title', 'Test Collection');
					formData.append('light_image', largeFile);

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(422);
					expect(data.error).toBe('Light image file too large');
					expect(data.code).toBe('FILE_TOO_LARGE');
				},
			});
		});

		it('should validate and reject invalid file types', async () => {
			const mockCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: 'Subtitle',
				filename: 'existing.jpg',
				filename_dark: 'existing_dark.jpg',
				show_overlay: true,
				url_slug: '1-test-collection',
			};

			mockDatabase.execute.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const invalidFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });

					const formData = new FormData();
					formData.append('collection_id', '1');
					formData.append('title', 'Test Collection');
					formData.append('light_image', invalidFile);

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(422);
					expect(data.error).toBe('Invalid light image file type');
					expect(data.code).toBe('INVALID_FILE_TYPE');
				},
			});
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			mockRequireAuth.mockResolvedValue({
				authorized: true as const,
				session: mockRegularSession,
				household_id: mockRegularSession.user.household_id,
				user_id: mockRegularSession.user.id,
			});
			mockCanEditResource.mockResolvedValue(true);
		});

		it('should return 500 when database update fails', async () => {
			const mockCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: 'Subtitle',
				filename: 'test.jpg',
				filename_dark: 'test_dark.jpg',
				show_overlay: true,
				url_slug: '1-test-collection',
			};

			mockDatabase.execute.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []]).mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader, []]); // Update fails

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('collection_id', '1');
					formData.append('title', 'Updated Title');

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(500);
					expect(data.error).toBe('Failed to update collection');
					expect(data.code).toBe('UPDATE_FAILED');
				},
			});
		});

		it('should handle unexpected errors gracefully', async () => {
			mockRequireAuth.mockRejectedValueOnce(new Error('Database connection failed'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('collection_id', '1');
					formData.append('title', 'Test Collection');

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(500);
					expect(data.error).toBe('Internal server error');
					expect(data.code).toBe('INTERNAL_ERROR');
				},
			});
		});
	});

	describe('Filename Versioning and Cache Busting', () => {

		it('should generate versioned filename for light image update', async () => {
			const mockCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: 'Subtitle',
				filename: 'abc123.jpg',
				filename_dark: 'abc123_dark.jpg',
				show_overlay: true,
				url_slug: '1-test-collection',
			};

			mockDatabase.execute
				.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []])
				.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader, []])
				.mockResolvedValueOnce([
					[
						{
							...mockCollection,
							filename: 'abc123_v2.jpg',
						},
					] as RowDataPacket[],
					[],
				]);

			mockGenerateVersionedFilename.mockReturnValue('abc123_v2.jpg');
			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/collections/abc123_v2.jpg',
				filename: 'abc123_v2.jpg',
			});

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const imageFile = createMockFile('test.jpg', 'image/jpeg');
					const formData = new FormData();
					formData.append('collection_id', '1');
					formData.append('title', 'Test Collection');
					formData.append('light_image', imageFile);

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(200);
					expect(data.data.filename).toBe('abc123_v2.jpg');
					expect(mockGenerateVersionedFilename).toHaveBeenCalledWith('abc123.jpg', 'jpg');
					expect(mockUploadFile).toHaveBeenCalledWith(
						expect.any(Buffer),
						'abc123_v2',
						'jpg',
						'image/jpeg',
						'collections'
					);
				},
			});
		});

		it('should generate versioned filename for dark image update', async () => {
			const mockCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: 'Subtitle',
				filename: 'abc123.jpg',
				filename_dark: 'abc123_dark.jpg',
				show_overlay: true,
				url_slug: '1-test-collection',
			};

			mockDatabase.execute
				.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []])
				.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader, []])
				.mockResolvedValueOnce([
					[
						{
							...mockCollection,
							filename_dark: 'abc123_dark_v2.jpg',
						},
					] as RowDataPacket[],
					[],
				]);

			mockGenerateVersionedFilename.mockReturnValue('abc123_dark_v2.jpg');
			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/collections/abc123_dark_v2.jpg',
				filename: 'abc123_dark_v2.jpg',
			});

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const imageFile = createMockFile('test.jpg', 'image/jpeg');
					const formData = new FormData();
					formData.append('collection_id', '1');
					formData.append('title', 'Test Collection');
					formData.append('dark_image', imageFile);

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(200);
					expect(data.data.filename_dark).toBe('abc123_dark_v2.jpg');
					expect(mockGenerateVersionedFilename).toHaveBeenCalledWith('abc123_dark.jpg', 'jpg');
					expect(mockUploadFile).toHaveBeenCalledWith(
						expect.any(Buffer),
						'abc123_dark_v2',
						'jpg',
						'image/jpeg',
						'collections'
					);
				},
			});
		});

		it('should clean up old versions when updating image', async () => {
			const mockCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: 'Subtitle',
				filename: 'abc123_v2.jpg',
				filename_dark: 'abc123_dark.jpg',
				show_overlay: true,
				url_slug: '1-test-collection',
			};

			mockDatabase.execute
				.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []])
				.mockResolvedValueOnce([[{ count: 0 }] as RowDataPacket[], []]) // Orphan check
				.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader, []])
				.mockResolvedValueOnce([
					[
						{
							...mockCollection,
							filename: 'abc123_v3.jpg',
						},
					] as RowDataPacket[],
					[],
				]);

			mockExtractBaseHash.mockReturnValue('abc123');
			mockFindAndDeleteHashFiles.mockResolvedValue(['abc123.jpg', 'abc123_v1.jpg', 'abc123_v2.jpg']);
			mockGenerateVersionedFilename.mockReturnValue('abc123_v3.jpg');
			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/collections/abc123_v3.jpg',
				filename: 'abc123_v3.jpg',
			});

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const imageFile = createMockFile('test.jpg', 'image/jpeg');
					const formData = new FormData();
					formData.append('collection_id', '1');
					formData.append('title', 'Test Collection');
					formData.append('light_image', imageFile);

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(200);
					expect(data.data.filename).toBe('abc123_v3.jpg');
					expect(mockExtractBaseHash).toHaveBeenCalledWith('abc123_v2.jpg');
					expect(mockFindAndDeleteHashFiles).toHaveBeenCalledWith('abc123', 'collections');
				},
			});
		});

		it('should handle multiple file formats with versioning', async () => {
			const mockCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: 'Subtitle',
				filename: 'abc123.png',
				filename_dark: 'abc123_dark.webp',
				show_overlay: true,
				url_slug: '1-test-collection',
			};

			mockDatabase.execute
				.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []])
				.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader, []])
				.mockResolvedValueOnce([
					[
						{
							...mockCollection,
							filename: 'abc123_v2.png',
						},
					] as RowDataPacket[],
					[],
				]);

			mockGenerateVersionedFilename.mockReturnValue('abc123_v2.png');
			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/collections/abc123_v2.png',
				filename: 'abc123_v2.png',
			});

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const imageFile = createMockFile('test.png', 'image/png');
					const formData = new FormData();
					formData.append('collection_id', '1');
					formData.append('title', 'Test Collection');
					formData.append('light_image', imageFile);

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(200);
					expect(data.data.filename).toBe('abc123_v2.png');
					expect(mockGenerateVersionedFilename).toHaveBeenCalledWith('abc123.png', 'jpg'); // Note: Currently hardcoded to jpg
					expect(mockUploadFile).toHaveBeenCalledWith(
						expect.any(Buffer),
						'abc123_v2',
						'jpg',
						'image/png',
						'collections'
					);
				},
			});
		});

		it('should not clean up files used by other collections', async () => {
			const mockCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: 'Subtitle',
				filename: 'shared123.jpg',
				filename_dark: 'shared123_dark.jpg',
				show_overlay: true,
				url_slug: '1-test-collection',
			};

			mockDatabase.execute
				.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []])
				.mockResolvedValueOnce([[{ count: 2 }] as RowDataPacket[], []]) // Not orphaned - used by other collections
				.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader, []])
				.mockResolvedValueOnce([
					[
						{
							...mockCollection,
							filename: 'shared123_v2.jpg',
						},
					] as RowDataPacket[],
					[],
				]);

			mockExtractBaseHash.mockReturnValue('shared123');
			mockGenerateVersionedFilename.mockReturnValue('shared123_v2.jpg');
			mockUploadFile.mockResolvedValue({
				success: true,
				url: '/uploads/collections/shared123_v2.jpg',
				filename: 'shared123_v2.jpg',
			});

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const imageFile = createMockFile('test.jpg', 'image/jpeg');
					const formData = new FormData();
					formData.append('collection_id', '1');
					formData.append('title', 'Test Collection');
					formData.append('light_image', imageFile);

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(200);
					expect(data.data.filename).toBe('shared123_v2.jpg');
					expect(mockFindAndDeleteHashFiles).not.toHaveBeenCalled(); // Should not delete shared files
				},
			});
		});

		it('should handle versioning for both light and dark images simultaneously', async () => {
			const mockCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: 'Subtitle',
				filename: 'light_v1.jpg',
				filename_dark: 'dark_v1.jpg',
				show_overlay: true,
				url_slug: '1-test-collection',
			};

			mockDatabase.execute
				.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []])
				.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader, []])
				.mockResolvedValueOnce([
					[
						{
							...mockCollection,
							filename: 'light_v2.jpg',
							filename_dark: 'dark_v2.jpg',
						},
					] as RowDataPacket[],
					[],
				]);

			mockGenerateVersionedFilename
				.mockReturnValueOnce('light_v2.jpg')
				.mockReturnValueOnce('dark_v2.jpg');
			
			mockUploadFile
				.mockResolvedValueOnce({
					success: true,
					url: '/uploads/collections/light_v2.jpg',
					filename: 'light_v2.jpg',
				})
				.mockResolvedValueOnce({
					success: true,
					url: '/uploads/collections/dark_v2.jpg',
					filename: 'dark_v2.jpg',
				});

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const lightFile = createMockFile('light.jpg', 'image/jpeg');
					const darkFile = createMockFile('dark.jpg', 'image/jpeg');
					const formData = new FormData();
					formData.append('collection_id', '1');
					formData.append('title', 'Test Collection');
					formData.append('light_image', lightFile);
					formData.append('dark_image', darkFile);

					const response = await fetch({
						method: 'PUT',
						body: formData,
					});

					const data = await response.json();
					expect(response.status).toBe(200);
					expect(data.data.filename).toBe('light_v2.jpg');
					expect(data.data.filename_dark).toBe('dark_v2.jpg');
					expect(mockGenerateVersionedFilename).toHaveBeenCalledTimes(2);
					expect(mockGenerateVersionedFilename).toHaveBeenCalledWith('light_v1.jpg', 'jpg');
					expect(mockGenerateVersionedFilename).toHaveBeenCalledWith('dark_v1.jpg', 'jpg');
				},
			});
		});
	});
});
