import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';
import { uploadFile, getStorageMode } from '@/lib/storage';
import { getRecipePdfUrl } from '@/lib/utils/secureFilename';
import jsPDF from 'jspdf';

interface RecipeRow extends RowDataPacket {
	filename: string;
}

async function postHandler(request: NextRequest) {
	try {
		const formData = await request.formData();
		const file = formData.get('pdf') as File;
		const recipeId = formData.get('recipeId') as string;

		if (!file || !recipeId) {
			return NextResponse.json({ error: 'File and recipe ID are required' }, { status: 400 });
		}

		// Validate file type
		const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg'];
		if (!validTypes.includes(file.type)) {
			return NextResponse.json({ error: 'Only PDF and JPG files are allowed' }, { status: 400 });
		}

		// Validate file size (10MB max)
		const maxSize = 10 * 1024 * 1024; // 10MB
		if (file.size > maxSize) {
			return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
		}

		let buffer: Buffer;

		// Convert JPG to PDF if needed
		if (file.type.startsWith('image/')) {
			const bytes = await file.arrayBuffer();
			const originalBuffer = Buffer.from(bytes);

			// Convert buffer to base64 for jsPDF
			const base64Image = originalBuffer.toString('base64');
			const imageData = `data:${file.type};base64,${base64Image}`;

			// Create image element to get actual dimensions
			const img = new Image();
			await new Promise((resolve, reject) => {
				img.onload = resolve;
				img.onerror = reject;
				img.src = imageData;
			});

			// Determine optimal page orientation based on image aspect ratio
			const imageAspectRatio = img.width / img.height;
			const isLandscape = imageAspectRatio > 1.2; // Use landscape if significantly wider than tall

			// Create PDF with optimal orientation
			const doc = new jsPDF({
				orientation: isLandscape ? 'landscape' : 'portrait',
				unit: 'pt',
				format: 'a4',
				compress: true, // Enable PDF compression
			});

			// Add PDF metadata for better compatibility
			doc.setProperties({
				title: file.name || 'Recipe Image',
				subject: 'Recipe Image converted to PDF',
				author: 'Family Foodie App',
				creator: 'Family Foodie Recipe Management System',
			});

			// Get page dimensions
			const pageWidth = doc.internal.pageSize.getWidth();
			const pageHeight = doc.internal.pageSize.getHeight();
			const margin = 20; // Reduced margin for better image utilization

			// Calculate available space
			const maxWidth = pageWidth - margin * 2;
			const maxHeight = pageHeight - margin * 2;

			// Calculate scaling to maintain aspect ratio
			const scaleX = maxWidth / img.width;
			const scaleY = maxHeight / img.height;
			const scale = Math.min(scaleX, scaleY); // Use smaller scale to fit within page

			// Calculate final dimensions and centering
			const finalWidth = img.width * scale;
			const finalHeight = img.height * scale;
			const x = (pageWidth - finalWidth) / 2; // Center horizontally
			const y = (pageHeight - finalHeight) / 2; // Center vertically

			// Add image with high quality settings
			doc.addImage(
				imageData,
				'JPEG',
				x,
				y,
				finalWidth,
				finalHeight,
				undefined,
				'SLOW' // Use SLOW compression for better quality
			);

			// Convert PDF to buffer with high quality output
			const pdfOutput = doc.output('arraybuffer');
			buffer = Buffer.from(pdfOutput);
		} else {
			// For PDF files, use as-is
			const bytes = await file.arrayBuffer();
			buffer = Buffer.from(bytes);
		}

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

		// Generate URL for immediate display
		const pdfUrl = getRecipePdfUrl(uploadFilename);

		return NextResponse.json({
			success: true,
			message: 'PDF uploaded successfully',
			filename: `${uploadFilename}.pdf`,
			url: uploadResult.url,
			pdfUrl,
			storageMode: getStorageMode(),
		});
	} catch (error) {
		console.error('Error uploading PDF:', error);
		return NextResponse.json({ error: 'Failed to upload PDF' }, { status: 500 });
	}
}

export const POST = withAuth(postHandler);
