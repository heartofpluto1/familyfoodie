import { createHmac } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

/**
 * Server-only: Generate secure filename hash for collections
 */
export function generateCollectionSecureFilename(collectionId: number, collectionTitle: string): string {
	const SECRET_KEY = process.env.FILENAME_SECRET;

	if (!SECRET_KEY) {
		throw new Error('FILENAME_SECRET environment variable is not set');
	}

	// Create a consistent input for hashing
	const input = `${collectionId}-${collectionTitle.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

	// Generate HMAC-SHA256 hash
	const hash = createHmac('sha256', SECRET_KEY).update(input).digest('hex');

	// Use first 32 characters of hash for filename
	return hash.substring(0, 32);
}

/**
 * Server-only: Ensure collections directory exists and return path
 */
export function ensureCollectionsDirectory(): string {
	const collectionsDir = path.join(process.cwd(), 'public', 'collections');

	if (!existsSync(collectionsDir)) {
		mkdirSync(collectionsDir, { recursive: true });
	}

	return collectionsDir;
}

/**
 * Server-only: Check if a collection file exists
 */
export function checkCollectionFileExists(filename: string, extension: string): boolean {
	const collectionsDir = path.join(process.cwd(), 'public', 'collections');
	const filePath = path.join(collectionsDir, `${filename}.${extension}`);
	return existsSync(filePath);
}
