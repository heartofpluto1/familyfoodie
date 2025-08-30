import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { requireAuth } from '@/lib/auth/helpers';
import { uploadFile, getStorageMode } from '@/lib/storage';
import { getRecipePdfUrl, generateVersionedFilename } from '@/lib/utils/secureFilename';
import { canEditResource, validateRecipeInCollection } from '@/lib/permissions';
import jsPDF from 'jspdf';

interface RecipeRow extends RowDataPacket {
	image_filename: string;
	pdf_filename: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
	const auth = await requireAuth();
	if (!auth.authorized) {
		return auth.response;
	}
	try {
		const formData = await request.formData();
		const file = formData.get('pdf') as File;
		const recipeId = formData.get('recipeId') as string;
		const collectionId = formData.get('collectionId') as string;

		if (!file) {
			return NextResponse.json(
				{
					error: 'PDF file is required.',
					field: 'pdf',
					message: 'Please select a PDF or JPEG file to upload.',
				},
				{ status: 400 }
			);
		}

		if (!recipeId || !collectionId) {
			return NextResponse.json(
				{
					error: 'Recipe ID and collection ID are required.',
					fields: ['recipeId', 'collectionId'],
					message: 'Please specify which recipe and collection to update.',
				},
				{ status: 400 }
			);
		}

		// Add recipe ID and collection ID format validation
		const recipeIdNum = parseInt(recipeId, 10);
		const collectionIdNum = parseInt(collectionId, 10);

		if (isNaN(recipeIdNum) || recipeIdNum <= 0) {
			return NextResponse.json(
				{
					error: 'Recipe ID must be a valid positive number.',
					field: 'recipeId',
					receivedValue: recipeId,
					message: 'Please provide a valid numeric recipe ID.',
				},
				{ status: 400 }
			);
		}

		if (isNaN(collectionIdNum) || collectionIdNum <= 0) {
			return NextResponse.json(
				{
					error: 'Collection ID must be a valid positive number.',
					field: 'collectionId',
					receivedValue: collectionId,
					message: 'Please provide a valid numeric collection ID.',
				},
				{ status: 400 }
			);
		}

		if (recipeIdNum <= 0) {
			return NextResponse.json(
				{
					error: 'Recipe ID must be a positive number.',
					field: 'recipeId',
					receivedValue: recipeId,
					message: 'Recipe ID must be greater than zero.',
				},
				{ status: 400 }
			);
		}

		// Validate file type
		const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg'];
		if (!validTypes.includes(file.type)) {
			return NextResponse.json(
				{
					error: 'Invalid file type. Only PDF and JPEG files are supported.',
					supportedTypes: ['application/pdf', 'image/jpeg'],
					receivedType: file.type,
					fileName: file.name,
					message: 'Please upload a PDF document or JPEG image.',
				},
				{ status: 400 }
			);
		}

		// Validate file size (10MB max)
		const maxSize = 10 * 1024 * 1024; // 10MB
		if (file.size > maxSize) {
			const fileSizeMB = Math.round(file.size / (1024 * 1024));
			return NextResponse.json(
				{
					error: 'File size exceeds maximum limit.',
					maxSizeAllowed: '10MB',
					receivedSize: `${fileSizeMB}MB`,
					fileName: file.name,
					message: 'Please compress your file or use a smaller PDF/image.',
					suggestion: 'Try reducing image quality or splitting large documents into smaller files.',
				},
				{ status: 400 }
			);
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
			try {
				await new Promise((resolve, reject) => {
					img.onload = resolve;
					img.onerror = () => reject(new Error('Image loading failed'));
					img.src = imageData;
				});
			} catch {
				return NextResponse.json(
					{
						error: 'Invalid or corrupted image file.',
						message: 'The uploaded image could not be processed.',
						fileName: file.name,
						suggestion: 'Please try uploading a different image or convert it to PDF first.',
					},
					{ status: 400 }
				);
			}

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

		// Validate that the recipe belongs to the specified collection and household has access
		const isRecipeInCollection = await validateRecipeInCollection(recipeIdNum, collectionIdNum, auth.household_id);
		if (!isRecipeInCollection) {
			return NextResponse.json(
				{
					error: 'Recipe not found.',
					recipeId: recipeId,
					message: 'The specified recipe does not exist or you do not have permission to edit it.',
					suggestion: 'Please check the recipe ID and try again.',
				},
				{ status: 404 }
			);
		}

		// Get the current pdf filename from the database
		const [recipeRows] = await pool.execute<RecipeRow[]>('SELECT image_filename, pdf_filename FROM recipes WHERE id = ?', [recipeIdNum]);

		if (recipeRows.length === 0) {
			return NextResponse.json(
				{
					error: 'Recipe not found.',
					recipeId: recipeId,
					message: 'The specified recipe does not exist or has been deleted.',
					suggestion: 'Please check the recipe ID and try again.',
				},
				{ status: 404 }
			);
		}

		const currentPdfFilename = recipeRows[0].pdf_filename;

		// Check if household can edit this recipe (must own it to upload initial PDF)
		const canEdit = await canEditResource(auth.household_id, 'recipes', recipeIdNum);
		if (!canEdit) {
			return NextResponse.json(
				{
					error: 'Permission denied.',
					message: 'You can only upload PDFs to recipes you own.',
					suggestion: 'Create your own copy of this recipe first.',
				},
				{ status: 403 }
			);
		}

		// Generate filename - if updating existing, create versioned filename for cache busting
		let uploadFilename;
		if (currentPdfFilename) {
			// This is an update - generate versioned filename
			uploadFilename = generateVersionedFilename(currentPdfFilename, 'pdf');
			console.log(`Updating PDF from ${currentPdfFilename} to ${uploadFilename}`);
		} else {
			// This is initial upload - generate new filename
			uploadFilename = `recipe_${recipeId}_${Date.now()}.pdf`;
		}

		console.log(`Storage mode: ${getStorageMode()}`);
		console.log(`Uploading PDF with filename: ${uploadFilename}`);

		// Upload the PDF using the complete filename
		const baseFilename = uploadFilename.includes('.') ? uploadFilename.split('.')[0] : uploadFilename;
		const uploadResult = await uploadFile(buffer, baseFilename, 'pdf', 'application/pdf');

		if (!uploadResult.success) {
			console.error('Upload failed:', uploadResult.error);
			return NextResponse.json(
				{
					error: 'Unable to save the PDF file. Please try again.',
					retryable: true,
					message: 'There was a temporary problem with file storage.',
					suggestion: 'If this problem persists, please contact support.',
					supportContact: 'support@familyfoodie.com',
				},
				{ status: 500 }
			);
		}

		// Update the database with complete filename including extension
		const [updateResult] = await pool.execute<ResultSetHeader>('UPDATE recipes SET pdf_filename = ? WHERE id = ?', [uploadFilename, recipeIdNum]);

		if (updateResult.affectedRows === 0) {
			return NextResponse.json({ error: 'Failed to update recipe PDF filename' }, { status: 500 });
		}

		const action = currentPdfFilename ? 'Updated' : 'Set';
		console.log(`${action} database pdf_filename to ${uploadFilename} for recipe ${recipeId}`);

		// Generate URL for immediate display
		const pdfUrl = getRecipePdfUrl(uploadFilename);

		// Create organized response structure
		interface UploadResponse {
			success: boolean;
			message: string;
			recipe: {
				id: number;
				pdfUrl: string;
				filename: string;
			};
			upload: {
				storageUrl: string;
				storageMode: string;
				timestamp: string;
				fileSize: string;
			};
			conversion?: {
				originalFormat: string;
				convertedTo: string;
				originalFileName: string;
			};
		}

		const response: UploadResponse = {
			success: true,
			message: 'PDF uploaded successfully',
			recipe: {
				id: recipeIdNum,
				pdfUrl,
				filename: uploadFilename,
			},
			upload: {
				storageUrl: uploadResult.url,
				storageMode: getStorageMode(),
				timestamp: new Date().toISOString(),
				fileSize: `${Math.round(file.size / 1024)}KB`,
			},
		};

		// Add conversion info for image files
		if (file.type.startsWith('image/')) {
			response.conversion = {
				originalFormat: file.type,
				convertedTo: 'application/pdf',
				originalFileName: file.name,
			};
		}

		return NextResponse.json(response);
	} catch (error) {
		console.error('Error uploading PDF:', error);
		return NextResponse.json({ error: 'Failed to upload PDF' }, { status: 500 });
	}
}
