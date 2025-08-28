import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { uploadFile, getStorageMode, deleteFile } from '@/lib/storage';
import { getRecipeImageUrl, generateVersionedFilename, extractBaseHash } from '@/lib/utils/secureFilename';
import { findAndDeleteHashFiles } from '@/lib/utils/secureFilename.server';
import { UpdateImageResponse } from '@/types/fileUpload';
import { cascadeCopyWithContext } from '@/lib/copy-on-write';
import { canEditResource } from '@/lib/permissions';

interface RecipeRow extends RowDataPacket {
	image_filename: string;
	pdf_filename: string;
}

interface CollectionAccessRow extends RowDataPacket {
	household_id: number;
	is_public: number;
	subscription_id: number | null;
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

// Helper function to validate file extension matches MIME type
function validateFileExtension(filename: string, mimeType: string): boolean {
	const ext = filename.split('.').pop()?.toLowerCase();
	const getValidExtensions = (mimeType: string) => {
		switch (mimeType) {
			case 'image/jpeg':
			case 'image/jpg':
				return ['jpg', 'jpeg'];
			case 'image/png':
				return ['png'];
			case 'image/webp':
				return ['webp'];
			default:
				return ['jpg', 'jpeg'];
		}
	};
	const validExtensions = getValidExtensions(mimeType);
	return ext ? validExtensions.includes(ext) : false;
}

async function updateImageHandler(request: AuthenticatedRequest) {
	try {
		// Validate storage configuration first
		if (!getStorageMode()) {
			return NextResponse.json({ error: 'Storage configuration error' }, { status: 500 });
		}

		const formData = await request.formData();
		const file = formData.get('image') as File;
		const recipeId = formData.get('recipeId') as string;
		const collectionId = formData.get('collectionId') as string;

		if (!file || !recipeId || !collectionId) {
			return NextResponse.json({ error: 'Image file, recipe ID, and collection ID are required' }, { status: 400 });
		}

		// Validate recipe ID and collection ID format
		const recipeIdNum = parseInt(recipeId);
		const collectionIdNum = parseInt(collectionId);
		if (isNaN(recipeIdNum) || recipeIdNum <= 0) {
			return NextResponse.json({ error: 'Invalid recipe ID format' }, { status: 400 });
		}
		if (isNaN(collectionIdNum) || collectionIdNum <= 0) {
			return NextResponse.json({ error: 'Invalid collection ID format' }, { status: 400 });
		}

		// Validate file is not empty
		if (file.size === 0) {
			return NextResponse.json({ error: 'File cannot be empty' }, { status: 400 });
		}

		// Validate file type - now supporting JPG, PNG, and WebP
		const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
		if (!validTypes.includes(file.type)) {
			return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 });
		}

		// Validate file extension matches MIME type
		if (!validateFileExtension(file.name, file.type)) {
			return NextResponse.json({ error: 'File extension does not match MIME type' }, { status: 400 });
		}

		// Validate file size (5MB max)
		const maxSize = 5 * 1024 * 1024; // 5MB
		if (file.size > maxSize) {
			return NextResponse.json({ error: 'Image size must be less than 5MB' }, { status: 400 });
		}

