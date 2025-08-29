import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { uploadFile, getStorageMode, deleteFile } from '@/lib/storage';
import { getRecipePdfUrl, generateVersionedFilename, extractBaseHash } from '@/lib/utils/secureFilename';
import { findAndDeleteHashFiles } from '@/lib/utils/secureFilename.server';
import { canEditResource, validateRecipeInCollection } from '@/lib/permissions';
import { cascadeCopyWithContext } from '@/lib/copy-on-write';
import { UpdatePdfResponse } from '@/types/fileUpload';
import jsPDF from 'jspdf';

interface RecipeRow extends RowDataPacket {
	image_filename: string;
	pdf_filename: string;
}

async function updatePdfHandler(request: AuthenticatedRequest) {
	let recipeId: string | undefined;
	let collectionId: string | undefined;

	try {
		const formData = await request.formData();
		const file = formData.get('pdf') as File;
		recipeId = formData.get('recipeId') as string;
		collectionId = formData.get('collectionId') as string;

		// Validate file presence
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

		// Validate recipe ID and collection ID presence
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

		// Validate IDs are numeric
		const recipeIdNum = parseInt(recipeId);
		const collectionIdNum = parseInt(collectionId);

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

		// Validate file type
		const validTypes = ['application/pdf', 'image/jpeg'];
		if (!validTypes.includes(file.type) && file.type !== 'image/jpg') {
			return NextResponse.json(
				{
					error: 'Invalid file type. Only PDF and JPEG files are supported.',
					supportedTypes: validTypes,
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
			const receivedSizeMB = Math.round(file.size / (1024 * 1024));
			return NextResponse.json(
				{
					error: 'File size exceeds maximum limit.',
					maxSizeAllowed: '10MB',
					receivedSize: `${receivedSizeMB}MB`,
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
		const isRecipeInCollection = await validateRecipeInCollection(recipeIdNum, collectionIdNum, request.household_id);
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

		// Check if we need to trigger copy-on-write
		let targetRecipeId = recipeIdNum;
		let targetPdfFilename = currentPdfFilename;
		let wasCopied = false;
		let newRecipeSlug: string | undefined;
		let newCollectionSlug: string | undefined;

		// Check if household can edit this recipe
		const canEdit = await canEditResource(request.household_id, 'recipes', recipeIdNum);

		if (!canEdit) {
			// Recipe is not owned - trigger copy-on-write
			const copyResult = await cascadeCopyWithContext(request.household_id, collectionIdNum, recipeIdNum);
			targetRecipeId = copyResult.newRecipeId;
			wasCopied = true;
			newRecipeSlug = copyResult.newRecipeSlug;
			newCollectionSlug = copyResult.newCollectionSlug;

			// Get the new recipe's current PDF filename
			const [newRecipeRows] = await pool.execute<RecipeRow[]>('SELECT pdf_filename FROM recipes WHERE id = ?', [targetRecipeId]);
			if (newRecipeRows.length > 0) {
				targetPdfFilename = newRecipeRows[0].pdf_filename;
			}
		}

		// Defensive cleanup: remove all old files with the same base hash (only for the target recipe)
		const baseHash = extractBaseHash(targetPdfFilename);
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
		const uploadFilename = generateVersionedFilename(targetPdfFilename, 'pdf');

		console.log(`Storage mode: ${getStorageMode()}`);
		console.log(`Updating PDF from ${currentPdfFilename} to ${uploadFilename}`);

		// Upload the versioned PDF
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

		// Update the database with the new versioned filename (use target recipe ID which may be the copy)
		const [updateResult] = await pool.execute<ResultSetHeader>('UPDATE recipes SET pdf_filename = ? WHERE id = ?', [uploadFilename, targetRecipeId]);

		if (updateResult.affectedRows === 0) {
			// Rollback: Delete the uploaded file since database update failed
			try {
				const baseFilename = uploadFilename.includes('.') ? uploadFilename.split('.')[0] : uploadFilename;
				await deleteFile(baseFilename, 'pdf');
				console.log(`Rolled back uploaded file: ${uploadFilename}`);
			} catch (rollbackError) {
				console.error('Failed to rollback uploaded file:', rollbackError);
			}

			return NextResponse.json(
				{
					error: 'Failed to save PDF information. Please try uploading again.',
					retryable: true,
					message: 'The file was uploaded but could not be properly saved.',
					recipeId: recipeId,
				},
				{ status: 500 }
			);
		}

		console.log(`Updated database pdf_filename to ${uploadFilename} for recipe ${targetRecipeId}`);

		// Generate URL for immediate display
		const pdfUrl = getRecipePdfUrl(uploadFilename);

		// Build response with structured data
		const response: UpdatePdfResponse = {
			success: true,
			message: wasCopied ? 'Recipe copied and PDF updated successfully' : 'Recipe PDF updated successfully',
			recipe: {
				id: targetRecipeId,
				pdfUrl,
				filename: uploadFilename,
			},
			upload: {
				storageUrl: uploadResult.url || '',
				storageMode: getStorageMode(),
				timestamp: new Date().toISOString(),
				fileSize: `${Math.round(buffer.length / 1024)}KB`,
			},
			...(wasCopied && {
				wasCopied,
				newRecipeSlug,
				newCollectionSlug,
			}),
		};

		// Add conversion details if it was an image
		if (file.type.startsWith('image/')) {
			response.conversion = {
				originalFormat: file.type,
				convertedTo: 'application/pdf',
				originalFileName: file.name,
			};
		}

		return NextResponse.json(response);
	} catch (error: unknown) {
		console.error('Error updating recipe PDF:', error);

		// Handle concurrent upload attempts (database lock)
		if (
			(error instanceof Error && error.message.includes('ER_LOCK_WAIT_TIMEOUT')) ||
			(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_LOCK_WAIT_TIMEOUT')
		) {
			return NextResponse.json(
				{
					error: 'Another upload is currently in progress for this recipe.',
					message: 'Please wait for the current upload to complete before trying again.',
					retryAfter: 5, // seconds to wait
					recipeId: recipeId || 'unknown',
				},
				{ status: 409 }
			);
		}

		// Generic error response
		return NextResponse.json({ error: 'Failed to update recipe PDF' }, { status: 500 });
	}
}

export const POST = withAuth(updatePdfHandler);
