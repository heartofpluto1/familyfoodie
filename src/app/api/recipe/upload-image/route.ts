import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';
import { uploadFile, getStorageMode } from '@/lib/storage';
import { getRecipeImageUrl } from '@/lib/utils/secureFilename';

interface RecipeRow extends RowDataPacket {
	image_filename: string;
	pdf_filename: string;
	name: string;
}

async function postHandler(request: NextRequest) {
	try {
		const formData = await request.formData();
		const file = formData.get('image') as File;
		const recipeId = formData.get('recipeId') as string;

		if (!file || !recipeId) {
			return NextResponse.json({ error: 'Image file and recipe ID are required' }, { status: 400 });
		}

		// Validate file type - now supporting JPG, PNG, and WebP
		const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
		if (!allowedTypes.includes(file.type)) {
			return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 });
		}

		// Validate file size (5MB max)
		const maxSize = 5 * 1024 * 1024; // 5MB
		if (file.size > maxSize) {
			return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
		}

		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);

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

		// Generate filename with extension for initial upload
		const uploadFilename = currentImageFilename || `recipe_${recipeId}_${Date.now()}.${extension}`;

		console.log(`Storage mode: ${getStorageMode()}`);
		console.log(`Uploading image with filename: ${uploadFilename}`);

		// Upload the file using the complete filename (no separate extension parameter needed)
		const baseFilename = uploadFilename.includes('.') ? uploadFilename.split('.')[0] : uploadFilename;
		const uploadResult = await uploadFile(buffer, baseFilename, extension, file.type);

		if (!uploadResult.success) {
			return NextResponse.json(
				{
					error: uploadResult.error || 'File upload failed',
				},
				{ status: 500 }
			);
		}

		// Update the database with complete filename including extension
		if (!currentImageFilename) {
			const [updateResult] = await pool.execute<ResultSetHeader>('UPDATE recipes SET image_filename = ? WHERE id = ?', [uploadFilename, parseInt(recipeId)]);

			if (updateResult.affectedRows === 0) {
				return NextResponse.json({ error: 'Failed to update recipe image filename' }, { status: 500 });
			}

			console.log(`Set database image_filename to ${uploadFilename} for new recipe`);
		}

		// Generate URL for immediate display
		const imageUrl = getRecipeImageUrl(uploadFilename);

		return NextResponse.json({
			success: true,
			message: 'Image uploaded successfully',
			filename: uploadFilename,
			url: uploadResult.url,
			imageUrl,
			storageMode: getStorageMode(),
		});
	} catch (error) {
		console.error('Error uploading image:', error);
		return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
	}
}

export const POST = withAuth(postHandler);