		// Convert file to buffer for validation
		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);

		// Validate file content matches declared MIME type
		if (!validateFileContent(buffer, file.type)) {
			return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
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
			return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
		}

		// Verify collection access
		const [collectionRows] = await pool.execute<CollectionAccessRow[]>(
			`SELECT 
				c.household_id,
				c.is_public,
				cs.id as subscription_id
			FROM collections c
			LEFT JOIN collection_subscriptions cs 
				ON cs.collection_id = c.id 
				AND cs.household_id = ?
			WHERE c.id = ?`,
			[request.household_id, collectionIdNum]
		);

		if (collectionRows.length === 0) {
			return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
		}

		const collection = collectionRows[0];
		const hasAccess =
			collection.household_id === request.household_id || // Owned
			collection.subscription_id !== null || // Subscribed
			collection.is_public === 1; // Public

		if (!hasAccess) {
			return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
		}

		// Verify recipe is in this collection
		const [recipeCollectionRows] = await pool.execute<RowDataPacket[]>('SELECT 1 FROM collection_recipes WHERE collection_id = ? AND recipe_id = ?', [
			collectionIdNum,
			recipeIdNum,
		]);

		if (recipeCollectionRows.length === 0) {
			return NextResponse.json({ error: 'Recipe not found in collection' }, { status: 404 });
		}

		const currentImageFilename = recipeRows[0].image_filename;
		const extension = getExtension(file.type);

		// Defensive cleanup: remove all old files with the same base hash (only if existing image exists)
		let cleanupSummary = '';
		const baseHash = currentImageFilename ? extractBaseHash(currentImageFilename) : null;

		if (baseHash) {
			try {
				const deletedFiles = await findAndDeleteHashFiles(baseHash, 'image');
				if (deletedFiles.length > 0) {
					cleanupSummary = `Cleaned up ${deletedFiles.length} old file(s): ${deletedFiles.join(', ')}`;
					console.log(cleanupSummary);
				}
			} catch (error) {
				console.warn('File cleanup failed but continuing with upload:', error);
			}
		}

		// Check if we need to trigger copy-on-write
		let targetRecipeId = recipeIdNum;
		let targetCollectionId = collectionIdNum;
		let targetImageFilename = currentImageFilename;
		let wasCopied = false;

		// Check if household can edit this recipe
		const canEdit = await canEditResource(request.household_id!, 'recipes', recipeIdNum);

		if (!canEdit) {
			// Recipe is not owned - trigger copy-on-write
			const copyResult = await cascadeCopyWithContext(request.household_id!, collectionIdNum, recipeIdNum);
			targetRecipeId = copyResult.newRecipeId;
			targetCollectionId = copyResult.newCollectionId;
			wasCopied = true;

			// Get the new recipe's current image filename
			const [newRecipeRows] = await pool.execute<RecipeRow[]>('SELECT image_filename FROM recipes WHERE id = ?', [targetRecipeId]);
			if (newRecipeRows.length > 0) {
				targetImageFilename = newRecipeRows[0].image_filename;
			}
		}

		// Generate versioned filename for update (this will increment the version)
		let uploadFilename = generateVersionedFilename(targetImageFilename, extension);

		console.log(`Storage mode: ${getStorageMode()}`);
		console.log(`Updating image from ${currentImageFilename} to ${uploadFilename}`);

		// Upload the versioned image with retry logic for version conflicts
		let uploadResult;
		let uploadAttempts = 0;
		const maxAttempts = 3;

		do {
			const baseFilename = uploadFilename.includes('.') ? uploadFilename.split('.')[0] : uploadFilename;
			uploadResult = await uploadFile(buffer, baseFilename, extension, file.type);

			if (uploadResult.success) {
				break;
			}

			if (uploadResult.error?.includes('Version conflict') && uploadAttempts < maxAttempts - 1) {
				// Generate new version and retry
				uploadFilename = generateVersionedFilename(currentImageFilename, extension);
				uploadAttempts++;
				console.log(`Version conflict detected, retrying with: ${uploadFilename}`);
			} else {
				break;
			}
		} while (uploadAttempts < maxAttempts);

		if (!uploadResult.success) {
			return NextResponse.json({ error: uploadResult.error || 'Image upload failed' }, { status: 500 });
		}

		// Update the database with the new versioned filename (use target recipe ID which may be the copy)
		const [updateResult] = await pool.execute<ResultSetHeader>('UPDATE recipes SET image_filename = ? WHERE id = ?', [uploadFilename, targetRecipeId]);

		if (updateResult.affectedRows === 0) {
			// Attempt to clean up uploaded file since database update failed
			try {
				const baseFilename = uploadFilename.includes('.') ? uploadFilename.split('.')[0] : uploadFilename;
				await deleteFile(baseFilename, extension);
				console.warn(`Database update failed, cleaning up uploaded file: ${uploadFilename}`);
			} catch (cleanupError) {
				console.warn('Failed to cleanup uploaded file after DB failure:', cleanupError);
			}
			return NextResponse.json({ error: 'Failed to update recipe image filename' }, { status: 500 });
		}

		console.log(`Updated database image_filename to ${uploadFilename} for recipe ${targetRecipeId}`);

		// Generate URL for immediate display
		const imageUrl = getRecipeImageUrl(uploadFilename);

		const response: UpdateImageResponse & { recipeId?: number; collectionId?: number; wasCopied?: boolean } = {
			success: true,
			message: wasCopied ? 'Recipe copied and image updated successfully' : 'Recipe image updated successfully',
			filename: uploadFilename,
			uploadUrl: uploadResult.url!,
			displayUrl: imageUrl,
			storageMode: getStorageMode(),
			cleanup: cleanupSummary || 'No old files to clean up',
			recipeId: targetRecipeId,
			collectionId: targetCollectionId,
			wasCopied,
		};

		return NextResponse.json(response);
	} catch (error) {
		console.error('Error updating recipe image:', error);
		return NextResponse.json({ error: 'Failed to update recipe image' }, { status: 500 });
	}
}

export const POST = withAuth(updateImageHandler);
