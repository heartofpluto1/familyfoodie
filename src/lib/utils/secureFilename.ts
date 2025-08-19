// Client-safe utilities for recipe file URLs
// For server-only functions, import from './secureFilename.server'
import { addToast } from '@/lib/toast';

// Check if we're in production with GCS configured
const bucketName = process.env.GCS_BUCKET_NAME;
const isGCSProduction = process.env.NODE_ENV === 'production' && !!bucketName;

/**
 * Get the correct URL for a recipe file (image or PDF)
 * This is a simplified version that just checks filename format
 * The actual secure filename generation happens server-side
 */
export function getRecipeFileUrl(filename: string | null, extension: 'jpg' | 'pdf' | 'png' | 'jpeg'): string {
	// If no filename stored, return empty
	if (!filename) {
		return '';
	}

	// Check if the file appears to be migrated (32 char hex string)
	const isMigrated = /^[a-f0-9]{32}$/.test(filename);

	// Add debugging toast - always show this in production to diagnose
	addToast(
		'info',
		'URL Debug',
		`File: ${filename} | NODE_ENV: ${process.env.NODE_ENV} | isGCSProd: ${isGCSProduction} | bucket: ${bucketName} | isMigrated: ${isMigrated}`
	);
	console.error(
		'URL Debug',
		`File: ${filename} | NODE_ENV: ${process.env.NODE_ENV} | isGCSProd: ${isGCSProduction} | bucket: ${bucketName} | isMigrated: ${isMigrated}`
	);

	if (isGCSProduction && bucketName && isMigrated) {
		// Production with GCS and migrated file - use GCS URL
		const gcsUrl = `https://storage.googleapis.com/${bucketName}/${filename}.${extension}`;
		addToast('success', 'Using GCS URL', gcsUrl);
		console.log('Using GCS URL', gcsUrl);
		return gcsUrl;
	} else {
		// Development or unmigrated files - use local static path
		const staticUrl = `/static/${filename}.${extension}`;
		const reason = !isGCSProduction ? 'GCS not in production' : !bucketName ? 'No bucket name' : !isMigrated ? 'File not migrated' : 'Unknown reason';
		addToast('warning', 'Using Static URL', `${staticUrl} | Reason: ${reason}`);
		console.error('Using Static URL', `${staticUrl} | Reason: ${reason}`);
		return staticUrl;
	}
}

/**
 * Get image URL for a recipe
 * Client-safe version that defaults to .jpg extension
 */
export function getRecipeImageUrl(filename: string | null): string {
	if (!filename) {
		return '/images/default-recipe.jpg'; // You should add a default image
	}

	// Default to jpg extension for images
	// Server-side code handles checking for actual file extensions
	return getRecipeFileUrl(filename, 'jpg');
}

/**
 * Get PDF URL for a recipe
 */
export function getRecipePdfUrl(filename: string | null): string {
	if (!filename) {
		return '';
	}

	return getRecipeFileUrl(filename, 'pdf');
}

// Legacy function for backwards compatibility
export function getSecureFileUrl(filename: string, extension: 'jpg' | 'pdf'): string {
	return `/static/${filename}.${extension}`;
}
