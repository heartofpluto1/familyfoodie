import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';
import { uploadFile, getStorageMode } from '@/lib/storage';
import { getRecipeImageUrl } from '@/lib/utils/secureFilename';

interface RecipeRow extends RowDataPacket {
	filename: string;
}

async function updateImageHandler(request: NextRequest) {
	try {
		const formData = await request.formData();
		const file = formData.get('image') as File;
		const recipeId = formData.get('recipeId') as string;

		if (!file || !recipeId) {
			return NextResponse.json({ error: 'Image file and recipe ID are required' }, { status: 400 });
		}

		// Validate file type
		const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
		if (!validTypes.includes(file.type)) {
			return NextResponse.json({ error: 'Only JPG, PNG, and WebP images are allowed' }, { status: 400 });
		}

		// Validate file size (5MB max)
		const maxSize = 5 * 1024 * 1024; // 5MB
		if (file.size > maxSize) {
			return NextResponse.json({ error: 'Image size must be less than 5MB' }, { status: 400 });
		}

		// Get the current filename from the database
		const [recipeRows] = await pool.execute<RecipeRow[]>('SELECT filename FROM recipes WHERE id = ?', [parseInt(recipeId)]);

		if (recipeRows.length === 0) {
			return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
		}

		const currentFilename = recipeRows[0].filename;

		// Use existing filename or generate a temporary one for new recipes
		const uploadFilename = currentFilename || `recipe_${recipeId}_${Date.now()}`;

		// Convert file to buffer
		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);

		console.log(`Storage mode: ${getStorageMode()}`);
		console.log(`Uploading image with filename: ${uploadFilename}`);

		// Upload the image
		const uploadResult = await uploadFile(buffer, uploadFilename, 'image', file.type);

		if (!uploadResult.success) {
			return NextResponse.json({ error: uploadResult.error || 'Image upload failed' }, { status: 500 });
		}

		// Update the database with filename if it was newly generated
		if (!currentFilename) {
			const [updateResult] = await pool.execute<ResultSetHeader>('UPDATE recipes SET filename = ? WHERE id = ?', [uploadFilename, parseInt(recipeId)]);

			if (updateResult.affectedRows === 0) {
				return NextResponse.json({ error: 'Failed to update recipe filename' }, { status: 500 });
			}

			console.log(`Set database filename to ${uploadFilename} for recipe ${recipeId}`);
		}

		// Generate cache-busted URL for immediate display
		const cacheBustedUrl = getRecipeImageUrl(uploadFilename, true);

		return NextResponse.json({
			success: true,
			message: 'Recipe image updated successfully',
			filename: uploadFilename,
			url: uploadResult.url,
			cacheBustedUrl,
			storageMode: getStorageMode(),
		});
	} catch (error) {
		console.error('Error updating recipe image:', error);
		return NextResponse.json({ error: 'Failed to update recipe image' }, { status: 500 });
	}
}

export const POST = withAuth(updateImageHandler);
