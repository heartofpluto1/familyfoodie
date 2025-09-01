/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import { NextResponse } from 'next/server';
import * as appHandler from './route';
import { getServerSession } from 'next-auth';
import { setupConsoleMocks, mockAdminSession } from '@/lib/test-utils';
import pool from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';
import { Storage } from '@google-cloud/storage';

// Mock next-auth
jest.mock('next-auth');

// Mock database pool
jest.mock('@/lib/db', () => ({
	execute: jest.fn(),
}));

// Mock file system
jest.mock('fs/promises');

// Mock Google Cloud Storage
jest.mock('@google-cloud/storage');

// Mock storage helper
jest.mock('@/lib/storage', () => ({
	deleteFile: jest.fn(),
}));

// Type assertions for mocked modules
const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockPool = pool as jest.Mocked<typeof pool>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('/api/admin/delete-orphaned', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;
	let mockFile: any;
	let mockBucket: any;
	let mockStorage: any;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();

		// Setup GCS mocks
		mockFile = {
			delete: jest.fn().mockResolvedValue(undefined),
		};

		mockBucket = {
			file: jest.fn().mockReturnValue(mockFile),
		};

		mockStorage = {
			bucket: jest.fn().mockReturnValue(mockBucket),
		};

		(Storage as jest.Mock).mockImplementation(() => mockStorage);

		// Default mock implementations
		mockPool.execute = jest.fn().mockResolvedValue([{ affectedRows: 1 }]);
		mockFs.unlink = jest.fn().mockResolvedValue(undefined);
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
						expect(mockFs.unlink).not.toHaveBeenCalled();
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

							// In development mode, should use fs.unlink
							if (process.env.NODE_ENV !== 'production') {
								expect(mockFs.unlink).toHaveBeenCalledWith(
									path.join(process.cwd(), 'public', 'collections', 'test-collection.jpg')
								);
							}
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

							// In development mode, should use fs.unlink
							if (process.env.NODE_ENV !== 'production') {
								expect(mockFs.unlink).toHaveBeenCalledWith(
									path.join(process.cwd(), 'public', 'static', 'recipe-image.jpg')
								);
							}
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

							// In development mode, should use fs.unlink
							if (process.env.NODE_ENV !== 'production') {
								expect(mockFs.unlink).toHaveBeenCalledWith(
									path.join(process.cwd(), 'public', 'static', 'recipe-document.pdf')
								);
							}
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
				mockFs.unlink.mockRejectedValue(new Error('File not found'));

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
						expect(json).toEqual({ error: 'Failed to delete item' });
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
						const json = await response.json();

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

		describe('GCS integration tests', () => {
			const originalEnv = process.env.NODE_ENV;
			const originalBucket = process.env.GCS_BUCKET_NAME;

			afterEach(() => {
				process.env.NODE_ENV = originalEnv;
				process.env.GCS_BUCKET_NAME = originalBucket;
			});

			it('uses GCS in production environment', async () => {
				// Set production environment
				process.env.NODE_ENV = 'production';
				process.env.GCS_BUCKET_NAME = 'test-bucket';

				// Need to re-import the module to pick up env changes
				jest.resetModules();
				
				// Re-setup all mocks after reset
				jest.mock('next-auth');
				jest.mock('@/lib/db', () => ({
					execute: jest.fn(),
				}));
				jest.mock('fs/promises');
				jest.mock('@google-cloud/storage');
				jest.mock('@/lib/storage', () => ({
					deleteFile: jest.fn(),
				}));

				// Re-create GCS mocks
				const newMockFile = {
					delete: jest.fn().mockResolvedValue(undefined),
				};
				const newMockBucket = {
					file: jest.fn().mockReturnValue(newMockFile),
				};
				const newMockStorage = {
					bucket: jest.fn().mockReturnValue(newMockBucket),
				};
				const { Storage: NewStorage } = require('@google-cloud/storage');
				NewStorage.mockImplementation(() => newMockStorage);

				const { getServerSession: newGetServerSession } = require('next-auth');
				newGetServerSession.mockResolvedValue({
					user: { id: '1', is_admin: true },
				});
				
				const prodHandler = await import('./route');

				await testApiHandler({
					appHandler: prodHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'DELETE',
							body: JSON.stringify({
								type: 'recipe-pdf',
								filename: 'test.pdf',
							}),
						});
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							success: true,
							message: 'Recipe PDF deleted',
						});
						// Should use GCS bucket file deletion
						expect(newMockBucket.file).toHaveBeenCalledWith('test.pdf');
						expect(newMockFile.delete).toHaveBeenCalled();
					},
				});
			});
		});
	});
});