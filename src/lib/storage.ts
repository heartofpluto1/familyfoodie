import { Storage } from '@google-cloud/storage';
import { existsSync } from 'fs';
import { writeFile, unlink, access, readFile } from 'fs/promises';
import path from 'path';
import { addToast } from '@/lib/toast';

// Determine if we should use GCS based on environment
const useGCS = process.env.NODE_ENV === 'production' && !!process.env.GCS_BUCKET_NAME;

// Initialize Google Cloud Storage only if needed
const storage = useGCS
	? new Storage({
			projectId: process.env.GOOGLE_CLOUD_PROJECT,
		})
	: null;

const bucketName = process.env.GCS_BUCKET_NAME;
const bucket = storage && bucketName ? storage.bucket(bucketName) : null;

export interface FileUploadResult {
	success: boolean;
	url?: string;
	filename?: string;
	error?: string;
}

/**
 * Get the public URL for a file
 */
export function getFileUrl(filename: string, extension: string): string {
	if (useGCS && bucketName) {
		return `https://storage.googleapis.com/${bucketName}/${filename}.${extension}`;
	} else {
		return `/static/${filename}.${extension}`;
	}
}

/**
 * Upload a file to storage (GCS in production, local in development)
 */
export async function uploadFile(buffer: Buffer, filename: string, extension: string, contentType?: string): Promise<FileUploadResult> {
	const fullFilename = `${filename}.${extension}`;

	if (useGCS && bucket) {
		// Production: Upload to Google Cloud Storage
		console.log(`Uploading to GCS: ${fullFilename} to bucket: ${bucketName}`);
		addToast('info', 'GCS Upload', `Attempting to upload ${fullFilename} to bucket: ${bucketName}`);
		try {
			const file = bucket.file(fullFilename);

			await file.save(buffer, {
				metadata: {
					contentType: contentType || (extension === 'pdf' ? 'application/pdf' : 'image/jpeg'),
					cacheControl: 'public, max-age=31536000',
				},
				public: true,
			});

			addToast('success', 'GCS Upload Success', `Successfully uploaded ${fullFilename} to GCS`);
			return {
				success: true,
				url: getFileUrl(filename, extension),
				filename: fullFilename,
			};
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error uploading to GCS';
			const debugInfo = `GCS Config - useGCS: ${useGCS}, bucketName: ${bucketName}, bucket exists: ${!!bucket}`;

			// Add server-side toast for debugging
			addToast('error', 'GCS Upload Failed', `${errorMsg} | ${debugInfo}`);

			console.error('Error uploading to GCS:', error);
			console.error('GCS Config - useGCS:', useGCS, 'bucketName:', bucketName, 'bucket exists:', !!bucket);
			return {
				success: false,
				error: errorMsg,
			};
		}
	} else {
		// Development: Save to local filesystem
		if (process.env.NODE_ENV === 'production') {
			addToast('warning', 'GCS Not Configured', `GCS disabled - useGCS: ${useGCS}, bucket: ${!!bucket}, bucketName: ${bucketName}`);
		}
		try {
			const staticDir = path.join(process.cwd(), 'public', 'static');
			const filePath = path.join(staticDir, fullFilename);

			await writeFile(filePath, buffer);
			await access(filePath); // Verify file was written

			return {
				success: true,
				url: getFileUrl(filename, extension),
				filename: fullFilename,
			};
		} catch (error) {
			console.error('Error saving to filesystem:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error saving file',
			};
		}
	}
}

/**
 * Delete a file from storage
 */
export async function deleteFile(filename: string, extension: string): Promise<boolean> {
	const fullFilename = `${filename}.${extension}`;

	if (useGCS && bucket) {
		// Production: Delete from GCS
		try {
			const file = bucket.file(fullFilename);
			await file.delete();
			return true;
		} catch (error) {
			console.error('Error deleting from GCS:', error);
			return false;
		}
	} else {
		// Development: Delete from local filesystem
		try {
			const staticDir = path.join(process.cwd(), 'public', 'static');
			const filePath = path.join(staticDir, fullFilename);

			if (existsSync(filePath)) {
				await unlink(filePath);
				return true;
			}
			return false;
		} catch (error) {
			console.error('Error deleting local file:', error);
			return false;
		}
	}
}

