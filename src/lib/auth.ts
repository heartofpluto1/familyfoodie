// lib/auth.ts - Authentication utilities
import pool from './db.js';

export interface User {
	id: number;
	username: string;
	email: string;
	first_name: string;
	last_name: string;
	is_active: boolean;
	is_staff: boolean;
	is_superuser: boolean;
}

export interface AuthResult {
	success: boolean;
	user?: User;
	error?: string;
}

// Verify Django's PBKDF2 password
async function verifyDjangoPassword(password: string, hashedPassword: string): Promise<boolean> {
	try {
		// Django format: pbkdf2_sha256$iterations$salt$hash
		const parts = hashedPassword.split('$');
		if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') {
			return false;
		}

		const iterations = parseInt(parts[1]);
		const salt = parts[2];
		const hash = parts[3];

		// Use Node.js crypto to verify PBKDF2
		const crypto = await import('crypto');
		const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
		const derivedHash = derivedKey.toString('base64');

		return derivedHash === hash;
	} catch (error) {
		console.error('Password verification error:', error);
		return false;
	}
}

export async function authenticateUser(username: string, password: string): Promise<AuthResult> {
	try {
		const [rows] = await pool.execute(
			'SELECT id, username, email, first_name, last_name, password, is_active, is_staff, is_superuser FROM auth_user WHERE username = ? AND is_active = 1',
			[username]
		);

		const users = rows as (User & { password: string })[];
		if (users.length === 0) {
			return { success: false, error: 'Invalid username or password' };
		}

		const user = users[0];
		const isValidPassword = await verifyDjangoPassword(password, user.password);

		if (!isValidPassword) {
			return { success: false, error: 'Invalid username or password' };
		}

		// Update last_login
		await pool.execute('UPDATE auth_user SET last_login = NOW() WHERE id = ?', [user.id]);

		// Return user without password
		const { ...userWithoutPassword } = user;
		return {
			success: true,
			user: userWithoutPassword,
		};
	} catch (error) {
		console.error('Authentication error:', error);
		return { success: false, error: 'Authentication failed' };
	}
}
