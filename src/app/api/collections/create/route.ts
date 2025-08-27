import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader } from 'mysql2';
import { withAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { generateCollectionSecureFilename } from '@/lib/utils/secureFilename.collections';
import { uploadFile, getStorageMode } from '@/lib/storage';
import { generateSlugFromTitle } from '@/lib/utils/urlHelpers';

async function createCollectionHandler(request: AuthenticatedRequest) {
	try {
		const formData = await request.formData();

		const title = formData.get('title') as string;
		const subtitle = formData.get('subtitle') as string;
		const lightImage = formData.get('lightImage') as File;
		const darkImage = formData.get('darkImage') as File;

		// Validate required fields
		if (!title) {
			return NextResponse.json({ error: 'Title is required' }, { status: 400 });
		}

		// Validate file types for uploaded images - only accept JPG
		if (lightImage && !lightImage.type.includes('jpeg')) {
			return NextResponse.json({ error: 'Light mode file must be a JPG image' }, { status: 400 });
		}
		if (darkImage && !darkImage.type.includes('jpeg')) {
			return NextResponse.json({ error: 'Dark mode file must be a JPG image' }, { status: 400 });
		}

		// Determine filename to use
		let filename: string;
		let collectionId: number;

		if (lightImage || darkImage) {
			// User provided custom images, generate unique filename
			const [result] = await pool.execute<ResultSetHeader>(
				`INSERT INTO collections (title, subtitle, household_id, public, created_at, updated_at) 
				 VALUES (?, ?, ?, 0, NOW(), NOW())`,
				[title, subtitle || null, request.household_id]
			);

			collectionId = result.insertId;
			filename = generateCollectionSecureFilename(collectionId, title);

			console.log(`Storage mode: ${getStorageMode()}`);
			console.log(`Creating collection with filename: ${filename}`);

			// Determine dark filename based on whether dark image is provided
			let darkFilename: string;

			// Upload images using the storage module (supports both local and GCS)
			if (lightImage) {
				const lightImageBuffer = Buffer.from(await lightImage.arrayBuffer());
				const lightUploadResult = await uploadFile(lightImageBuffer, filename, 'jpg', 'image/jpeg', 'collections');

				if (!lightUploadResult.success) {
					console.error('Failed to upload light image:', lightUploadResult.error);
					// Clean up database entry if image upload fails
					await pool.execute('DELETE FROM collections WHERE id = ?', [collectionId]);
					return NextResponse.json({ error: 'Failed to upload light mode image' }, { status: 500 });
				}
				console.log('Successfully uploaded light mode image');
			}

			if (darkImage) {
				// Dark image provided - use separate dark filename
				darkFilename = `${filename}_dark`;
				const darkImageBuffer = Buffer.from(await darkImage.arrayBuffer());
				const darkUploadResult = await uploadFile(darkImageBuffer, darkFilename, 'jpg', 'image/jpeg', 'collections');

				if (!darkUploadResult.success) {
					console.error('Failed to upload dark image:', darkUploadResult.error);
					// Use light image as fallback for dark mode
					darkFilename = filename;
					console.warn('Dark mode image upload failed, using light image as fallback');
				} else {
					console.log('Successfully uploaded dark mode image');
				}
			} else {
				// No dark image provided - use light image for dark mode
				darkFilename = filename;
				console.log('No dark image provided, using light image for dark mode');
			}

			// Update collection with both light and dark filenames
			await pool.execute(`UPDATE collections SET filename = ?, filename_dark = ? WHERE id = ?`, [filename, darkFilename, collectionId]);
		} else {
			// No custom images, use default filenames
			filename = 'custom_collection_004';
			const darkFilename = 'custom_collection_004_dark';

			// Insert collection with default filenames
			const [result] = await pool.execute<ResultSetHeader>(
				`INSERT INTO collections (title, subtitle, filename, filename_dark, household_id, public, created_at, updated_at) 
				 VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())`,
				[title, subtitle || null, filename, darkFilename, request.household_id]
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

export const POST = withAuth(createCollectionHandler);
