// app/lib/session.ts
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

// Make sure to set this in your .env.local file
const SECRET_KEY = process.env.SESSION_SECRET_KEY;

// Only validate the key if we're in runtime, not build time
const isRuntime = typeof process !== 'undefined' && process.env.NODE_ENV;
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

if (isRuntime && !isBuildTime) {
	if (!SECRET_KEY) {
		console.warn('SESSION_SECRET_KEY not set - authentication will not work in production');
	} else if (SECRET_KEY.length !== 64) {
		throw new Error('SESSION_SECRET_KEY must be a 64-character hex string. Generate one with: openssl rand -hex 32');
	}
}

// Convert hex string to buffer
const key = SECRET_KEY && SECRET_KEY.length === 64 ? Buffer.from(SECRET_KEY, 'hex') : null;

export function encrypt(text: string): string {
	if (!key) {
		throw new Error('SESSION_SECRET_KEY not available or invalid');
	}

	try {
		// Generate a random initialization vector
		const iv = randomBytes(16);

		// Create cipher
		const cipher = createCipheriv('aes-256-gcm', key, iv);

		// Encrypt the text
		let encrypted = cipher.update(text, 'utf8', 'hex');
		encrypted += cipher.final('hex');

		// Get the authentication tag
		const authTag = cipher.getAuthTag();

		// Combine iv, authTag, and encrypted data
		const result = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;

		return result;
	} catch (error) {
		console.error('Encryption error:', error);
		throw new Error('Failed to encrypt session data');
	}
}

export function decrypt(encryptedText: string): string {
	if (!key) {
		throw new Error('SESSION_SECRET_KEY not available or invalid');
	}

	try {
		// Split the encrypted text
		const parts = encryptedText.split(':');
		if (parts.length !== 3) {
			throw new Error('Invalid encrypted data format');
		}

		const iv = Buffer.from(parts[0], 'hex');
		const authTag = Buffer.from(parts[1], 'hex');
		const encrypted = parts[2];

		// Create decipher
		const decipher = createDecipheriv('aes-256-gcm', key, iv);
		decipher.setAuthTag(authTag);

		// Decrypt the text
		let decrypted = decipher.update(encrypted, 'hex', 'utf8');
		decrypted += decipher.final('utf8');

		return decrypted;
	} catch (error) {
		console.error('Decryption error:', error);
		throw new Error('Failed to decrypt session data');
	}
}

// Get session data from cookies
export async function getSession() {
	// Return null during build time when cookies aren't available
	if (isBuildTime || !key) {
		return null;
	}

	try {
		const { cookies } = await import('next/headers');
		const cookieStore = await cookies();
		const sessionCookie = cookieStore.get('session');

		if (!sessionCookie?.value) {
			return null;
		}

		const sessionData = decrypt(sessionCookie.value);
		return JSON.parse(sessionData);
	} catch (error) {
		console.error('Session verification error:', error);
		return null;
	}
}

export async function getEncryptedSession() {
	// Return null during build time when cookies aren't available
	if (isBuildTime || !key) {
		return null;
	}

	try {
		const { cookies } = await import('next/headers');
		const cookieStore = await cookies();
		const sessionCookie = cookieStore.get('session');

		if (!sessionCookie?.value) {
			return null;
		}

		return sessionCookie.value;
	} catch (error) {
		console.error('Session verification error:', error);
		return null;
	}
}

// Helper to require authentication (throws error if not authenticated)
export async function requireAuth() {
	const session = await getSession();
	if (!session) {
		throw new Error('Authentication required');
	}
	return session;
}
