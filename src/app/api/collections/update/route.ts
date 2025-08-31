import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { canEditResource } from '@/lib/permissions';
import pool from '@/lib/db';
import { uploadFile } from '@/lib/storage';
import { generateSlugFromTitle } from '@/lib/utils/urlHelpers';
import { generateVersionedFilename, extractBaseHash } from '@/lib/utils/secureFilename';
import { findAndDeleteHashFiles } from '@/lib/utils/secureFilename.server';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function validateFileContent(buffer: Buffer, mimeType: string): boolean {
	const signatures: { [key: string]: number[][] } = {
		'image/jpeg': [[0xff, 0xd8, 0xff]],
		'image/jpg': [[0xff, 0xd8, 0xff]],
		'image/png': [[0x89, 0x50, 0x4e, 0x47]],
		'image/webp': [
			[0x52, 0x49, 0x46, 0x46],
			[0x57, 0x45, 0x42, 0x50],
		],
	};

	const bytes = Array.from(buffer.slice(0, 12));
	const validSignatures = signatures[mimeType] || [];

	for (const signature of validSignatures) {
		let isValid = true;
		for (let i = 0; i < signature.length; i++) {
			if (signature[i] !== bytes[i] && (mimeType !== 'image/webp' || i < 4 || i >= 8)) {
				isValid = false;
				break;
			}
		}
		if (isValid) return true;
	}

	return false;
}

function validateFileExtension(filename: string, mimeType: string): boolean {
	const extensionMap: { [key: string]: string[] } = {
		'image/jpeg': ['jpg', 'jpeg'],
		'image/jpg': ['jpg', 'jpeg'],
		'image/png': ['png'],
		'image/webp': ['webp'],
	};

	const ext = filename.split('.').pop()?.toLowerCase();
	const allowedExts = extensionMap[mimeType] || [];
	return allowedExts.includes(ext || '');
}

async function checkImageIsOrphaned(filename: string, collectionId: number): Promise<boolean> {
	const [otherCollections] = await pool.execute<RowDataPacket[]>(
		'SELECT COUNT(*) as count FROM collections WHERE (filename = ? OR filename_dark = ?) AND id != ?',
		[filename, filename, collectionId]
	);

	const count = (otherCollections[0] as { count: number }).count;
	return count === 0;
}

