/**
 * @jest-environment node
 */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
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

jest.mock('@/lib/db.js', () => ({
	pool: {
		execute: jest.fn(),
		getConnection: jest.fn(),
		end: jest.fn(),
	},
}));

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

describe('/api/collections/update', () => {
	const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
	const mockCanEditResource = canEditResource as jest.MockedFunction<typeof canEditResource>;
	const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').pool.execute);
	const mockUploadFile = jest.mocked(jest.requireMock('@/lib/storage').uploadFile);
	const mockDeleteFile = jest.mocked(jest.requireMock('@/lib/storage').deleteFile);
	const mockGenerateFilename = jest.mocked(jest.requireMock('@/lib/utils/secureFilename.collections').generateCollectionSecureFilename);
	const mockGenerateSlug = jest.mocked(jest.requireMock('@/lib/utils/urlHelpers').generateSlugFromTitle);

	const mockSession = {
		user: {
			id: 1,
			email: 'test@example.com',
			household_id: 1,
		},
	};

	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(console, 'error').mockImplementation(() => {});
		jest.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
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
				session: mockSession,
				household_id: mockSession.user.household_id,
				user_id: mockSession.user.id,
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
				session: mockSession,
				household_id: mockSession.user.household_id,
				user_id: mockSession.user.id,
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
				session: mockSession,
				household_id: mockSession.user.household_id,
				user_id: mockSession.user.id,
			});
			mockCanEditResource.mockResolvedValue(true);
		});

		it('should return 404 when collection does not exist', async () => {
			mockExecute.mockResolvedValueOnce([[], []]);

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

			mockExecute
				.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []]) // Get current collection
				.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader, []]) // Update query
				.mockResolvedValueOnce([
					[{ ...mockCollection, title: 'New Title', url_slug: '1-new-title' }] as RowDataPacket[],
					[],
				]); // Get updated collection

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

			mockExecute
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

			mockExecute
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
				session: mockSession,
				household_id: mockSession.user.household_id,
				user_id: mockSession.user.id,
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

			mockExecute
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

			mockExecute
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

			mockExecute.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []]);

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

			mockExecute.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []]);

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
				session: mockSession,
				household_id: mockSession.user.household_id,
				user_id: mockSession.user.id,
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

			mockExecute
				.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []])
				.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader, []]); // Update fails

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
});