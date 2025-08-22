// Server-only utilities for secure filename operations
// These functions use Node.js filesystem modules and cannot be imported by client components

import { promises as fs } from 'fs';
import path from 'path';
import { getStorageMode } from '@/lib/storage';

/**
 * Find and delete all files matching a base hash pattern for defensive cleanup
 * This prevents storage bloat by removing old versioned files when updating
 *
 * @param baseHash - The base hash to search for (32 char hex string)
 * @param fileType - Either 'image' or 'pdf' to determine search directory
 * @returns Array of deleted filenames
 */
export async function findAndDeleteHashFiles(baseHash: string, fileType: 'image' | 'pdf'): Promise<string[]> {
	if (!baseHash || baseHash.length < 8) {
		console.log('Invalid base hash provided for cleanup');
		return [];
	}

	const storageMode = getStorageMode();
	if (storageMode !== 'local') {
		// For cloud storage, we'd need to implement cloud-specific deletion
		console.log('Cloud storage cleanup not implemented yet');
		return [];
	}

	// For local storage, clean up files in the public directory
	const searchDir = path.join(process.cwd(), 'public', 'static');
	const deletedFiles: string[] = [];

	try {
		const files = await fs.readdir(searchDir);

		// Create pattern to match: baseHash, baseHash_v2, baseHash_v3, etc.
		const pattern = new RegExp(`^${baseHash}(?:_v\\d+)?\\.(${fileType === 'image' ? 'jpg|png|webp' : 'pdf'})$`);

		const matchingFiles = files.filter(file => pattern.test(file));

		for (const file of matchingFiles) {
			try {
				const filePath = path.join(searchDir, file);
				await fs.unlink(filePath);
				deletedFiles.push(file);
				console.log(`Deleted old ${fileType} file: ${file}`);
			} catch (error) {
				console.warn(`Failed to delete ${file}:`, error);
			}
		}
	} catch (error) {
		console.warn('Directory read failed during cleanup:', error);
	}

	return deletedFiles;
}

/**
 * Clean up all files associated with a recipe when deleting it
 * This removes both image and PDF files to prevent orphaned storage
 *
 * @param imageFilename - The recipe's image filename
 * @param pdfFilename - The recipe's PDF filename
 * @returns Summary of cleanup actions
 */
export async function cleanupRecipeFiles(imageFilename: string | null, pdfFilename: string | null): Promise<string> {
	const cleanupResults: string[] = [];

	if (imageFilename) {
		const imageBaseHash = extractBaseHashFromFilename(imageFilename);
		if (imageBaseHash) {
			const deletedImageFiles = await findAndDeleteHashFiles(imageBaseHash, 'image');
			if (deletedImageFiles.length > 0) {
				cleanupResults.push(`Deleted ${deletedImageFiles.length} image file(s): ${deletedImageFiles.join(', ')}`);
			}
		}
	}

	if (pdfFilename) {
		const pdfBaseHash = extractBaseHashFromFilename(pdfFilename);
		if (pdfBaseHash) {
			const deletedPdfFiles = await findAndDeleteHashFiles(pdfBaseHash, 'pdf');
			if (deletedPdfFiles.length > 0) {
				cleanupResults.push(`Deleted ${deletedPdfFiles.length} PDF file(s): ${deletedPdfFiles.join(', ')}`);
			}
		}
	}

	return cleanupResults.length > 0 ? cleanupResults.join('; ') : 'No files to clean up';
}

/**
 * Extract base hash from filename for server-side operations
 * This is a server-only version of the function for file cleanup operations
 */
function extractBaseHashFromFilename(filename: string | null): string {
	if (!filename) return '';

	// Remove extension first
	const nameWithoutExt = filename.includes('.') ? filename.split('.')[0] : filename;

	// Match hash pattern with optional version suffix: hash or hash_v2, hash_v3, etc.
	const hashMatch = nameWithoutExt.match(/^([a-f0-9]{8,32})(?:_v\d+)?$/);
	return hashMatch ? hashMatch[1] : '';
}
