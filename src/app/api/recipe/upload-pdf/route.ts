import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';
import { uploadFile, getStorageMode } from '@/lib/storage';
import { getRecipePdfUrl } from '@/lib/utils/secureFilename';

interface RecipeRow extends RowDataPacket {
	filename: string;
}

async function postHandler(request: NextRequest) {
	try {
		const formData = await request.formData();
		const file = formData.get('pdf') as File;
		const recipeId = formData.get('recipeId') as string;

		if (!file || !recipeId) {
			return NextResponse.json({ error: 'PDF file and recipe ID are required' }, { status: 400 });
		}

		// Validate file type
		if (file.type !== 'application/pdf') {
			return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
		}

		// Validate file size (10MB max for PDFs)
		const maxSize = 10 * 1024 * 1024; // 10MB
		if (file.size > maxSize) {
			return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
		}

		const bytes = await file.arrayBuffer();
		const buffer = Buffer.from(bytes);

		// Get the current filename from the database
		const [recipeRows] = await pool.execute<RecipeRow[]>('SELECT filename FROM recipes WHERE id = ?', [parseInt(recipeId)]);

		if (recipeRows.length === 0) {
			return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
		}

		const currentFilename = recipeRows[0].filename;

		// Use existing filename or generate a temporary one for new recipes
		const uploadFilename = currentFilename || `temp_${Date.now()}`;

		console.log(`Storage mode: ${getStorageMode()}`);
		console.log(`Uploading PDF with filename: ${uploadFilename}`);

		// Upload the PDF using the current filename
		const uploadResult = await uploadFile(buffer, uploadFilename, 'pdf', 'application/pdf');

		if (!uploadResult.success) {
			return NextResponse.json(
				{
					error: uploadResult.error || 'PDF upload failed',
				},
				{ status: 500 }
			);
		}

		// Update the database with filename if it was newly generated
		if (!currentFilename) {
			const [updateResult] = await pool.execute<ResultSetHeader>('UPDATE recipes SET filename = ? WHERE id = ?', [uploadFilename, parseInt(recipeId)]);

			if (updateResult.affectedRows === 0) {
				return NextResponse.json({ error: 'Failed to update recipe filename' }, { status: 500 });
			}

			console.log(`Set database filename to ${uploadFilename} for new recipe`);
		}

		// Generate cache-busted URL for immediate display
		const cacheBustedUrl = getRecipePdfUrl(uploadFilename, true);

		return NextResponse.json({
			success: true,
			message: 'PDF uploaded successfully',
			filename: `${uploadFilename}.pdf`,
			url: uploadResult.url,
			cacheBustedUrl,
			storageMode: getStorageMode(),
		});
	} catch (error) {
		console.error('Error uploading PDF:', error);
		return NextResponse.json({ error: 'Failed to upload PDF' }, { status: 500 });
	}
}

export const POST = withAuth(postHandler);
