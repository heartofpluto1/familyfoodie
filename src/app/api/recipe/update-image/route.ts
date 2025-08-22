import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';
import { uploadFile, getStorageMode } from '@/lib/storage';
import { getRecipeImageUrl, generateVersionedFilename } from '@/lib/utils/secureFilename';

interface RecipeRow extends RowDataPacket {
	image_filename: string;
	pdf_filename: string;
}

async function updateImageHandler(request: NextRequest) {
	try {
		const formData = await request.formData();
		const file = formData.get('image') as File;
		const recipeId = formData.get('recipeId') as string;

		if (!file || !recipeId) {
			return NextResponse.json({ error: 'Image file and recipe ID are required' }, { status: 400 });
		}

		// Validate file type - now supporting JPG, PNG, and WebP
		const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
		if (!validTypes.includes(file.type)) {
			return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 });
		}

		// Validate file size (5MB max)
		const maxSize = 5 * 1024 * 1024; // 5MB
		if (file.size > maxSize) {
			return NextResponse.json({ error: 'Image size must be less than 5MB' }, { status: 400 });
		}

		// Get file extension from MIME type
		const getExtension = (mimeType: string) => {
			switch (mimeType) {
				case 'image/jpeg':
				case 'image/jpg':
					return 'jpg';
				case 'image/png':
					return 'png';
				case 'image/webp':
					return 'webp';
				default:
					return 'jpg';
			}
		};

		// Get the current image filename from the database
		const [recipeRows] = await pool.execute<RecipeRow[]>('SELECT image_filename, pdf_filename FROM recipes WHERE id = ?', [parseInt(recipeId)]);

		if (recipeRows.length === 0) {
			return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
		}

		const currentImageFilename = recipeRows[0].image_filename;
		const extension = getExtension(file.type);

		// Generate versioned filename for update (this will increment the version)
		const uploadFilename = generateVersionedFilename(currentImageFilename, extension);

		// Convert file to buffer
		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);

		console.log(`Storage mode: ${getStorageMode()}`);
		console.log(`Updating image from ${currentImageFilename} to ${uploadFilename}`);

		// Upload the versioned image
		const baseFilename = uploadFilename.includes('.') ? uploadFilename.split('.')[0] : uploadFilename;
		const uploadResult = await uploadFile(buffer, baseFilename, extension, file.type);

		if (!uploadResult.success) {
			return NextResponse.json({ error: uploadResult.error || 'Image upload failed' }, { status: 500 });
		}

		// Update the database with the new versioned filename
		const [updateResult] = await pool.execute<ResultSetHeader>('UPDATE recipes SET image_filename = ? WHERE id = ?', [uploadFilename, parseInt(recipeId)]);

		if (updateResult.affectedRows === 0) {
			return NextResponse.json({ error: 'Failed to update recipe image filename' }, { status: 500 });
		}

		console.log(`Updated database image_filename to ${uploadFilename} for recipe ${recipeId}`);

		// Generate URL for immediate display
		const imageUrl = getRecipeImageUrl(uploadFilename);

		return NextResponse.json({
			success: true,
			message: 'Recipe image updated successfully',
			filename: uploadFilename,
			url: uploadResult.url,
			imageUrl,
			storageMode: getStorageMode(),
		});
	} catch (error) {
		console.error('Error updating recipe image:', error);
		return NextResponse.json({ error: 'Failed to update recipe image' }, { status: 500 });
	}
}

export const POST = withAuth(updateImageHandler);
