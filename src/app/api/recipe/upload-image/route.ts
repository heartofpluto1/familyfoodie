import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';
import { uploadFile, getStorageMode, deleteFile } from '@/lib/storage';
import { getRecipeImageUrl } from '@/lib/utils/secureFilename';

interface RecipeRow extends RowDataPacket {
	image_filename: string;
	pdf_filename: string;
	name: string;
}

interface UploadResponse {
	success: true;
	message: string;
	filename: string;
	url: string;
	imageUrl: string;
	storageMode: string;
	previousImage?: string;
}

// Helper function to validate file content matches declared MIME type
function validateFileContent(buffer: Buffer, mimeType: string): boolean {
	const firstBytes = buffer.slice(0, 12); // Get first 12 bytes for WebP validation

	switch (mimeType) {
		case 'image/jpeg':
		case 'image/jpg':
			return firstBytes[0] === 0xff && firstBytes[1] === 0xd8;
		case 'image/png':
			return firstBytes[0] === 0x89 && firstBytes[1] === 0x50 && firstBytes[2] === 0x4e && firstBytes[3] === 0x47;
		case 'image/webp':
			// WebP has "RIFF" at start and "WEBP" at bytes 8-11
			return firstBytes.slice(0, 4).toString() === 'RIFF' && firstBytes.slice(8, 12).toString() === 'WEBP';
		default:
			return true;
	}
}

async function postHandler(request: NextRequest) {
	try {
		const formData = await request.formData();
		const file = formData.get('image') as File;
		const recipeId = formData.get('recipeId') as string;

		if (!file || !recipeId) {
			return NextResponse.json({ success: false, error: 'Image file and recipe ID are required' }, { status: 400 });
		}

		// Validate recipe ID format
		const recipeIdNum = parseInt(recipeId);
		if (isNaN(recipeIdNum)) {
			return NextResponse.json({ success: false, error: 'Recipe ID must be a valid number' }, { status: 400 });
		}

		if (recipeIdNum <= 0) {
			return NextResponse.json({ success: false, error: 'Recipe ID must be a positive number' }, { status: 400 });
		}

		// Validate file type - now supporting JPG, PNG, and WebP
		const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
		if (!allowedTypes.includes(file.type)) {
			return NextResponse.json({ success: false, error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 });
		}

		// Validate file size (configurable, defaults to 5MB)
		const maxSize = parseInt(process.env.MAX_IMAGE_UPLOAD_SIZE || '5242880'); // 5MB default
		if (file.size > maxSize) {
			return NextResponse.json({ success: false, error: 'File size must be less than 5MB' }, { status: 400 });
		}

		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);

		// Validate file content matches declared MIME type
		if (!validateFileContent(buffer, file.type)) {
			return NextResponse.json({ success: false, error: 'File content does not match declared MIME type' }, { status: 400 });
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
		const [recipeRows] = await pool.execute<RecipeRow[]>('SELECT image_filename, pdf_filename FROM recipes WHERE id = ?', [recipeIdNum]);

		if (recipeRows.length === 0) {
			return NextResponse.json({ success: false, error: 'Recipe not found' }, { status: 404 });
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
					success: false,
					error: uploadResult.error || 'File upload failed',
				},
				{ status: 500 }
			);
		}

		// Update the database with complete filename including extension
		if (!currentImageFilename) {
			const [updateResult] = await pool.execute<ResultSetHeader>('UPDATE recipes SET image_filename = ? WHERE id = ?', [uploadFilename, recipeIdNum]);

			if (updateResult.affectedRows === 0) {
				// Cleanup uploaded file since database update failed
				const extension = getExtension(file.type);
				const baseFilename = uploadFilename.includes('.') ? uploadFilename.split('.')[0] : uploadFilename;
				try {
					await deleteFile(baseFilename, extension);
				} catch (cleanupError) {
					console.warn('Failed to cleanup uploaded file:', cleanupError);
				}

				return NextResponse.json({ success: false, error: 'Failed to update recipe image filename' }, { status: 500 });
			}

			console.log(`Set database image_filename to ${uploadFilename} for new recipe`);
		}

		// Generate URL for immediate display
		const imageUrl = getRecipeImageUrl(uploadFilename);

		// Determine if this was a replacement or new upload
		const isReplacement = !!currentImageFilename;
		const message = isReplacement ? 'Image replaced successfully' : 'Image uploaded successfully';

		const response: UploadResponse = {
			success: true,
			message,
			filename: uploadFilename,
			url: uploadResult.url!,
			imageUrl,
			storageMode: getStorageMode(),
			...(isReplacement && { previousImage: currentImageFilename }),
		};

		return NextResponse.json(response);
	} catch (error) {
		console.error('Error uploading image:', error);
		return NextResponse.json({ success: false, error: 'Failed to upload image' }, { status: 500 });
	}
}

export const POST = withAuth(postHandler);
