import { createHmac } from 'crypto';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Server-only: Generate secure filename hash
 */
export function generateSecureFilename(recipeId: number, recipeName: string): string {
	const SECRET_KEY = process.env.FILENAME_SECRET;

	if (!SECRET_KEY) {
		throw new Error('FILENAME_SECRET environment variable is not set');
	}

	// Create a consistent input for hashing
	const input = `${recipeId}-${recipeName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

	// Generate HMAC-SHA256 hash
	const hash = createHmac('sha256', SECRET_KEY).update(input).digest('hex');

	// Use first 16 characters of hash for filename
	return hash.substring(0, 16);
}

/**
 * Server-only: Check if a recipe file exists (for server-side checking)
 */
export function checkRecipeFileExists(filename: string, extension: string): boolean {
	const staticDir = path.join(process.cwd(), 'public', 'static');
	const filePath = path.join(staticDir, `${filename}.${extension}`);
	return existsSync(filePath);
}
