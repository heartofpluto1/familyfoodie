import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';
import { uploadFile, getStorageMode } from '@/lib/storage';

interface RecipeRow extends RowDataPacket {
	filename: string;
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

		// Validate file type
		const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
		if (!allowedTypes.includes(file.type)) {
			return NextResponse.json({ error: 'Only JPEG, JPG, and PNG images are allowed' }, { status: 400 });
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
				default:
					return 'jpg';
			}
		};

		// Get the current filename from the database
		const [recipeRows] = await pool.execute<RecipeRow[]>('SELECT filename FROM menus_recipe WHERE id = ?', [parseInt(recipeId)]);

		if (recipeRows.length === 0) {
			return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
		}

		const currentFilename = recipeRows[0].filename;
		const extension = getExtension(file.type);

		// Use existing filename or generate a temporary one for new recipes
		const uploadFilename = currentFilename || `temp_${Date.now()}`;

		console.log(`Storage mode: ${getStorageMode()}`);
		console.log(`Uploading image with filename: ${uploadFilename}`);

		// Upload the file using the current filename
		const uploadResult = await uploadFile(buffer, uploadFilename, extension, file.type);

		if (!uploadResult.success) {
			return NextResponse.json(
				{
					error: uploadResult.error || 'File upload failed',
				},
				{ status: 500 }
			);
		}

		// Update the database with filename if it was newly generated
		if (!currentFilename) {
			const [updateResult] = await pool.execute<ResultSetHeader>('UPDATE menus_recipe SET filename = ? WHERE id = ?', [uploadFilename, parseInt(recipeId)]);

			if (updateResult.affectedRows === 0) {
				return NextResponse.json({ error: 'Failed to update recipe filename' }, { status: 500 });
			}

			console.log(`Set database filename to ${uploadFilename} for new recipe`);
		}

		return NextResponse.json({
			success: true,
			message: 'Image uploaded successfully',
			filename: `${uploadFilename}.${extension}`,
			url: uploadResult.url,
			storageMode: getStorageMode(),
		});
	} catch (error) {
		console.error('Error uploading image:', error);
		return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
	}
}

export const POST = withAuth(postHandler);
