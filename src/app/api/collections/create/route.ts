import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader } from 'mysql2';
import { requireAuth } from '@/lib/auth/helpers';
import { generateCollectionSecureFilename } from '@/lib/utils/secureFilename.collections';
import { uploadFile } from '@/lib/storage';
import { generateSlugFromTitle } from '@/lib/utils/urlHelpers';

export async function POST(request: Request): Promise<NextResponse> {
	const auth = await requireAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	try {
		const formData = await request.formData();

		const title = formData.get('title') as string;
		const subtitle = formData.get('subtitle') as string;
		const showOverlay = formData.get('show_overlay') === 'true' ? 1 : 0;
		const lightImage = formData.get('light_image') as File;
		const darkImage = formData.get('dark_image') as File;

		// Validate required fields
		if (!title) {
			return NextResponse.json({ error: 'Title is required' }, { status: 400 });
		}

		// Validate file types for uploaded images - accept JPG, PNG, WebP
		const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
		if (lightImage && !validTypes.includes(lightImage.type)) {
			return NextResponse.json({ error: 'Light mode file must be a JPG, PNG, or WebP image' }, { status: 400 });
		}
		if (darkImage && !validTypes.includes(darkImage.type)) {
			return NextResponse.json({ error: 'Dark mode file must be a JPG, PNG, or WebP image' }, { status: 400 });
		}

		// Determine filename to use
		let filename: string;
		let collectionId: number;

		if (lightImage || darkImage) {
			// User provided custom images, generate unique filename
			const [result] = await pool.execute<ResultSetHeader>(
				`INSERT INTO collections (title, subtitle, household_id, public, show_overlay, created_at, updated_at) 
				 VALUES (?, ?, ?, 0, ?, NOW(), NOW())`,
				[title, subtitle || null, auth.household_id, showOverlay]
			);

			collectionId = result.insertId;

			// Helper function to extract extension from file
			const getExtensionFromFile = (file: File): string => {
				const ext = file.name.split('.').pop()?.toLowerCase();
				// Map common extensions to standardized ones
				if (ext === 'jpeg') return 'jpg';
				return ext || 'jpg'; // Default to jpg if no extension
			};

			// Generate base filename and add extension from uploaded file
			const baseFilename = generateCollectionSecureFilename(collectionId, title);
			const extension = lightImage ? getExtensionFromFile(lightImage) : darkImage ? getExtensionFromFile(darkImage) : 'jpg';
			filename = `${baseFilename}.${extension}`;

			// Determine dark filename based on whether dark image is provided
			let darkFilename: string;

			// Upload images using the storage module (supports both local and GCS)
			if (lightImage) {
				const lightImageBuffer = Buffer.from(await lightImage.arrayBuffer());
				const lightExtension = getExtensionFromFile(lightImage);
				const lightUploadResult = await uploadFile(lightImageBuffer, baseFilename, lightExtension, lightImage.type, 'collections');

				if (!lightUploadResult.success) {
					console.error('Failed to upload light image:', lightUploadResult.error);
					// Clean up database entry if image upload fails
					await pool.execute('DELETE FROM collections WHERE id = ?', [collectionId]);
					return NextResponse.json({ error: 'Failed to upload light mode image' }, { status: 500 });
				}
			}

			if (darkImage) {
				// Dark image provided - use separate dark filename
				const darkExtension = getExtensionFromFile(darkImage);
				darkFilename = `${baseFilename}_dark.${darkExtension}`;
				const darkImageBuffer = Buffer.from(await darkImage.arrayBuffer());
				const darkUploadResult = await uploadFile(darkImageBuffer, `${baseFilename}_dark`, darkExtension, darkImage.type, 'collections');

				if (!darkUploadResult.success) {
					console.error('Failed to upload dark image:', darkUploadResult.error);
					// Use light image as fallback for dark mode
					darkFilename = filename;
				} else {
				}
			} else {
				// No dark image provided - use light image for dark mode
				darkFilename = filename;
			}

			// Update collection with both light and dark filenames (already have extensions)
			await pool.execute(`UPDATE collections SET filename = ?, filename_dark = ? WHERE id = ?`, [filename, darkFilename, collectionId]);
		} else {
			// No custom images, use default filenames with extensions
			filename = 'custom_collection_004.jpg';
			const darkFilename = 'custom_collection_004_dark.jpg';

			// Insert collection with default filenames (with extensions)
			const [result] = await pool.execute<ResultSetHeader>(
				`INSERT INTO collections (title, subtitle, filename, filename_dark, household_id, public, show_overlay, created_at, updated_at) 
				 VALUES (?, ?, ?, ?, ?, 0, ?, NOW(), NOW())`,
				[title, subtitle || null, filename, darkFilename, auth.household_id, showOverlay]
			);

			collectionId = result.insertId;
		}

		// Generate and update the url_slug with full slug including ID prefix
		// Database stores the complete slug like "42-italian-classics"
		const fullSlug = generateSlugFromTitle(collectionId, title);
		await pool.execute(`UPDATE collections SET url_slug = ? WHERE id = ?`, [fullSlug, collectionId]);

		return NextResponse.json({
			success: true,
			id: collectionId,
			message: 'Collection created successfully',
			filename: filename,
		});
	} catch (error) {
		console.error('Error creating collection:', error);

		// If we have a collectionId, try to clean up the database entry
		// (Note: Files might be left behind, but that's acceptable for now)

		return NextResponse.json({ error: 'Failed to create collection' }, { status: 500 });
	}
}
