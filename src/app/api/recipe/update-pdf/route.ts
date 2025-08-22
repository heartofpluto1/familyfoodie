import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';
import { uploadFile, getStorageMode } from '@/lib/storage';
import { getRecipePdfUrl, generateVersionedFilename, extractBaseHash } from '@/lib/utils/secureFilename';
import { findAndDeleteHashFiles } from '@/lib/utils/secureFilename.server';
import jsPDF from 'jspdf';

interface RecipeRow extends RowDataPacket {
	image_filename: string;
	pdf_filename: string;
}

async function updatePdfHandler(request: NextRequest) {
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

		// Get the current pdf filename from the database
		const [recipeRows] = await pool.execute<RecipeRow[]>('SELECT image_filename, pdf_filename FROM recipes WHERE id = ?', [parseInt(recipeId)]);

		if (recipeRows.length === 0) {
			return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
		}

		const currentPdfFilename = recipeRows[0].pdf_filename;

		// Defensive cleanup: remove all old files with the same base hash
		const baseHash = extractBaseHash(currentPdfFilename);
		let cleanupSummary = '';

		if (baseHash) {
			try {
				const deletedFiles = await findAndDeleteHashFiles(baseHash, 'pdf');
				if (deletedFiles.length > 0) {
					cleanupSummary = `Cleaned up ${deletedFiles.length} old file(s): ${deletedFiles.join(', ')}`;
					console.log(cleanupSummary);
				}
			} catch (error) {
				console.warn('File cleanup failed but continuing with upload:', error);
			}
		}

		// Generate versioned filename for update (this will increment the version)
		const uploadFilename = generateVersionedFilename(currentPdfFilename, 'pdf');

		console.log(`Storage mode: ${getStorageMode()}`);
		console.log(`Updating PDF from ${currentPdfFilename} to ${uploadFilename}`);

		// Upload the versioned PDF
		const baseFilename = uploadFilename.includes('.') ? uploadFilename.split('.')[0] : uploadFilename;
		const uploadResult = await uploadFile(buffer, baseFilename, 'pdf', 'application/pdf');

		if (!uploadResult.success) {
			return NextResponse.json(
				{
					error: uploadResult.error || 'PDF upload failed',
				},
				{ status: 500 }
			);
		}

		// Update the database with the new versioned filename
		const [updateResult] = await pool.execute<ResultSetHeader>('UPDATE recipes SET pdf_filename = ? WHERE id = ?', [uploadFilename, parseInt(recipeId)]);

		if (updateResult.affectedRows === 0) {
			return NextResponse.json({ error: 'Failed to update recipe PDF filename' }, { status: 500 });
		}

		console.log(`Updated database pdf_filename to ${uploadFilename} for recipe ${recipeId}`);

		// Generate URL for immediate display
		const pdfUrl = getRecipePdfUrl(uploadFilename);

		return NextResponse.json({
			success: true,
			message: 'Recipe PDF updated successfully',
			filename: uploadFilename,
			url: uploadResult.url,
			pdfUrl,
			storageMode: getStorageMode(),
			cleanup: cleanupSummary || 'No old files to clean up',
		});
	} catch (error) {
		console.error('Error updating recipe PDF:', error);
		return NextResponse.json({ error: 'Failed to update recipe PDF' }, { status: 500 });
	}
}

export const POST = withAuth(updatePdfHandler);
