import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import path from 'path';
import pool from '@/lib/db.js';
import { ResultSetHeader } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';

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

		// First, get the collection to find the filename for file deletion
		const [rows] = await pool.execute('SELECT filename FROM collections WHERE id = ?', [parsedCollectionId]);

		const collections = rows as Array<{ filename: string }>;
		if (collections.length === 0) {
			return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
		}

		const collection = collections[0];
		const filename = collection.filename;

		// Check if any recipes are using this collection
		const [recipeRows] = await pool.execute('SELECT COUNT(*) as count FROM recipes WHERE collection_id = ?', [parsedCollectionId]);

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
		if (filename !== 'custom_collection_004') {
			const collectionsDir = path.join(process.cwd(), 'public', 'collections');

			try {
				// Delete light mode image
				const lightImagePath = path.join(collectionsDir, `${filename}.jpg`);
				await unlink(lightImagePath);
			} catch (error) {
				console.warn('Failed to delete light mode image:', error);
			}

			try {
				// Delete dark mode image
				const darkImagePath = path.join(collectionsDir, `${filename}_dark.jpg`);
				await unlink(darkImagePath);
			} catch (error) {
				console.warn('Failed to delete dark mode image:', error);
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