function isDefaultImage(filename: string): boolean {
	return filename.startsWith('custom_collection_00');
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
	try {
		// Authentication
		const auth = await requireAuth();
		if (!auth.authorized) {
			return auth.response;
		}

		// Parse request
		const formData = await request.formData();
		const collectionId = formData.get('collection_id');
		const title = formData.get('title');
		const subtitle = formData.get('subtitle');
		const showOverlay = formData.get('show_overlay');
		const lightImageFile = formData.get('light_image') as File | null;
		const darkImageFile = formData.get('dark_image') as File | null;
		const revertToDefault = formData.get('revert_to_default') === 'true';

		// Validate required fields
		if (!collectionId) {
			return NextResponse.json(
				{
					success: false,
					error: 'Collection ID is required',
					code: 'MISSING_FIELD',
					details: 'The collection_id field is required but was not provided',
					suggestions: ['Include a collection_id in the request body'],
				},
				{ status: 422 }
			);
		}

		if (!title || typeof title !== 'string' || title.trim().length === 0) {
			return NextResponse.json(
				{
					success: false,
					error: 'Title is required',
					code: 'MISSING_FIELD',
					details: 'The title field is required and must not be empty',
					suggestions: ['Provide a valid title for the collection'],
				},
				{ status: 422 }
			);
		}

		const collectionIdNum = parseInt(collectionId as string);
		if (isNaN(collectionIdNum)) {
			return NextResponse.json(
				{
					success: false,
					error: 'Invalid collection ID',
					code: 'INVALID_FIELD',
					details: 'The collection_id must be a valid number',
					suggestions: ['Provide a valid numeric collection ID'],
				},
				{ status: 422 }
			);
		}

		// Check permissions
		const canEdit = await canEditResource(auth.household_id, 'collections', collectionIdNum);
		if (!canEdit) {
			return NextResponse.json(
				{
					success: false,
					error: 'Permission denied',
					code: 'PERMISSION_DENIED',
					details: 'You do not have permission to edit this collection',
					suggestions: ['Ensure you are the owner of the collection'],
				},
				{ status: 403 }
			);
		}

		// Get current collection data
		const [currentCollection] = await pool.execute<RowDataPacket[]>(
			'SELECT id, title, subtitle, filename, filename_dark, show_overlay, url_slug FROM collections WHERE id = ? AND household_id = ?',
			[collectionIdNum, auth.household_id]
		);

		if (currentCollection.length === 0) {
			return NextResponse.json(
				{
					success: false,
					error: 'Collection not found',
					code: 'NOT_FOUND',
					details: 'The specified collection does not exist or you do not have access to it',
					suggestions: ['Verify the collection ID is correct'],
				},
				{ status: 404 }
			);
		}

		const collection = currentCollection[0];

		// Prepare update fields
		const updates: string[] = [];
		const params: (string | number | null)[] = [];

		// Handle title update and slug regeneration
		if (title && title !== collection.title) {
			updates.push('title = ?');
			params.push(title);

			// Regenerate URL slug
			const newSlug = generateSlugFromTitle(collectionIdNum, title as string);
			updates.push('url_slug = ?');
			params.push(newSlug);
		}

		// Handle subtitle update
		if (subtitle !== undefined) {
			updates.push('subtitle = ?');
			params.push(subtitle || null);
		}

		// Handle show_overlay update
		if (showOverlay !== null && showOverlay !== undefined) {
			updates.push('show_overlay = ?');
			params.push(showOverlay === 'true' ? 1 : 0);
		}

		// Handle image updates
		let newLightFilename = collection.filename;
		let newDarkFilename = collection.filename_dark;

		if (revertToDefault) {
			// Revert to default images (store WITH extensions for consistency)
			newLightFilename = 'custom_collection_004.jpg';
			newDarkFilename = 'custom_collection_004_dark.jpg';

			// Clean up current custom images if orphaned
			if (!isDefaultImage(collection.filename)) {
				const baseHash = extractBaseHash(collection.filename);
				if (baseHash) {
					const isOrphaned = await checkImageIsOrphaned(collection.filename, collectionIdNum);
					if (isOrphaned) {
						// Clean up all versions of the file
						const deletedFiles = await findAndDeleteHashFiles(baseHash, 'collections');
						if (deletedFiles.length > 0) {
							console.log(`Cleaned up ${deletedFiles.length} old collection image file(s): ${deletedFiles.join(', ')}`);
						}
					}
				}
			}

			if (!isDefaultImage(collection.filename_dark)) {
				const baseHash = extractBaseHash(collection.filename_dark);
				if (baseHash) {
					const isOrphaned = await checkImageIsOrphaned(collection.filename_dark, collectionIdNum);
					if (isOrphaned) {
						// Clean up all versions of the dark file
						const deletedFiles = await findAndDeleteHashFiles(baseHash, 'collections');
						if (deletedFiles.length > 0) {
							console.log(`Cleaned up ${deletedFiles.length} old collection dark image file(s): ${deletedFiles.join(', ')}`);
						}
					}
				}
			}

			updates.push('filename = ?', 'filename_dark = ?');
			params.push(newLightFilename, newDarkFilename);
		} else {
			// Handle light image upload
			if (lightImageFile && lightImageFile.size > 0) {
				// Validate file
				if (lightImageFile.size > MAX_FILE_SIZE) {
					return NextResponse.json(
						{
							success: false,
							error: 'Light image file too large',
							code: 'FILE_TOO_LARGE',
							details: `File size ${(lightImageFile.size / 1024 / 1024).toFixed(2)}MB exceeds maximum of 5MB`,
							suggestions: ['Compress or resize the image before uploading'],
						},
						{ status: 422 }
					);
				}

				if (!ALLOWED_IMAGE_TYPES.includes(lightImageFile.type)) {
					return NextResponse.json(
						{
							success: false,
							error: 'Invalid light image file type',
							code: 'INVALID_FILE_TYPE',
							details: `File type ${lightImageFile.type} is not allowed`,
							suggestions: ['Upload a JPEG, PNG, or WebP image'],
						},
						{ status: 422 }
					);
				}

				if (!validateFileExtension(lightImageFile.name, lightImageFile.type)) {
					return NextResponse.json(
						{
							success: false,
							error: 'Light image file extension mismatch',
							code: 'EXTENSION_MISMATCH',
							details: 'File extension does not match the file type',
							suggestions: ['Ensure the file has the correct extension'],
						},
						{ status: 422 }
					);
				}

				const buffer = Buffer.from(await lightImageFile.arrayBuffer());

				if (!validateFileContent(buffer, lightImageFile.type)) {
					return NextResponse.json(
						{
							success: false,
							error: 'Invalid light image file content',
							code: 'INVALID_FILE_CONTENT',
							details: 'File content does not match the declared type',
							suggestions: ['Ensure the file is not corrupted'],
						},
						{ status: 422 }
					);
				}

				// Generate versioned filename for cache busting
				const versionedFilename = generateVersionedFilename(collection.filename, 'jpg');
				const baseFilename = versionedFilename.includes('.') ? versionedFilename.split('.')[0] : versionedFilename;

				// Upload with versioned filename
				const uploadResult = await uploadFile(buffer, baseFilename, 'jpg', lightImageFile.type, 'collections');
				if (!uploadResult.success) {
					return NextResponse.json(
						{
							success: false,
							error: 'Failed to upload light image',
							code: 'UPLOAD_FAILED',
							details: uploadResult.error || 'Upload failed',
							suggestions: ['Try again or use a different image'],
						},
						{ status: 500 }
					);
				}

				newLightFilename = versionedFilename; // Store WITH extension for consistency with recipes

				// Clean up old versions if image is orphaned
				if (!isDefaultImage(collection.filename) && collection.filename !== newLightFilename) {
					const baseHash = extractBaseHash(collection.filename);
					if (baseHash) {
						const isOrphaned = await checkImageIsOrphaned(collection.filename, collectionIdNum);
						if (isOrphaned) {
							// Clean up all versions of the old file
							const deletedFiles = await findAndDeleteHashFiles(baseHash, 'collections');
							if (deletedFiles.length > 0) {
								console.log(`Cleaned up ${deletedFiles.length} old collection image file(s): ${deletedFiles.join(', ')}`);
							}
						}
					}
				}

				updates.push('filename = ?');
				params.push(newLightFilename);
			}

			// Handle dark image upload
			if (darkImageFile && darkImageFile.size > 0) {
				// Validate file
				if (darkImageFile.size > MAX_FILE_SIZE) {
					return NextResponse.json(
						{
							success: false,
							error: 'Dark image file too large',
							code: 'FILE_TOO_LARGE',
							details: `File size ${(darkImageFile.size / 1024 / 1024).toFixed(2)}MB exceeds maximum of 5MB`,
							suggestions: ['Compress or resize the image before uploading'],
						},
						{ status: 422 }
					);
				}

				if (!ALLOWED_IMAGE_TYPES.includes(darkImageFile.type)) {
					return NextResponse.json(
						{
							success: false,
							error: 'Invalid dark image file type',
							code: 'INVALID_FILE_TYPE',
							details: `File type ${darkImageFile.type} is not allowed`,
							suggestions: ['Upload a JPEG, PNG, or WebP image'],
						},
						{ status: 422 }
					);
				}

				if (!validateFileExtension(darkImageFile.name, darkImageFile.type)) {
					return NextResponse.json(
						{
							success: false,
							error: 'Dark image file extension mismatch',
							code: 'EXTENSION_MISMATCH',
							details: 'File extension does not match the file type',
							suggestions: ['Ensure the file has the correct extension'],
						},
						{ status: 422 }
					);
				}

				const buffer = Buffer.from(await darkImageFile.arrayBuffer());

				if (!validateFileContent(buffer, darkImageFile.type)) {
					return NextResponse.json(
						{
							success: false,
							error: 'Invalid dark image file content',
							code: 'INVALID_FILE_CONTENT',
							details: 'File content does not match the declared type',
							suggestions: ['Ensure the file is not corrupted'],
						},
						{ status: 422 }
					);
				}

				// Generate versioned filename for dark image with cache busting
				const versionedDarkFilename = generateVersionedFilename(collection.filename_dark, 'jpg');
				const baseDarkFilename = versionedDarkFilename.includes('.') ? versionedDarkFilename.split('.')[0] : versionedDarkFilename;

				// Upload with versioned filename
				const uploadResult = await uploadFile(buffer, baseDarkFilename, 'jpg', darkImageFile.type, 'collections');
				if (!uploadResult.success) {
					return NextResponse.json(
						{
							success: false,
							error: 'Failed to upload dark image',
							code: 'UPLOAD_FAILED',
							details: uploadResult.error || 'Upload failed',
							suggestions: ['Try again or use a different image'],
						},
						{ status: 500 }
					);
				}

				newDarkFilename = versionedDarkFilename; // Store WITH extension for consistency

				// Clean up old versions if image is orphaned
				if (!isDefaultImage(collection.filename_dark) && collection.filename_dark !== newDarkFilename) {
					const baseHash = extractBaseHash(collection.filename_dark);
					if (baseHash) {
						const isOrphaned = await checkImageIsOrphaned(collection.filename_dark, collectionIdNum);
						if (isOrphaned) {
							// Clean up all versions of the old dark file
							const deletedFiles = await findAndDeleteHashFiles(baseHash, 'collections');
							if (deletedFiles.length > 0) {
								console.log(`Cleaned up ${deletedFiles.length} old collection dark image file(s): ${deletedFiles.join(', ')}`);
							}
						}
					}
				}

				updates.push('filename_dark = ?');
				params.push(newDarkFilename);
			}
		}

		// Add updated_at to updates
		updates.push('updated_at = NOW()');

		// Execute update if there are changes
		if (updates.length > 0) {
			const updateQuery = `UPDATE collections SET ${updates.join(', ')} WHERE id = ? AND household_id = ?`;
			params.push(collectionIdNum, auth.household_id);

			const [result] = await pool.execute<ResultSetHeader>(updateQuery, params);

			if (result.affectedRows === 0) {
				return NextResponse.json(
					{
						success: false,
						error: 'Failed to update collection',
						code: 'UPDATE_FAILED',
						details: 'The collection could not be updated',
						suggestions: ['Try again or contact support if the issue persists'],
					},
					{ status: 500 }
				);
			}
		}

		// Fetch updated collection data
		const [updatedCollection] = await pool.execute<RowDataPacket[]>(
			'SELECT id, title, subtitle, filename, filename_dark, show_overlay, url_slug, updated_at FROM collections WHERE id = ?',
			[collectionIdNum]
		);

		return NextResponse.json({
			success: true,
			message: 'Collection updated successfully',
			data: updatedCollection[0],
		});
	} catch (error) {
		console.error('Error updating collection:', error);
		return NextResponse.json(
			{
				success: false,
				error: 'Internal server error',
				code: 'INTERNAL_ERROR',
				details: 'An unexpected error occurred while updating the collection',
				suggestions: ['Try again later or contact support if the issue persists'],
			},
			{ status: 500 }
		);
	}
}