/**
 * Check if a file exists in storage
 */
export async function fileExists(filename: string, extension: string): Promise<boolean> {
	const fullFilename = `${filename}.${extension}`;

	if (useGCS && bucket) {
		// Production: Check in GCS
		try {
			const file = bucket.file(fullFilename);
			const [exists] = await file.exists();
			return exists;
		} catch (error) {
			console.error('Error checking GCS file existence:', error);
			return false;
		}
	} else {
		// Development: Check local filesystem
		const staticDir = path.join(process.cwd(), 'public', 'static');
		const filePath = path.join(staticDir, fullFilename);
		return existsSync(filePath);
	}
}

/**
 * Migrate a file from old filename to new filename
 * This handles both local and GCS storage, and handles filename format changes
 */
export async function migrateFile(oldFilename: string, newFilename: string, extension: string): Promise<FileUploadResult> {
	// If filenames are the same, no migration needed
	if (oldFilename === newFilename) {
		return {
			success: true,
			url: getFileUrl(newFilename, extension),
			filename: `${newFilename}.${extension}`,
		};
	}

	const staticDir = path.join(process.cwd(), 'public', 'static');

	// For images, try multiple extensions
	const possibleExtensions = extension === 'pdf' ? ['pdf'] : ['jpg', 'jpeg', 'png'];
	let actualExtension = extension;
	let fileBuffer: Buffer | null = null;

	if (useGCS && bucket) {
		// Production: Migrate within GCS
		for (const ext of possibleExtensions) {
			try {
				const oldFile = bucket.file(`${oldFilename}.${ext}`);
				const [exists] = await oldFile.exists();

				if (exists) {
					// Download the file
					const [buffer] = await oldFile.download();
					fileBuffer = buffer;
					actualExtension = ext;

					// Delete the old file
					await oldFile.delete();
					console.log(`Deleted old GCS file: ${oldFilename}.${ext}`);
					break;
				}
			} catch (error) {
				console.warn(`Could not process GCS file ${oldFilename}.${ext}:`, error);
			}
		}

		// Also check local filesystem (for migration from container to GCS)
		if (!fileBuffer) {
			for (const ext of possibleExtensions) {
				const localPath = path.join(staticDir, `${oldFilename}.${ext}`);
				if (existsSync(localPath)) {
					fileBuffer = await readFile(localPath);
					actualExtension = ext;

					// Delete local file after reading
					try {
						await unlink(localPath);
						console.log(`Deleted local file during GCS migration: ${localPath}`);
					} catch (error) {
						console.warn(`Could not delete local file: ${localPath}`, error);
					}
					break;
				}
			}
		}
	} else {
		// Development: Migrate within local filesystem
		for (const ext of possibleExtensions) {
			const oldPath = path.join(staticDir, `${oldFilename}.${ext}`);

			if (existsSync(oldPath)) {
				fileBuffer = await readFile(oldPath);
				actualExtension = ext;

				// Delete the old file
				try {
					await unlink(oldPath);
					console.log(`Deleted old local file: ${oldPath}`);
				} catch (error) {
					console.warn(`Could not delete old file: ${oldPath}`, error);
				}
				break;
			}
		}
	}

	// If we found the file, upload it with the new filename
	if (fileBuffer) {
		return await uploadFile(
			fileBuffer,
			newFilename,
			actualExtension,
			actualExtension === 'pdf' ? 'application/pdf' : `image/${actualExtension === 'jpg' ? 'jpeg' : actualExtension}`
		);
	}

	// File not found - this might be okay for new uploads
	return {
		success: true,
		url: getFileUrl(newFilename, extension),
		filename: `${newFilename}.${extension}`,
	};
}

/**
 * Clean up old files with different extensions
 */
export async function cleanupOldFiles(filename: string, keepExtension: string): Promise<void> {
	const extensionsToCheck = ['jpg', 'jpeg', 'png', 'pdf'];

	for (const ext of extensionsToCheck) {
		if (ext === keepExtension) continue;

		await deleteFile(filename, ext);
	}
}

/**
 * Get storage mode for debugging
 */
export function getStorageMode(): string {
	return useGCS ? 'Google Cloud Storage' : 'Local Filesystem';
}
