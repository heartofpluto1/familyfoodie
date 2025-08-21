import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';
import { generateCollectionSecureFilename } from '@/lib/utils/secureFilename.collections';
import { uploadFile, getStorageMode } from '@/lib/storage';

async function createCollectionHandler(request: NextRequest) {
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
				`INSERT INTO collections (title, subtitle, created_at, updated_at) 
				 VALUES (?, ?, NOW(), NOW())`,
				[title, subtitle || null]
			);

			collectionId = result.insertId;
			filename = generateCollectionSecureFilename(collectionId, title);

			console.log(`Storage mode: ${getStorageMode()}`);
			console.log(`Creating collection with filename: ${filename}`);

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
				const darkImageBuffer = Buffer.from(await darkImage.arrayBuffer());
				const darkUploadResult = await uploadFile(darkImageBuffer, `${filename}_dark`, 'jpg', 'image/jpeg', 'collections');

				if (!darkUploadResult.success) {
					console.error('Failed to upload dark image:', darkUploadResult.error);
					// Note: We don't fail the entire operation if only dark image fails
					console.warn('Dark mode image upload failed, but continuing with light mode only');
				} else {
					console.log('Successfully uploaded dark mode image');
				}
			}

			// Update collection with generated filename
			await pool.execute(`UPDATE collections SET filename = ? WHERE id = ?`, [filename, collectionId]);
		} else {
			// No custom images, use default filename
			filename = 'custom_collection_004';

			// Insert collection with default filename
			const [result] = await pool.execute<ResultSetHeader>(
				`INSERT INTO collections (title, subtitle, filename, created_at, updated_at) 
				 VALUES (?, ?, ?, NOW(), NOW())`,
				[title, subtitle || null, filename]
			);

			collectionId = result.insertId;
		}

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
