// Server-only utilities for secure filename operations
// These functions use Node.js filesystem modules and cannot be imported by client components

import { promises as fs } from 'fs';
import path from 'path';
import { getStorageMode } from '@/lib/storage';
import { Storage } from '@google-cloud/storage';

/**
 * Find and delete all files matching a base hash pattern for defensive cleanup
 * This prevents storage bloat by removing old versioned files when updating
 * Automatically detects storage mode (GCS vs local) and uses appropriate cleanup method
 *
 * @param baseHash - The base hash to search for (32 char hex string)
 * @param fileType - Either 'image' or 'pdf' to determine search directory
 * @param storageCleanup - Optional custom storage cleanup function (for backward compatibility)
 * @returns Array of deleted filenames
 */
export async function findAndDeleteHashFiles(
	baseHash: string,
	fileType: 'image' | 'pdf',
	storageCleanup?: (pattern: string) => Promise<string[]>
): Promise<string[]> {
	if (!baseHash || baseHash.length < 8) {
		return []; // Safety check - don't delete with short/invalid hashes
	}

	const deletedFiles: string[] = [];
	const extensions = fileType === 'image' ? ['jpg', 'jpeg', 'png', 'webp'] : ['pdf'];
	const storageMode = getStorageMode();

	try {
		// If custom storage cleanup function provided (for backward compatibility)
		if (storageCleanup) {
			for (const ext of extensions) {
				const pattern = `${baseHash}*.${ext}`; // Matches hash.ext and hash_v*.ext
				const deleted = await storageCleanup(pattern);
				deletedFiles.push(...deleted);
			}
			return deletedFiles;
		}

		// Auto-detect storage mode and use appropriate cleanup
		if (storageMode === 'Google Cloud Storage') {
			// Production: Clean up files in GCS bucket
			const useGCS = process.env.NODE_ENV === 'production' && !!process.env.GCS_BUCKET_NAME;

			if (!useGCS) {
				console.warn('Storage mode indicates GCS but environment not configured for GCS');
				return [];
			}

			const storage = new Storage({
				projectId: process.env.GOOGLE_CLOUD_PROJECT,
			});

			const bucketName = process.env.GCS_BUCKET_NAME;
			if (!bucketName) {
				console.warn('GCS bucket name not configured');
				return [];
			}

			const bucket = storage.bucket(bucketName);

			// List files with prefix matching the base hash
			const [files] = await bucket.getFiles({
				prefix: baseHash,
			});

			for (const file of files) {
				const filename = file.name;

				// Check if this file matches our pattern for any of the extensions
				for (const ext of extensions) {
					const regex = new RegExp(`^${baseHash}(?:_v\\d+)?\\.${ext}$`);

					if (regex.test(filename)) {
						try {
							await file.delete();
							deletedFiles.push(filename);
							console.log(`Deleted old GCS file: ${filename}`);
						} catch (error) {
							console.warn(`Could not delete GCS file: ${filename}`, error);
							// Continue with other files, don't fail the entire operation
						}
						break; // Found a match for this file, no need to check other extensions
					}
				}
			}
		} else {
			// Development: Clean up files in local filesystem
			const { existsSync } = await import('fs');
			const staticDir = path.join(process.cwd(), 'public', 'static');

			if (!existsSync(staticDir)) {
				return []; // Directory doesn't exist, nothing to clean
			}

			// Read directory and find matching files
			const files = await fs.readdir(staticDir);

			for (const file of files) {
				for (const ext of extensions) {
					// Match patterns: baseHash.ext, baseHash_v2.ext, baseHash_v3.ext, etc.
					const regex = new RegExp(`^${baseHash}(?:_v\\d+)?\\.${ext}$`);

					if (regex.test(file)) {
						const filePath = path.join(staticDir, file);
						try {
							await fs.unlink(filePath);
							deletedFiles.push(file);
							console.log(`Deleted old local file: ${file}`);
						} catch (error) {
							console.warn(`Could not delete local file: ${file}`, error);
							// Continue with other files, don't fail the entire operation
						}
						break; // Found a match for this file, no need to check other extensions
					}
				}
			}
		}
	} catch (error) {
		console.error(`Error during ${storageMode} file cleanup:`, error);
		// Return partial results, don't throw - cleanup is defensive
	}

	console.log(`${storageMode} cleanup completed: ${deletedFiles.length} files deleted`);
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
