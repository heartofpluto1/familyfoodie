// Client-safe utilities for recipe file URLs
// For server-only functions, import from './secureFilename.server'

// Check if we're in production with GCS configured
// Use NEXT_PUBLIC_ prefix to make bucket name available on client side
const bucketName = process.env.NEXT_PUBLIC_GCS_BUCKET_NAME;
const isGCSProduction = process.env.NODE_ENV === 'production' && !!bucketName;

/**
 * Get the correct URL for a recipe file (image or PDF)
 * This is a simplified version that just checks filename format
 * The actual secure filename generation happens server-side
 */
export function getRecipeFileUrl(filename: string | null, extension: 'jpg' | 'pdf' | 'png' | 'jpeg', bustCache?: boolean): string {
	// If no filename stored, return empty
	if (!filename) {
		return '';
	}

	// Check if the file appears to be migrated (32 char hex string)
	const isMigrated = /^[a-f0-9]{32}$/.test(filename);

	// Add cache busting parameter when requested
	const cacheBuster = bustCache ? `?v=${Date.now()}` : '';

	if (isGCSProduction && bucketName && isMigrated) {
		// Production with GCS and migrated file - use GCS URL
		return `https://storage.googleapis.com/${bucketName}/${filename}.${extension}${cacheBuster}`;
	} else {
		// Development or unmigrated files - use local static path
		return `/static/${filename}.${extension}${cacheBuster}`;
	}
}

/**
 * Get image URL for a recipe
 * Client-safe version that defaults to .jpg extension with automatic cache busting
 */
export function getRecipeImageUrl(filename: string | null, bustCache?: boolean): string {
	if (!filename) {
		return '/images/default-recipe.jpg'; // You should add a default image
	}

	// Default to jpg extension for images - always add cache busting to solve cache issues
	const baseUrl = getRecipeFileUrl(filename, 'jpg', bustCache);

	// Always add a static version for cache busting to solve persistent cache issues
	const separator = baseUrl.includes('?') ? '&' : '?';
	return `${baseUrl}${separator}t=v1`;
}

/**
 * Get PDF URL for a recipe
 */
export function getRecipePdfUrl(filename: string | null, bustCache?: boolean): string {
	if (!filename) {
		return '';
	}

	return getRecipeFileUrl(filename, 'pdf', bustCache);
}

/**
 * Get the correct URL for a collection file (image)
 * Uses same logic as recipes but with collections directory
 */
export function getCollectionFileUrl(filename: string | null, extension: 'jpg' | 'png' | 'jpeg', bustCache?: boolean): string {
	// If no filename stored, return empty
	if (!filename) {
		return '';
	}

	// Check if the file appears to be migrated (32 char hex string)
	const isMigrated = /^[a-f0-9]{32}$/.test(filename);

	// Add cache busting parameter when requested
	const cacheBuster = bustCache ? `?v=${Date.now()}` : '';

	if (isGCSProduction && bucketName && isMigrated) {
		// Production with GCS and migrated file - use GCS URL
		return `https://storage.googleapis.com/${bucketName}/collections/${filename}.${extension}${cacheBuster}`;
	} else {
		// Development or unmigrated files - use local collections path
		return `/collections/${filename}.${extension}${cacheBuster}`;
	}
}

/**
 * Get image URL for a collection (light mode)
 * Client-safe version that defaults to .jpg extension with automatic cache busting
 */
export function getCollectionImageUrl(filename: string | null, bustCache?: boolean): string {
	if (!filename) {
		return '/collections/custom_collection_004.jpg'; // Default fallback
	}

	// Default to jpg extension for images - always add cache busting to solve cache issues
	const baseUrl = getCollectionFileUrl(filename, 'jpg', bustCache);

	// Always add a static version for cache busting to solve persistent cache issues
	const separator = baseUrl.includes('?') ? '&' : '?';
	return `${baseUrl}${separator}t=v1`;
}

/**
 * Get dark mode image URL for a collection
 * Client-safe version that defaults to .jpg extension with automatic cache busting
 */
export function getCollectionDarkImageUrl(filename_dark: string | null, bustCache?: boolean): string {
	if (!filename_dark) {
		return '/collections/custom_collection_004_dark.jpg'; // Default dark fallback
	}

	// Default to jpg extension for images - always add cache busting to solve cache issues
	const baseUrl = getCollectionFileUrl(filename_dark, 'jpg', bustCache);

	// Always add a static version for cache busting to solve persistent cache issues
	const separator = baseUrl.includes('?') ? '&' : '?';
	return `${baseUrl}${separator}t=v1`;
}

// Legacy function for backwards compatibility
export function getSecureFileUrl(filename: string, extension: 'jpg' | 'pdf'): string {
	return `/static/${filename}.${extension}`;
}
