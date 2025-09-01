/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { getServerSession } from 'next-auth';
import { setupConsoleMocks } from '@/lib/test-utils';

// Mock next-auth
jest.mock('next-auth');

// Mock database pool
jest.mock('@/lib/db', () => ({
	execute: jest.fn(),
}));

// Mock the storage module
jest.mock('@/lib/storage', () => ({
	deleteFile: jest.fn(),
}));

// Import after mocking
import { deleteFile } from '@/lib/storage';

// Get mocked functions
const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockPool = jest.mocked(jest.requireMock('@/lib/db'));
const mockDeleteFile = deleteFile as jest.MockedFunction<typeof deleteFile>;

describe('/api/admin/delete-orphaned', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();

		// Default mock implementations
		mockPool.execute = jest.fn().mockResolvedValue([{ affectedRows: 1 }]);
		mockDeleteFile.mockResolvedValue(true);
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('DELETE /api/admin/delete-orphaned', () => {
		describe('Authentication & Authorization Tests', () => {
			it('returns 401 for unauthenticated users', async () => {
				mockGetServerSession.mockResolvedValue(null);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							body: JSON.stringify({
								type: 'collection-file',
								filename: 'test.jpg',
							}),
						});
						const json = await response.json();

						expect(response.status).toBe(401);
						expect(json).toEqual({ error: 'Unauthorized' });
						expect(mockDeleteFile).not.toHaveBeenCalled();
						expect(mockPool.execute).not.toHaveBeenCalled();
					},
				});
			});

			it('returns 401 for non-admin users', async () => {
				mockGetServerSession.mockResolvedValue({
					user: { id: '1', is_admin: false },
				});

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							body: JSON.stringify({
								type: 'ingredient',
								id: 123,
							}),
						});
						const json = await response.json();

						expect(response.status).toBe(401);
						expect(json).toEqual({ error: 'Unauthorized' });
						expect(mockPool.execute).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Successful deletion operations', () => {
			beforeEach(() => {
				mockGetServerSession.mockResolvedValue({
					user: { id: '1', is_admin: true },
				});
			});

			describe('File deletions', () => {
				it('deletes collection file successfully', async () => {
					await testApiHandler({
						appHandler,
						test: async ({ fetch }) => {
							const response = await fetch({
								method: 'DELETE',
								body: JSON.stringify({
									type: 'collection-file',
									filename: 'test-collection.jpg',
								}),
							});
							const json = await response.json();

							expect(response.status).toBe(200);
							expect(json).toEqual({
								success: true,
								message: 'Collection file deleted',
							});

							// Should call deleteFile with correct parameters
							expect(mockDeleteFile).toHaveBeenCalledWith('test-collection', 'jpg', 'collections');
						},
					});
				});

				it('deletes recipe image successfully', async () => {
					await testApiHandler({
						appHandler,
						test: async ({ fetch }) => {
							const response = await fetch({
								method: 'DELETE',
								body: JSON.stringify({
									type: 'recipe-image',
									filename: 'recipe-image.jpg',
								}),
							});
							const json = await response.json();

							expect(response.status).toBe(200);
							expect(json).toEqual({
								success: true,
								message: 'Recipe image deleted',
							});

							// Should call deleteFile with correct parameters
							expect(mockDeleteFile).toHaveBeenCalledWith('recipe-image', 'jpg');
						},
					});
				});

				it('deletes recipe PDF successfully', async () => {
					await testApiHandler({
						appHandler,
						test: async ({ fetch }) => {
							const response = await fetch({
								method: 'DELETE',
								body: JSON.stringify({
									type: 'recipe-pdf',
									filename: 'recipe-document.pdf',
								}),
							});
							const json = await response.json();

							expect(response.status).toBe(200);
							expect(json).toEqual({
								success: true,
								message: 'Recipe PDF deleted',
							});

							// Should call deleteFile with correct parameters
							expect(mockDeleteFile).toHaveBeenCalledWith('recipe-document', 'pdf');
						},
					});
				});
			});

			describe('Database deletions', () => {
				it('deletes orphaned collection from database', async () => {
					mockPool.execute = jest.fn().mockResolvedValue([{ affectedRows: 1 }]);

					await testApiHandler({
						appHandler,
						test: async ({ fetch }) => {
							const response = await fetch({
								method: 'DELETE',
								body: JSON.stringify({
									type: 'collection',
									id: 123,
								}),
							});
							const json = await response.json();

							expect(response.status).toBe(200);
							expect(json).toEqual({
								success: true,
								message: 'Collection deleted',
							});
							expect(mockPool.execute).toHaveBeenCalledWith(
								'DELETE FROM collections WHERE id = ? AND NOT EXISTS (SELECT 1 FROM collection_recipes WHERE collection_id = ?)',
								[123, 123]
							);
						},
					});
				});

				it('deletes orphaned ingredient from database', async () => {
					mockPool.execute = jest.fn().mockResolvedValue([{ affectedRows: 1 }]);

					await testApiHandler({
						appHandler,
						test: async ({ fetch }) => {
							const response = await fetch({
								method: 'DELETE',
								body: JSON.stringify({
									type: 'ingredient',
									id: 456,
								}),
							});
							const json = await response.json();

							expect(response.status).toBe(200);
							expect(json).toEqual({
								success: true,
								message: 'Ingredient deleted',
							});
							expect(mockPool.execute).toHaveBeenCalledWith(
								'DELETE FROM ingredients WHERE id = ? AND NOT EXISTS (SELECT 1 FROM recipe_ingredients WHERE ingredient_id = ?)',
								[456, 456]
							);
						},
					});
				});

				it('deletes orphaned recipe from database', async () => {
					mockPool.execute = jest.fn().mockResolvedValue([{ affectedRows: 1 }]);

					await testApiHandler({
						appHandler,
						test: async ({ fetch }) => {
							const response = await fetch({
								method: 'DELETE',
								body: JSON.stringify({
									type: 'recipe',
									id: 789,
								}),
							});
							const json = await response.json();

							expect(response.status).toBe(200);
							expect(json).toEqual({
								success: true,
								message: 'Recipe deleted',
							});
							expect(mockPool.execute).toHaveBeenCalledWith(
								'DELETE FROM recipes WHERE id = ? AND NOT EXISTS (SELECT 1 FROM collection_recipes WHERE recipe_id = ?) AND NOT EXISTS (SELECT 1 FROM plans WHERE recipe_id = ?)',
								[789, 789, 789]
							);
						},
					});
				});
			});
		});

		describe('Error handling', () => {
			beforeEach(() => {
				mockGetServerSession.mockResolvedValue({
					user: { id: '1', is_admin: true },
				});
			});

			it('returns 400 for invalid type', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							body: JSON.stringify({
								type: 'invalid-type',
								id: 123,
							}),
						});
						const json = await response.json();

						expect(response.status).toBe(400);
						expect(json).toEqual({ error: 'Invalid type' });
					},
				});
			});

			it('returns 500 when file deletion fails', async () => {
				mockDeleteFile.mockResolvedValue(false);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							body: JSON.stringify({
								type: 'collection-file',
								filename: 'test.jpg',
							}),
						});
						const json = await response.json();

						expect(response.status).toBe(500);
						expect(json).toEqual({ error: 'Failed to delete collection file' });
					},
				});
			});

			it('returns 500 when database deletion fails', async () => {
				mockPool.execute = jest.fn().mockRejectedValue(new Error('Database error'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							body: JSON.stringify({
								type: 'ingredient',
								id: 123,
							}),
						});
						const json = await response.json();

						expect(response.status).toBe(500);
						expect(json).toEqual({ error: 'Failed to delete item' });
					},
				});
			});
		});

		describe('Input validation', () => {
			beforeEach(() => {
				mockGetServerSession.mockResolvedValue({
					user: { id: '1', is_admin: true },
				});
			});

			it('should handle missing filename for file deletion', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							body: JSON.stringify({
								type: 'collection-file',
								// filename is missing
							}),
						});
						const json = await response.json();

						expect(response.status).toBe(500);
						expect(json).toEqual({ error: 'Failed to delete item' });
					},
				});
			});

			it('should handle missing id for database deletion', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							body: JSON.stringify({
								type: 'recipe',
								// id is missing
							}),
						});
						const json = await response.json();

						// The route doesn't fail when id is missing, it just passes undefined
						// which may succeed or fail depending on the database
						expect(response.status).toBe(200);
						expect(json).toEqual({ success: true, message: 'Recipe deleted' });
					},
				});
			});

			it('should handle non-numeric id for database deletion', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							body: JSON.stringify({
								type: 'ingredient',
								id: 'not-a-number',
							}),
						});
						await response.json();

						// The database will handle the type conversion or throw an error
						expect(response.status).toBe(200);
						expect(mockPool.execute).toHaveBeenCalledWith(
							'DELETE FROM ingredients WHERE id = ? AND NOT EXISTS (SELECT 1 FROM recipe_ingredients WHERE ingredient_id = ?)',
							['not-a-number', 'not-a-number']
						);
					},
				});
			});
		});
	});
});
