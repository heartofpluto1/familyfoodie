// Client-safe utilities for recipe file URLs
// For server-only functions, import from './secureFilename.server'

// Check if we're in production with GCS configured
// Use NEXT_PUBLIC_ prefix to make bucket name available on client side
const bucketName = process.env.NEXT_PUBLIC_GCS_BUCKET_NAME;
const isGCSProduction = process.env.NODE_ENV === 'production' && !!bucketName;

/**
 * Get the correct URL for a recipe file (image or PDF)
 * This handles both versioned filenames with extensions and legacy format
 */
export function getRecipeFileUrl(filename: string | null): string {
	// If no filename stored, return empty
	if (!filename) {
		return '';
	}

	// Extract base filename (without extension) to check if migrated
	// Handle both legacy format (hash only) and new format (hash.ext or hash_v2.ext)
	const baseFilename = filename.includes('.') ? filename.split('.')[0] : filename;
	const baseHash = baseFilename.includes('_v') ? baseFilename.split('_v')[0] : baseFilename;

	// Check if the file appears to be migrated (32 char hex string)
	const isMigrated = /^[a-f0-9]{32}$/.test(baseHash);

	if (isGCSProduction && bucketName && isMigrated) {
		// Production with GCS and migrated file - use GCS URL
		return `https://storage.googleapis.com/${bucketName}/${filename}`;
	} else {
		// Development or unmigrated files - use local static path
		return `/static/${filename}`;
	}
}

/**
 * Get image URL for a recipe
 * Now takes complete filename with extension
 */
export function getRecipeImageUrl(filename: string | null): string {
	if (!filename) {
		return '/images/default-recipe.jpg'; // You should add a default image
	}

	return getRecipeFileUrl(filename);
}

/**
 * Get PDF URL for a recipe
 * Now takes complete filename with extension
 */
export function getRecipePdfUrl(filename: string | null): string {
	if (!filename) {
		return '';
	}

	return getRecipeFileUrl(filename);
}

/**
 * Get the correct URL for a collection file (image)
 * Uses same logic as recipes but with collections directory
 */
export function getCollectionFileUrl(filename: string | null, extension: 'jpg' | 'png' | 'jpeg'): string {
	// If no filename stored, return empty
	if (!filename) {
		return '';
	}

	// Check if the file appears to be migrated (32 char hex string)
	const isMigrated = /^[a-f0-9]{32}$/.test(filename);

	if (isGCSProduction && bucketName && isMigrated) {
		// Production with GCS and migrated file - use GCS URL
		return `https://storage.googleapis.com/${bucketName}/collections/${filename}.${extension}`;
	} else {
		// Development or unmigrated files - use local collections path
		return `/collections/${filename}.${extension}`;
	}
}

/**
 * Get image URL for a collection (light mode)
 * Client-safe version that defaults to .jpg extension
 */
export function getCollectionImageUrl(filename: string | null): string {
	if (!filename) {
		return '/collections/custom_collection_004.jpg'; // Default fallback
	}

	// Default to jpg extension for images
	return getCollectionFileUrl(filename, 'jpg');
}

/**
 * Get dark mode image URL for a collection
 * Client-safe version that defaults to .jpg extension
 */
export function getCollectionDarkImageUrl(filename_dark: string | null): string {
	if (!filename_dark) {
		return '/collections/custom_collection_004_dark.jpg'; // Default dark fallback
	}

	// Default to jpg extension for images
	return getCollectionFileUrl(filename_dark, 'jpg');
}

// Legacy function for backwards compatibility
export function getSecureFileUrl(filename: string, extension: 'jpg' | 'pdf'): string {
	return `/static/${filename}.${extension}`;
}

/**
 * Generate a versioned filename for file updates
 * Parses existing filename and increments version number
 */
export function generateVersionedFilename(currentFilename: string | null, newExtension: string): string {
	if (!currentFilename) {
		// If no current filename, generate a new hash-based filename
		const timestamp = Date.now().toString();
		const hash = Array.from(timestamp)
			.map(char => char.charCodeAt(0).toString(16))
			.join('')
			.padStart(32, '0')
			.slice(0, 32);
		return `${hash}.${newExtension}`;
	}

	// Parse current filename to extract base hash and version
	const [filenamePart] = currentFilename.includes('.') ? currentFilename.split('.') : [currentFilename, newExtension];

	// Check if filename has version suffix (_v2, _v3, etc.)
	const versionMatch = filenamePart.match(/^([a-f0-9]+)_v(\d+)$/);

	if (versionMatch) {
		// Has version - increment it
		const [, baseHash, versionStr] = versionMatch;
		const nextVersion = parseInt(versionStr) + 1;
		return `${baseHash}_v${nextVersion}.${newExtension}`;
	} else {
		// No version suffix - this is v1, so create v2
		return `${filenamePart}_v2.${newExtension}`;
	}
}

/**
 * Extract the base hash from a filename (removing version and extension)
 */
export function getBaseHash(filename: string): string {
	if (!filename) return '';

	// Remove extension
	const filenamePart = filename.includes('.') ? filename.split('.')[0] : filename;

	// Remove version suffix if present
	const versionMatch = filenamePart.match(/^([a-f0-9]+)_v\d+$/);
	return versionMatch ? versionMatch[1] : filenamePart;
}

/**
 * Extract base hash for defensive file cleanup (more robust version)
 * Handles various filename formats that might exist in storage
 */
export function extractBaseHash(filename: string | null): string {
	if (!filename) return '';

	// Remove extension first
	const nameWithoutExt = filename.includes('.') ? filename.split('.')[0] : filename;

	// Match hash pattern with optional version suffix: hash or hash_v2, hash_v3, etc.
	const hashMatch = nameWithoutExt.match(/^([a-f0-9]{8,32})(?:_v\d+)?$/);
	return hashMatch ? hashMatch[1] : '';
}

/**
 * Get the version number from a filename (returns 1 if no version suffix)
 */
export function getVersionFromFilename(filename: string): number {
	if (!filename) return 1;

	const filenamePart = filename.includes('.') ? filename.split('.')[0] : filename;
	const versionMatch = filenamePart.match(/_v(\d+)$/);
	return versionMatch ? parseInt(versionMatch[1]) : 1;
}

/**
 * Get the file extension from a filename
 */
export function getFileExtension(filename: string): string {
	if (!filename || !filename.includes('.')) return '';
	return filename.split('.').pop() || '';
}

/**
 * Find and delete all files matching a base hash pattern
 * Supports both local filesystem and cloud storage cleanup
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

	try {
		// If custom storage cleanup function provided (for GCS, etc.)
		if (storageCleanup) {
			for (const ext of extensions) {
				const pattern = `${baseHash}*.${ext}`; // Matches hash.ext and hash_v*.ext
				const deleted = await storageCleanup(pattern);
				deletedFiles.push(...deleted);
			}
			return deletedFiles;
		}

		// Local filesystem cleanup
		const fs = await import('fs/promises');
		const path = await import('path');
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
						console.log(`Deleted old file: ${file}`);
					} catch (error) {
						console.warn(`Could not delete file: ${file}`, error);
						// Continue with other files, don't fail the entire operation
					}
				}
			}
		}
	} catch (error) {
		console.error('Error during file cleanup:', error);
		// Return partial results, don't throw - cleanup is defensive
	}

	return deletedFiles;
}
