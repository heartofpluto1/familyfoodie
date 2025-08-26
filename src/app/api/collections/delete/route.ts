import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';
import { deleteFile, getStorageMode } from '@/lib/storage';

async function deleteHandler(request: NextRequest) {
	try {
		const { collectionId } = await request.json();

		if (!collectionId) {
			return NextResponse.json({ error: 'Collection ID is required' }, { status: 400 });
		}

		const parsedCollectionId = parseInt(collectionId);
		if (isNaN(parsedCollectionId)) {
			return NextResponse.json({ error: 'Invalid collection ID' }, { status: 400 });
		}

		// First, get the collection to find both filenames for file deletion
		const [rows] = await pool.execute('SELECT filename, filename_dark FROM collections WHERE id = ?', [parsedCollectionId]);

		const collections = rows as Array<{ filename: string; filename_dark: string }>;
		if (collections.length === 0) {
			return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
		}

		const collection = collections[0];
		const { filename, filename_dark } = collection;

		// Check if any recipes are using this collection
		const [recipeRows] = await pool.execute('SELECT COUNT(*) as count FROM collection_recipes WHERE collection_id = ?', [parsedCollectionId]);

		const recipeCount = (recipeRows as Array<{ count: number }>)[0].count;
		if (recipeCount > 0) {
			return NextResponse.json({ error: `Cannot delete collection. ${recipeCount} recipe(s) are still using this collection.` }, { status: 400 });
		}

		// Delete the collection from database
		const [result] = await pool.execute<ResultSetHeader>('DELETE FROM collections WHERE id = ?', [parsedCollectionId]);

		if (result.affectedRows === 0) {
			return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
		}

		// Delete associated files (but not default images)
		const isDefaultCollection = filename.startsWith('custom_collection_00');

		if (!isDefaultCollection) {
			console.log(`Storage mode: ${getStorageMode()}`);
			console.log(`Deleting collection files for filename: ${filename}, filename_dark: ${filename_dark}`);

			// Helper function to safely delete file using storage module
			const safeDeleteStorageFile = async (filename: string, extension: string, description: string) => {
				try {
					const deleted = await deleteFile(filename, extension, 'collections');
					if (deleted) {
						console.log(`Successfully deleted ${description}`);
					} else {
						console.log(`${description} not found, skipping deletion`);
					}
				} catch (error) {
					console.warn(`Failed to delete ${description}:`, error);
				}
			};

			// Delete light mode image if it exists and is not a default
			if (!filename.startsWith('custom_collection_00')) {
				await safeDeleteStorageFile(filename, 'jpg', 'light mode image');
			}

			// Delete dark mode image if it exists, is not a default, and is different from light mode
			if (!filename_dark.startsWith('custom_collection_00') && filename_dark !== filename) {
				await safeDeleteStorageFile(filename_dark, 'jpg', 'dark mode image');
			}
		} else {
			console.log('Skipping file deletion for default collection images');
		}

		return NextResponse.json({
			success: true,
			message: 'Collection deleted successfully',
		});
	} catch (error) {
		console.error('Error deleting collection:', error);
		return NextResponse.json({ error: 'Failed to delete collection' }, { status: 500 });
	}
}

export const DELETE = withAuth(deleteHandler);
