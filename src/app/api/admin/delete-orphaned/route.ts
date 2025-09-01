import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import pool from '@/lib/db';
import { deleteFile } from '@/lib/storage';
import fs from 'fs/promises';
import path from 'path';
import { Storage } from '@google-cloud/storage';

// Determine if we should use GCS based on environment
const useGCS = process.env.NODE_ENV === 'production' && !!process.env.GCS_BUCKET_NAME;
const bucketName = process.env.GCS_BUCKET_NAME;

// Initialize Google Cloud Storage only if needed
const storage = useGCS
	? new Storage({
			projectId: process.env.GOOGLE_CLOUD_PROJECT,
		})
	: null;
const bucket = storage && bucketName ? storage.bucket(bucketName) : null;

export async function DELETE(request: NextRequest): Promise<NextResponse> {
	const session = await getServerSession(authOptions);
	if (!session || !session.user?.is_admin) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { type, id, filename } = await request.json();

		switch (type) {
			case 'collection-file':
				// Delete collection file
				if (useGCS && bucket) {
					const file = bucket.file(`collections/${filename}`);
					await file.delete();
				} else {
					const filePath = path.join(process.cwd(), 'public', 'collections', filename);
					await fs.unlink(filePath);
				}
				return NextResponse.json({ success: true, message: 'Collection file deleted' });

			case 'recipe-image':
			case 'recipe-pdf':
				// Delete recipe file
				if (useGCS && bucket) {
					const file = bucket.file(filename);
					await file.delete();
				} else {
					const filePath = path.join(process.cwd(), 'public', 'static', filename);
					await fs.unlink(filePath);
				}
				return NextResponse.json({ success: true, message: `Recipe ${type === 'recipe-image' ? 'image' : 'PDF'} deleted` });

			case 'collection':
				// Delete empty collection from database
				await pool.execute('DELETE FROM collections WHERE id = ? AND NOT EXISTS (SELECT 1 FROM collection_recipes WHERE collection_id = ?)', [id, id]);
				return NextResponse.json({ success: true, message: 'Collection deleted' });

			case 'ingredient':
				// Delete orphaned ingredient from database
				await pool.execute('DELETE FROM ingredients WHERE id = ? AND NOT EXISTS (SELECT 1 FROM recipe_ingredients WHERE ingredient_id = ?)', [id, id]);
				return NextResponse.json({ success: true, message: 'Ingredient deleted' });

			case 'recipe':
				// Delete orphaned recipe from database
				await pool.execute(
					'DELETE FROM recipes WHERE id = ? AND NOT EXISTS (SELECT 1 FROM collection_recipes WHERE recipe_id = ?) AND NOT EXISTS (SELECT 1 FROM plans WHERE recipe_id = ?)',
					[id, id, id]
				);
				return NextResponse.json({ success: true, message: 'Recipe deleted' });

			default:
				return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
		}
	} catch (error) {
		console.error('Error deleting orphaned item:', error);
		return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
	}
}