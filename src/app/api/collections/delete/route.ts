import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader } from 'mysql2';
import { requireAuth } from '@/lib/auth/helpers';
import { canEditResource } from '@/lib/permissions';
import { deleteFile, getStorageMode } from '@/lib/storage';

export async function DELETE(request: NextRequest): Promise<NextResponse> {
	const auth = await requireAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	try {
		const { collectionId } = await request.json();

		// Enhanced validation with proper error responses
		if (collectionId === undefined || collectionId === null || collectionId === '') {
			return NextResponse.json(
				{
					success: false,
					error: 'Collection ID is required',
					code: 'MISSING_FIELD',
					details: 'The collectionId field is required but was not provided',
					field: 'collectionId',
					suggestions: ['Include a collectionId in the request body', 'Ensure the collection ID is a positive integer'],
				},
				{ status: 422 }
			);
		}

		// Handle zero specifically
		if (collectionId === 0) {
			return NextResponse.json(
				{
					success: false,
					error: 'Collection ID must be a positive integer',
					code: 'INVALID_FIELD_VALUE',
					details: 'Collection ID cannot be zero or negative',
					field: 'collectionId',
					providedValue: 0,
					expectedConstraint: 'positive_integer',
					suggestions: ['Provide a valid collection ID greater than 0', 'List your collections to find the correct ID'],
				},
				{ status: 422 }
			);
		}

		const parsedCollectionId = parseInt(collectionId);
		if (isNaN(parsedCollectionId)) {
			return NextResponse.json(
				{
					success: false,
					error: 'Collection ID must be a valid number',
					code: 'INVALID_FIELD_TYPE',
					details: `Expected collectionId to be a number, received "${collectionId}"`,
					field: 'collectionId',
					providedValue: collectionId,
					expectedType: 'number',
					suggestions: ['Provide a numeric collection ID', 'Ensure the ID is a positive integer'],
				},
				{ status: 422 }
			);
		}

		// Additional check for negative values (zero is handled above)
		if (parsedCollectionId < 0) {
			return NextResponse.json(
				{
					success: false,
					error: 'Collection ID must be a positive integer',
					code: 'INVALID_FIELD_VALUE',
					details: 'Collection ID cannot be negative',
					field: 'collectionId',
					providedValue: parsedCollectionId,
					expectedConstraint: 'positive_integer',
					suggestions: ['Provide a valid collection ID greater than 0', 'List your collections to find the correct ID'],
				},
				{ status: 422 }
			);
		}

		// Check if user can delete this collection (household ownership)
		let canEdit;
		try {
			canEdit = await canEditResource(auth.household_id, 'collections', parsedCollectionId);
		} catch (error) {
			console.error('Error checking permissions:', error);
			return NextResponse.json(
				{
					success: false,
					error: 'Unable to verify collection permissions',
					code: 'PERMISSION_CHECK_FAILED',
					details: 'A database error occurred while checking collection ownership',
					troubleshooting: {
						area: 'permission_system',
						operation: 'ownership_validation',
					},
					suggestions: ['Try the operation again in a few moments', 'Contact support if the issue persists'],
				},
				{ status: 500 }
			);
		}

		if (!canEdit) {
			return NextResponse.json(
				{
					success: false,
					error: 'You can only delete collections owned by your household',
					code: 'PERMISSION_DENIED',
					details: `Collection ID ${parsedCollectionId} is not owned by your household`,
					suggestions: ['Verify you own this collection', 'Check with the collection owner for access', 'Use a collection from your household instead'],
				},
				{ status: 403 }
			);
		}

		// First, get the collection to find both filenames for file deletion
		let rows;
		try {
			[rows] = await pool.execute('SELECT filename, filename_dark FROM collections WHERE id = ? AND household_id = ?', [
				parsedCollectionId,
				auth.household_id,
			]);
		} catch (error) {
			console.error('Error retrieving collection:', error);
			return NextResponse.json(
				{
					success: false,
					error: 'Database error occurred while retrieving collection',
					code: 'DATABASE_QUERY_FAILED',
					details: 'Unable to fetch collection information from the database',
					troubleshooting: {
						area: 'database_operations',
						operation: 'collection_lookup',
					},
					suggestions: ['Try the operation again in a few moments', 'Contact support if database issues persist'],
				},
				{ status: 500 }
			);
		}

		const collections = rows as Array<{ filename: string; filename_dark: string }>;
		if (collections.length === 0) {
			return NextResponse.json(
				{
					success: false,
					error: 'Collection not found',
					code: 'COLLECTION_NOT_FOUND',
					details: `Collection ID ${parsedCollectionId} does not exist in your household`,
					resourceType: 'collection',
					resourceId: parsedCollectionId,
					suggestions: [
						'Verify the collection ID is correct',
						'Check that you have access to this collection',
						'List your collections to find the correct ID',
					],
				},
				{ status: 404 }
			);
		}

		const collection = collections[0];
		const { filename, filename_dark } = collection;

		// Check if any recipes are using this collection
		let recipeRows;
		try {
			[recipeRows] = await pool.execute('SELECT COUNT(*) as count FROM collection_recipes WHERE collection_id = ?', [parsedCollectionId]);
		} catch (error) {
			console.error('Error checking recipe dependencies:', error);
			return NextResponse.json(
				{
					success: false,
					error: 'Database error occurred while checking recipe dependencies',
					code: 'DATABASE_QUERY_FAILED',
					details: 'Unable to verify if collection can be safely deleted',
					troubleshooting: {
						area: 'database_operations',
						operation: 'recipe_dependency_check',
					},
					suggestions: ['Try the operation again in a few moments', 'Contact support if database issues persist'],
				},
				{ status: 500 }
			);
		}

		const recipeCount = (recipeRows as Array<{ count: number }>)[0].count;
		if (recipeCount > 0) {
			return NextResponse.json(
				{
					success: false,
					error: 'Cannot delete collection while it contains recipes',
					code: 'COLLECTION_NOT_EMPTY',
					details: `Collection contains ${recipeCount} recipe(s) that must be removed first`,
					conflictingItems: {
						type: 'recipes',
						count: recipeCount,
					},
					suggestions: [
						'Remove all recipes from this collection first',
						'Move recipes to another collection',
						'Delete the individual recipes if no longer needed',
					],
				},
				{ status: 409 }
			);
		}

		// Delete the collection from database (household-scoped)
		let result;
		try {
			[result] = await pool.execute<ResultSetHeader>('DELETE FROM collections WHERE id = ? AND household_id = ?', [parsedCollectionId, auth.household_id]);
		} catch (error) {
			console.error('Error deleting collection from database:', error);
			return NextResponse.json(
				{
					success: false,
					error: 'Database error occurred during collection deletion',
					code: 'DATABASE_OPERATION_FAILED',
					details: 'The collection removal operation could not be completed',
					troubleshooting: {
						area: 'database_operations',
						operation: 'collection_deletion',
					},
					suggestions: ['Try the operation again in a few moments', 'Contact support if the collection appears to still exist'],
				},
				{ status: 500 }
			);
		}

		if (result.affectedRows === 0) {
			return NextResponse.json(
				{
					success: false,
					error: 'Collection not found or could not be deleted',
					code: 'COLLECTION_DELETE_FAILED',
					details: `Collection ID ${parsedCollectionId} was found but the deletion operation did not affect any records`,
					resourceType: 'collection',
					resourceId: parsedCollectionId,
					troubleshooting: {
						area: 'database_operations',
						possibleCause: 'concurrent_deletion_or_permission_change',
					},
					suggestions: [
						'Verify the collection still exists and you have permission to delete it',
						'Try refreshing and attempting the operation again',
						'Check if another user may have deleted this collection',
					],
				},
				{ status: 404 }
			);
		}

		// Delete associated files (but not default images)
		const isDefaultCollection = filename.startsWith('custom_collection_00');
		const storageMode = getStorageMode();

		// Track file deletion results
		const filesDeleted = {
			lightMode: false,
			darkMode: false,
		};
		const warnings: string[] = [];
		let filesSkipped: { reason: string; darkModeFile?: string } | null = null;

		if (!isDefaultCollection) {

			// Helper function to safely delete file using storage module
			const safeDeleteStorageFile = async (filename: string, extension: string, description: string): Promise<boolean> => {
				try {
					const deleted = await deleteFile(filename, extension, 'collections');
					if (deleted) {
						return true;
					} else {
						return false;
					}
				} catch (error) {
					console.warn(`Failed to delete ${description}:`, error);
					// Only add warning once
					if (warnings.length === 0) {
						warnings.push('File deletion encountered errors but collection was removed from database');
					}
					return false;
				}
			};

			// Delete light mode image if it exists and is not a default
			if (!filename.startsWith('custom_collection_00')) {
				filesDeleted.lightMode = await safeDeleteStorageFile(filename, 'jpg', 'light mode image');
			}

			// Delete dark mode image if it exists, is not a default, and is different from light mode
			if (!filename_dark.startsWith('custom_collection_00') && filename_dark !== filename) {
				filesDeleted.darkMode = await safeDeleteStorageFile(filename_dark, 'jpg', 'dark mode image');
			} else if (filename_dark.startsWith('custom_collection_00') && filename_dark !== filename) {
				// Handle mixed case: dark mode is default, but light is not
				filesSkipped = {
					reason: 'Default collection images are preserved',
					darkModeFile: filename_dark,
				};
			}
		} else {
				filesSkipped = {
				reason: 'Default collection images are preserved',
			};
		}

		// Build response data
		const responseData: {
			collection: {
				id: number;
				household: string;
			};
			filesDeleted: {
				lightMode: boolean;
				darkMode: boolean;
			};
			storageMode: string;
			warnings?: string[];
			filesSkipped?: { reason: string; darkModeFile?: string };
		} = {
			collection: {
				id: parsedCollectionId,
				household: auth.household_id?.toString() || 'unknown',
			},
			filesDeleted,
			storageMode,
		};

		// Add warnings if any
		if (warnings.length > 0) {
			responseData.warnings = warnings;
		}

		// Add file skip information if applicable
		if (filesSkipped) {
			responseData.filesSkipped = filesSkipped;
		}

		return NextResponse.json({
			success: true,
			message: 'Collection deleted successfully',
			data: responseData,
		});
	} catch (error) {
		// Handle JSON parsing errors specifically
		if (error instanceof SyntaxError) {
			return NextResponse.json(
				{
					success: false,
					error: 'Invalid request format',
					code: 'INVALID_JSON_PAYLOAD',
					details: 'The request body contains malformed JSON',
					suggestions: [
						'Ensure the request body is valid JSON',
						'Check for missing quotes, commas, or brackets',
						'Verify Content-Type header is application/json',
					],
				},
				{ status: 422 }
			);
		}

		console.error('Error deleting collection:', error);
		return NextResponse.json(
			{
				success: false,
				error: 'An unexpected error occurred while deleting the collection',
				code: 'INTERNAL_SERVER_ERROR',
				details: 'The server encountered an error processing your request',
				troubleshooting: {
					area: 'server_operations',
					operation: 'collection_deletion',
				},
				suggestions: ['Try the operation again in a few moments', 'Contact support if the issue persists'],
			},
			{ status: 500 }
		);
	}
}
