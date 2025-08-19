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

		// Use the existing filename if it exists, otherwise use the recipe ID
		const baseFilename = currentFilename || `rid_${recipeId}`;
		const newFilename = `${baseFilename}.${extension}`;
		const staticDir = path.join(process.cwd(), 'public', 'static');
		const filePath = path.join(staticDir, newFilename);

		// Delete existing file if it exists (check current filename with all possible extensions)
		if (currentFilename) {
			const possibleExtensions = ['jpg', 'jpeg', 'png'];
			for (const ext of possibleExtensions) {
				const existingFile = path.join(staticDir, `${currentFilename}.${ext}`);
				if (existsSync(existingFile)) {
					try {
						await unlink(existingFile);
						console.log(`Deleted existing file: ${currentFilename}.${ext}`);
					} catch (error) {
						console.warn(`Could not delete existing file: ${currentFilename}.${ext}`, error);
					}
				}
			}
		}

		// Save the new file
		await writeFile(filePath, buffer);

		// Verify the file was actually written and is accessible
		try {
			await access(filePath);
		} catch (verificationError) {
			console.error('File verification failed after upload:', verificationError);
			return NextResponse.json(
				{
					error: 'File upload failed - could not verify file was saved correctly',
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
			message: 'Image uploaded successfully',
			filename: newFilename,
		});
	} catch (error) {
		console.error('Error uploading image:', error);
		return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
	}
}

export const POST = withAuth(postHandler);
