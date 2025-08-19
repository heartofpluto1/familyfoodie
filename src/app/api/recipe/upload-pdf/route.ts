import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, access } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';

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
		const [recipeRows] = await pool.execute<RecipeRow[]>('SELECT filename FROM menus_recipe WHERE id = ?', [parseInt(recipeId)]);

		if (recipeRows.length === 0) {
			return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
		}

		const currentFilename = recipeRows[0].filename;

		// Use the existing filename if it exists, otherwise use the recipe ID with 'rid_' prefix
		const baseFilename = currentFilename || `rid_${recipeId}`;
		const newFilename = `${baseFilename}.pdf`;
		const staticDir = path.join(process.cwd(), 'public', 'static');
		const filePath = path.join(staticDir, newFilename);

		// Delete existing PDF file if it exists
		if (currentFilename) {
			const existingPdfFile = path.join(staticDir, `${currentFilename}.pdf`);
			if (existsSync(existingPdfFile)) {
				try {
					await unlink(existingPdfFile);
					console.log(`Deleted existing PDF file: ${currentFilename}.pdf`);
				} catch (error) {
					console.warn(`Could not delete existing PDF file: ${currentFilename}.pdf`, error);
				}
			}
		}

		// Save the new file
		await writeFile(filePath, buffer);

		// Verify the file was actually written and is accessible
		try {
			await access(filePath);
		} catch (verificationError) {
			console.error('PDF verification failed after upload:', verificationError);
			return NextResponse.json(
				{
					error: 'PDF upload failed - could not verify file was saved correctly',
				},
				{ status: 500 }
			);
		}

		// Update the database with the filename (without extension) - only if it changed
		const finalFilename = currentFilename || `rid_${recipeId}`;
		const [result] = await pool.execute<ResultSetHeader>('UPDATE menus_recipe SET filename = ? WHERE id = ?', [finalFilename, parseInt(recipeId)]);

		if (result.affectedRows === 0) {
			// If database update fails, clean up the uploaded file
			try {
				await unlink(filePath);
			} catch (cleanupError) {
				console.warn('Could not clean up uploaded file after database error:', cleanupError);
			}
			return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
		}

		return NextResponse.json({
			success: true,
			message: 'PDF uploaded successfully',
			filename: newFilename,
		});
	} catch (error) {
		console.error('Error uploading PDF:', error);
		return NextResponse.json({ error: 'Failed to upload PDF' }, { status: 500 });
	}
}

export const POST = withAuth(postHandler);
