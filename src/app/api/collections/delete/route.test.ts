/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { mockAuthenticatedUser, mockNonAuthenticatedUser, setupConsoleMocks } from '@/lib/test-utils';

// Mock dependencies
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
	getConnection: jest.fn(),
	end: jest.fn(),
}));

jest.mock('@/lib/auth-middleware', () => jest.requireActual('@/lib/test-utils').authMiddlewareMock);

jest.mock('@/lib/permissions', () => ({
	canEditResource: jest.fn(),
}));

jest.mock('@/lib/storage', () => ({
	deleteFile: jest.fn(),
	getStorageMode: jest.fn(),
}));

// Get mocked functions
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);
const mockCanEditResource = jest.mocked(jest.requireMock('@/lib/permissions').canEditResource);
const mockDeleteFile = jest.mocked(jest.requireMock('@/lib/storage').deleteFile);
const mockGetStorageMode = jest.mocked(jest.requireMock('@/lib/storage').getStorageMode);

describe('/api/collections/delete', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();

		// Default mock implementations
		mockGetStorageMode.mockReturnValue('local');
		mockDeleteFile.mockResolvedValue(true);
		mockCanEditResource.mockReset();
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('Authentication Tests', () => {
		it('should return 401 for unauthenticated users', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockNonAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					expect(response.status).toBe(401);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Authentication required',
						code: 'UNAUTHORIZED',
					});

					// Verify no database or permission calls were made
					expect(mockExecute).not.toHaveBeenCalled();
					expect(mockCanEditResource).not.toHaveBeenCalled();
				},
			});
		});

		it('should process request for authenticated users', async () => {
			// Mock user owns the collection
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock collection exists with no recipes
			mockExecute
				.mockResolvedValueOnce([[{ filename: 'custom_123.jpg', filename_dark: 'custom_123_dark.jpg' }], []]) // Collection lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No recipes using collection
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // Successful deletion

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Collection deleted successfully',
						data: {
							collection: {
								id: 1,
								household: expect.any(String),
							},
							filesDeleted: {
								lightMode: true,
								darkMode: true,
							},
							storageMode: 'local',
						},
					});

					// Verify permission check was called with household context
					expect(mockCanEditResource).toHaveBeenCalledWith(
						expect.any(Number), // household_id from auth
						'collections',
						1
					);
				},
			});
		});
	});

	describe('Permission & Authorization Tests', () => {
		it('should return 403 when user does not own collection', async () => {
			// Mock user does NOT own the collection
			mockCanEditResource.mockResolvedValueOnce(false);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					expect(response.status).toBe(403);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'You can only delete collections owned by your household',
						code: 'PERMISSION_DENIED',
						details: 'Collection ID 1 is not owned by your household',
						suggestions: ['Verify you own this collection', 'Check with the collection owner for access', 'Use a collection from your household instead'],
					});

					// Verify permission check was called
					expect(mockCanEditResource).toHaveBeenCalledWith(
						expect.any(Number), // household_id from auth
						'collections',
						1
					);

					// Verify no database operations were performed after permission check
					expect(mockExecute).not.toHaveBeenCalled();
				},
			});
		});

		it('should enforce household scoping in database queries', async () => {
			// Mock user owns the collection
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock collection exists
			mockExecute
				.mockResolvedValueOnce([[{ filename: 'custom_123.jpg', filename_dark: 'custom_123_dark.jpg' }], []]) // Collection lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No recipes using collection
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // Successful deletion

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					expect(response.status).toBe(200);

					// Verify collection lookup includes household_id filter
					expect(mockExecute).toHaveBeenCalledWith('SELECT filename, filename_dark FROM collections WHERE id = ? AND household_id = ?', [
						1,
						expect.any(Number),
					]);

					// Verify deletion includes household_id filter
					expect(mockExecute).toHaveBeenCalledWith('DELETE FROM collections WHERE id = ? AND household_id = ?', [1, expect.any(Number)]);
				},
			});
		});
	});

	describe('Validation Tests', () => {
		it('should return 422 when collection ID is missing', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({}),
					});

					expect(response.status).toBe(422);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Collection ID is required',
						code: 'MISSING_FIELD',
						details: 'The collectionId field is required but was not provided',
						field: 'collectionId',
						suggestions: ['Include a collectionId in the request body', 'Ensure the collection ID is a positive integer'],
					});

					// Verify no database calls were made
					expect(mockExecute).not.toHaveBeenCalled();
					expect(mockCanEditResource).not.toHaveBeenCalled();
				},
			});
		});

		it('should return 422 when collection ID is not a number', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 'not-a-number' }),
					});

					expect(response.status).toBe(422);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Collection ID must be a valid number',
						code: 'INVALID_FIELD_TYPE',
						details: 'Expected collectionId to be a number, received "not-a-number"',
						field: 'collectionId',
						providedValue: 'not-a-number',
						expectedType: 'number',
						suggestions: ['Provide a numeric collection ID', 'Ensure the ID is a positive integer'],
					});

					// Verify no database calls were made
					expect(mockExecute).not.toHaveBeenCalled();
					expect(mockCanEditResource).not.toHaveBeenCalled();
				},
			});
		});

		it('should handle string collection ID by parsing it', async () => {
			// Mock user owns the collection
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock collection exists
			mockExecute
				.mockResolvedValueOnce([[{ filename: 'custom_123.jpg', filename_dark: 'custom_123_dark.jpg' }], []]) // Collection lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No recipes using collection
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // Successful deletion

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: '1' }), // String instead of number
					});

					expect(response.status).toBe(200);

					// Verify parseInt was used correctly in database calls
					expect(mockExecute).toHaveBeenCalledWith(
						expect.any(String),
						[1, expect.any(Number)] // Should be parsed to number
					);
				},
			});
		});

		it('should handle invalid JSON payload', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: 'invalid-json',
					});

					expect(response.status).toBe(422);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Invalid request format',
						code: 'INVALID_JSON_PAYLOAD',
						details: 'The request body contains malformed JSON',
						suggestions: [
							'Ensure the request body is valid JSON',
							'Check for missing quotes, commas, or brackets',
							'Verify Content-Type header is application/json',
						],
					});
				},
			});
		});
	});

	describe('Success Scenarios', () => {
		it('should successfully delete collection with custom images', async () => {
			// Mock user owns the collection
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock collection exists with custom images
			mockExecute
				.mockResolvedValueOnce([[{ filename: 'custom_123.jpg', filename_dark: 'custom_123_dark.jpg' }], []]) // Collection lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No recipes using collection
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // Successful deletion

			// Mock file deletion success
			mockDeleteFile.mockResolvedValue(true);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Collection deleted successfully',
						data: {
							collection: {
								id: 1,
								household: expect.any(String),
							},
							filesDeleted: {
								lightMode: true,
								darkMode: true,
							},
							storageMode: 'local',
						},
					});

					// Verify both light and dark mode files were deleted
					expect(mockDeleteFile).toHaveBeenCalledWith('custom_123.jpg', 'jpg', 'collections');
					expect(mockDeleteFile).toHaveBeenCalledWith('custom_123_dark.jpg', 'jpg', 'collections');

					// Verify storage mode was logged
					expect(consoleMocks.mockConsoleLog).toHaveBeenCalledWith('Storage mode: local');
					expect(consoleMocks.mockConsoleLog).toHaveBeenCalledWith(
						'Deleting collection files for filename: custom_123.jpg, filename_dark: custom_123_dark.jpg'
					);
				},
			});
		});

		it('should successfully delete collection with only light image (same as dark)', async () => {
			// Mock user owns the collection
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock collection exists with same filename for light and dark
			mockExecute
				.mockResolvedValueOnce([[{ filename: 'custom_123.jpg', filename_dark: 'custom_123.jpg' }], []]) // Collection lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No recipes using collection
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // Successful deletion

			// Mock file deletion success
			mockDeleteFile.mockResolvedValue(true);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Collection deleted successfully',
						data: {
							collection: {
								id: 1,
								household: expect.any(String),
							},
							filesDeleted: {
								lightMode: true,
								darkMode: false, // Same file, so only deleted once
							},
							storageMode: 'local',
						},
					});

					// Verify only one file deletion call (since both filenames are the same)
					expect(mockDeleteFile).toHaveBeenCalledWith('custom_123.jpg', 'jpg', 'collections');
					expect(mockDeleteFile).toHaveBeenCalledTimes(1);
				},
			});
		});

		it('should successfully delete collection with default images (skip file deletion)', async () => {
			// Mock user owns the collection
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock collection exists with default images
			mockExecute
				.mockResolvedValueOnce([[{ filename: 'custom_collection_001.jpg', filename_dark: 'custom_collection_001_dark.jpg' }], []]) // Collection lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No recipes using collection
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // Successful deletion

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Collection deleted successfully',
						data: {
							collection: {
								id: 1,
								household: expect.any(String),
							},
							filesDeleted: {
								lightMode: false, // Skipped (default)
								darkMode: false, // Skipped (default)
							},
							storageMode: 'local',
							filesSkipped: {
								reason: 'Default collection images are preserved',
							},
						},
					});

					// Verify no file deletion calls were made for default images
					expect(mockDeleteFile).not.toHaveBeenCalled();

					// Verify appropriate logging
					expect(consoleMocks.mockConsoleLog).toHaveBeenCalledWith('Skipping file deletion for default collection images');
				},
			});
		});

		it('should successfully delete empty collection', async () => {
			// Mock user owns the collection
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock collection exists with no recipes
			mockExecute
				.mockResolvedValueOnce([[{ filename: 'custom_123.jpg', filename_dark: 'custom_123_dark.jpg' }], []]) // Collection lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No recipes using collection
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // Successful deletion

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Collection deleted successfully',
						data: {
							collection: {
								id: 1,
								household: expect.any(String),
							},
							filesDeleted: {
								lightMode: true,
								darkMode: true,
							},
							storageMode: 'local',
						},
					});
				},
			});
		});
	});

	describe('Business Logic Tests', () => {
		it('should return 409 when collection has recipes', async () => {
			// Mock user owns the collection
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock collection exists but has recipes
			mockExecute
				.mockResolvedValueOnce([[{ filename: 'custom_123.jpg', filename_dark: 'custom_123_dark.jpg' }], []]) // Collection lookup
				.mockResolvedValueOnce([[{ count: 3 }], []]); // 3 recipes using collection

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					expect(response.status).toBe(409);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Cannot delete collection while it contains recipes',
						code: 'COLLECTION_NOT_EMPTY',
						details: 'Collection contains 3 recipe(s) that must be removed first',
						conflictingItems: {
							type: 'recipes',
							count: 3,
						},
						suggestions: [
							'Remove all recipes from this collection first',
							'Move recipes to another collection',
							'Delete the individual recipes if no longer needed',
						],
					});

					// Verify no deletion was attempted
					expect(mockExecute).toHaveBeenCalledTimes(2); // Only lookup and recipe count check
				},
			});
		});

		it('should return 404 when collection not found', async () => {
			// Mock user owns the collection
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock collection not found
			mockExecute.mockResolvedValueOnce([[], []]); // Collection lookup returns empty

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 999 }),
					});

					expect(response.status).toBe(404);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Collection not found',
						code: 'COLLECTION_NOT_FOUND',
						details: 'Collection ID 999 does not exist in your household',
						resourceType: 'collection',
						resourceId: 999,
						suggestions: [
							'Verify the collection ID is correct',
							'Check that you have access to this collection',
							'List your collections to find the correct ID',
						],
					});

					// Verify no further database operations
					expect(mockExecute).toHaveBeenCalledTimes(1);
				},
			});
		});

		it('should return 404 when deletion affects zero rows', async () => {
			// Mock user owns the collection
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock collection exists but deletion fails
			mockExecute
				.mockResolvedValueOnce([[{ filename: 'custom_123.jpg', filename_dark: 'custom_123_dark.jpg' }], []]) // Collection lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No recipes using collection
				.mockResolvedValueOnce([{ affectedRows: 0 }, []]); // Deletion affects 0 rows

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					expect(response.status).toBe(404);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Collection not found or could not be deleted',
						code: 'COLLECTION_DELETE_FAILED',
						details: 'Collection ID 1 was found but the deletion operation did not affect any records',
						resourceType: 'collection',
						resourceId: 1,
						troubleshooting: {
							area: 'database_operations',
							possibleCause: 'concurrent_deletion_or_permission_change',
						},
						suggestions: [
							'Verify the collection still exists and you have permission to delete it',
							'Try refreshing and attempting the operation again',
							'Check if another user may have deleted this collection',
						],
					});
				},
			});
		});
	});

	describe('File Storage Tests', () => {
		it('should handle file deletion failure gracefully', async () => {
			// Mock user owns the collection
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock collection exists
			mockExecute
				.mockResolvedValueOnce([[{ filename: 'custom_123.jpg', filename_dark: 'custom_123_dark.jpg' }], []]) // Collection lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No recipes using collection
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // Successful deletion

			// Mock file deletion failure
			mockDeleteFile.mockRejectedValue(new Error('File system error'));

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					// Should still succeed even if file deletion fails
					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Collection deleted successfully',
						data: {
							collection: {
								id: 1,
								household: expect.any(String),
							},
							filesDeleted: {
								lightMode: false, // Failed to delete
								darkMode: false, // Failed to delete
							},
							storageMode: 'local',
							warnings: ['File deletion encountered errors but collection was removed from database'],
						},
					});

					// Verify warning was logged using console.warn
					expect(consoleMocks.mockConsoleWarn).toHaveBeenCalledWith('Failed to delete light mode image:', expect.any(Error));
				},
			});
		});

		it('should handle partial file deletion success', async () => {
			// Mock user owns the collection
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock collection exists
			mockExecute
				.mockResolvedValueOnce([[{ filename: 'custom_123.jpg', filename_dark: 'custom_123_dark.jpg' }], []]) // Collection lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No recipes using collection
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // Successful deletion

			// Mock file deletion - light succeeds, dark fails
			mockDeleteFile
				.mockResolvedValueOnce(true) // Light image success
				.mockResolvedValueOnce(false); // Dark image not found

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Collection deleted successfully',
						data: {
							collection: {
								id: 1,
								household: expect.any(String),
							},
							filesDeleted: {
								lightMode: true, // Success
								darkMode: false, // Not found
							},
							storageMode: 'local',
						},
					});

					// Verify appropriate logging for both scenarios
					expect(consoleMocks.mockConsoleLog).toHaveBeenCalledWith('Successfully deleted light mode image');
					expect(consoleMocks.mockConsoleLog).toHaveBeenCalledWith('dark mode image not found, skipping deletion');
				},
			});
		});

		it('should log storage mode and filenames for debugging', async () => {
			// Mock user owns the collection
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock collection exists
			mockExecute
				.mockResolvedValueOnce([[{ filename: 'custom_123.jpg', filename_dark: 'custom_123_dark.jpg' }], []]) // Collection lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No recipes using collection
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // Successful deletion

			// Mock different storage mode
			mockGetStorageMode.mockReturnValue('gcs');

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					expect(response.status).toBe(200);

					// Verify storage mode and filename logging
					expect(consoleMocks.mockConsoleLog).toHaveBeenCalledWith('Storage mode: gcs');
					expect(consoleMocks.mockConsoleLog).toHaveBeenCalledWith(
						'Deleting collection files for filename: custom_123.jpg, filename_dark: custom_123_dark.jpg'
					);
				},
			});
		});
	});

	describe('Database Error Handling', () => {
		it('should handle permission check database error', async () => {
			// Mock permission check failure
			mockCanEditResource.mockRejectedValue(new Error('Database connection failed'));

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Unable to verify collection permissions',
						code: 'PERMISSION_CHECK_FAILED',
						details: 'A database error occurred while checking collection ownership',
						troubleshooting: {
							area: 'permission_system',
							operation: 'ownership_validation',
						},
						suggestions: ['Try the operation again in a few moments', 'Contact support if the issue persists'],
					});

					// Verify error was logged
					expect(consoleMocks.mockConsoleError).toHaveBeenCalledWith('Error checking permissions:', expect.any(Error));
				},
			});
		});

		it('should handle collection lookup database error', async () => {
			// Mock user owns the collection
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock database error during collection lookup
			mockExecute.mockRejectedValueOnce(new Error('Database query failed'));

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Database error occurred while retrieving collection',
						code: 'DATABASE_QUERY_FAILED',
						details: 'Unable to fetch collection information from the database',
						troubleshooting: {
							area: 'database_operations',
							operation: 'collection_lookup',
						},
						suggestions: ['Try the operation again in a few moments', 'Contact support if database issues persist'],
					});

					// Verify error was logged
					expect(consoleMocks.mockConsoleError).toHaveBeenCalledWith('Error retrieving collection:', expect.any(Error));
				},
			});
		});

		it('should handle recipe count check database error', async () => {
			// Mock user owns the collection
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock collection exists but recipe count check fails
			mockExecute
				.mockResolvedValueOnce([[{ filename: 'custom_123.jpg', filename_dark: 'custom_123_dark.jpg' }], []]) // Collection lookup
				.mockRejectedValueOnce(new Error('Recipe count query failed')); // Recipe count check fails

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Database error occurred while checking recipe dependencies',
						code: 'DATABASE_QUERY_FAILED',
						details: 'Unable to verify if collection can be safely deleted',
						troubleshooting: {
							area: 'database_operations',
							operation: 'recipe_dependency_check',
						},
						suggestions: ['Try the operation again in a few moments', 'Contact support if database issues persist'],
					});

					// Verify error was logged
					expect(consoleMocks.mockConsoleError).toHaveBeenCalledWith('Error checking recipe dependencies:', expect.any(Error));
				},
			});
		});

		it('should handle deletion database error', async () => {
			// Mock user owns the collection
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock collection exists but deletion fails
			mockExecute
				.mockResolvedValueOnce([[{ filename: 'custom_123.jpg', filename_dark: 'custom_123_dark.jpg' }], []]) // Collection lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No recipes using collection
				.mockRejectedValueOnce(new Error('Deletion query failed')); // Deletion fails

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Database error occurred during collection deletion',
						code: 'DATABASE_OPERATION_FAILED',
						details: 'The collection removal operation could not be completed',
						troubleshooting: {
							area: 'database_operations',
							operation: 'collection_deletion',
						},
						suggestions: ['Try the operation again in a few moments', 'Contact support if the collection appears to still exist'],
					});

					// Verify error was logged
					expect(consoleMocks.mockConsoleError).toHaveBeenCalledWith('Error deleting collection from database:', expect.any(Error));
				},
			});
		});
	});

	describe('Edge Cases', () => {
		it('should handle mixed success (database success but file deletion partial failure)', async () => {
			// Mock user owns the collection
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock collection exists
			mockExecute
				.mockResolvedValueOnce([[{ filename: 'custom_123.jpg', filename_dark: 'custom_123_dark.jpg' }], []]) // Collection lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No recipes using collection
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // Successful deletion

			// Mock file deletion - one succeeds, one throws error
			mockDeleteFile
				.mockResolvedValueOnce(true) // Light image success
				.mockRejectedValueOnce(new Error('Permission denied')); // Dark image fails

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					// Should still return success since database operation succeeded
					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Collection deleted successfully',
						data: {
							collection: {
								id: 1,
								household: expect.any(String),
							},
							filesDeleted: {
								lightMode: true, // Success
								darkMode: false, // Failed due to error
							},
							storageMode: 'local',
							warnings: ['File deletion encountered errors but collection was removed from database'],
						},
					});

					// Verify both deletion attempts were made and appropriate logging occurred
					expect(mockDeleteFile).toHaveBeenCalledTimes(2);
					expect(consoleMocks.mockConsoleLog).toHaveBeenCalledWith('Successfully deleted light mode image');
				},
			});
		});

		it('should handle collection with mixed default and custom filenames', async () => {
			// Mock user owns the collection
			mockCanEditResource.mockResolvedValueOnce(true);

			// Mock collection with light mode custom and dark mode default
			mockExecute
				.mockResolvedValueOnce([[{ filename: 'custom_light_123.jpg', filename_dark: 'custom_collection_001.jpg' }], []]) // Collection lookup
				.mockResolvedValueOnce([[{ count: 0 }], []]) // No recipes using collection
				.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // Successful deletion

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 1 }),
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data).toEqual({
						success: true,
						message: 'Collection deleted successfully',
						data: {
							collection: {
								id: 1,
								household: expect.any(String),
							},
							filesDeleted: {
								lightMode: true, // Custom file deleted
								darkMode: false, // Default file preserved
							},
							storageMode: 'local',
							filesSkipped: {
								reason: 'Default collection images are preserved',
								darkModeFile: 'custom_collection_001.jpg',
							},
						},
					});

					// Should delete light mode (custom) but not dark mode (default)
					expect(mockDeleteFile).toHaveBeenCalledWith('custom_light_123.jpg', 'jpg', 'collections');
					expect(mockDeleteFile).toHaveBeenCalledTimes(1);
				},
			});
		});

		it('should handle zero collection ID validation', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'DELETE',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ collectionId: 0 }),
					});

					// collectionId: 0 is falsy, so it fails the initial validation check
					expect(response.status).toBe(422);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Collection ID must be a positive integer',
						code: 'INVALID_FIELD_VALUE',
						details: 'Collection ID cannot be zero or negative',
						field: 'collectionId',
						providedValue: 0,
						expectedConstraint: 'positive_integer',
						suggestions: ['Provide a valid collection ID greater than 0', 'List your collections to find the correct ID'],
					});

					// Should not proceed to permission check
					expect(mockCanEditResource).not.toHaveBeenCalled();
				},
			});
		});
	});
});
