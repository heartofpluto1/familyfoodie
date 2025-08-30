import type { Adapter, AdapterUser } from 'next-auth/adapters';
import pool from '@/lib/db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { Account } from 'next-auth';

interface DbUser extends RowDataPacket {
	id: number;
	email: string;
	first_name: string;
	last_name: string;
	household_id: number;
	oauth_provider: string;
	oauth_provider_id: string;
	email_verified: boolean;
	profile_image_url: string | null;
	is_admin: boolean;
	is_active: boolean;
}

export function MySQLAdapter(): Adapter {
	return {
		async createUser(user: Omit<AdapterUser, 'id'>) {
			const connection = await pool.getConnection();
			try {
				await connection.beginTransaction();

				// Check if user already exists (by email)
				const [existingUsers] = await connection.execute<DbUser[]>('SELECT * FROM users WHERE email = ?', [user.email]);

				if (existingUsers.length > 0) {
					// User exists - update their OAuth info and profile image for first-time OAuth login
					const existingUser = existingUsers[0];
					
					// Only update if they don't already have OAuth credentials
					if (!existingUser.oauth_provider || existingUser.oauth_provider === 'pending') {
						await connection.execute(
							'UPDATE users SET oauth_provider = ?, oauth_provider_id = ?, profile_image_url = ?, email_verified = 1, updated_at = NOW() WHERE id = ?',
							['google', 'pending', user.image, existingUser.id]
						);
					}

					await connection.commit();
					const result = {
						id: existingUser.id.toString(),
						email: existingUser.email,
						name: `${existingUser.first_name} ${existingUser.last_name}`.trim(),
						image: user.image || existingUser.profile_image_url,
						emailVerified: existingUser.email_verified ? new Date() : null,
					};
					return result;
				}

				// Check for pending invitation
				const [invitations] = await connection.execute<RowDataPacket[]>(
					`SELECT household_id FROM household_invitations 
           WHERE email = ? AND expires_at > NOW() AND accepted_at IS NULL 
           ORDER BY created_at DESC LIMIT 1`,
					[user.email]
				);

				let householdId: number;

				if (invitations.length > 0) {
					// User has invitation, use that household
					householdId = invitations[0].household_id;

					// Mark invitation as accepted
					await connection.execute('UPDATE household_invitations SET accepted_at = NOW() WHERE email = ? AND household_id = ?', [user.email, householdId]);
				} else {
					// Extract name parts to get last name for household
					const nameParts = (user.name || '').split(' ');
					const lastName = nameParts.slice(1).join(' ') || nameParts[0] || user.email?.split('@')[0] || 'Household';
					
					// Create new household for user with just last name
					const [householdResult] = await connection.execute<ResultSetHeader>('INSERT INTO households (name) VALUES (?)', [
						lastName,
					]);
					householdId = householdResult.insertId;

					// Auto-subscribe to default collection (id=1)
					await connection.execute('INSERT IGNORE INTO collection_subscriptions (household_id, collection_id) VALUES (?, 1)', [householdId]);
				}

				// Create user
				const nameParts = (user.name || '').split(' ');
				const firstName = nameParts[0] || '';
				const lastName = nameParts.slice(1).join(' ') || '';

				// For new users, we'll update oauth details when they're linked via linkAccount
				const [userResult] = await connection.execute<ResultSetHeader>(
					`INSERT INTO users (
            email, first_name, last_name, 
            household_id, email_verified, profile_image_url,
            oauth_provider, oauth_provider_id,
            is_admin, is_active, date_joined
          ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 'pending', 0, 1, NOW())`,
					[user.email, firstName, lastName, householdId, user.emailVerified ? 1 : 0, user.image]
				);

				await connection.commit();

				return {
					id: userResult.insertId.toString(),
					email: user.email!,
					name: user.name,
					image: user.image,
					emailVerified: user.emailVerified,
				};
			} catch (error) {
				await connection.rollback();
				throw error;
			} finally {
				connection.release();
			}
		},

		async getUser(id) {
			const [users] = await pool.execute<DbUser[]>('SELECT * FROM users WHERE id = ?', [id]);

			if (users.length === 0) return null;

			const user = users[0];
			return {
				id: user.id.toString(),
				email: user.email,
				name: `${user.first_name} ${user.last_name}`.trim(),
				image: user.profile_image_url,
				emailVerified: user.email_verified ? new Date() : null,
			};
		},

		async getUserByEmail(email) {
			const [users] = await pool.execute<DbUser[]>('SELECT * FROM users WHERE email = ?', [email]);

			if (users.length === 0) {
				return null;
			}

			const user = users[0];
			
			// If user has pending OAuth credentials, treat them as non-OAuth user for NextAuth
			if (user.oauth_provider && user.oauth_provider_id === 'pending') {
				return null;
			}

			return {
				id: user.id.toString(),
				email: user.email,
				name: `${user.first_name} ${user.last_name}`.trim(),
				image: user.profile_image_url,
				emailVerified: user.email_verified ? new Date() : null,
			};
		},

		async getUserByAccount({ provider, providerAccountId }) {
			
			// First check users table directly for OAuth provider info
			const [directUsers] = await pool.execute<DbUser[]>('SELECT * FROM users WHERE oauth_provider = ? AND oauth_provider_id = ?', [
				provider,
				providerAccountId,
			]);

			if (directUsers.length > 0) {
				const user = directUsers[0];
				// Don't return users with pending OAuth IDs - let NextAuth link them properly
				if (user.oauth_provider_id === 'pending') {
					return null;
				}
				return {
					id: user.id.toString(),
					email: user.email,
					name: `${user.first_name} ${user.last_name}`.trim(),
					image: user.profile_image_url,
					emailVerified: user.email_verified ? new Date() : null,
				};
			}


			// Fallback to checking nextauth_accounts table
			const [users] = await pool.execute<DbUser[]>(
				`SELECT u.* FROM users u
         JOIN nextauth_accounts a ON u.id = a.user_id
         WHERE a.provider = ? AND a.provider_account_id = ?`,
				[provider, providerAccountId]
			);

			if (users.length === 0) return null;

			const user = users[0];
			return {
				id: user.id.toString(),
				email: user.email,
				name: `${user.first_name} ${user.last_name}`.trim(),
				image: user.profile_image_url,
				emailVerified: user.email_verified ? new Date() : null,
			};
		},

		async updateUser(user) {
			const updates: string[] = [];
			const values: (string | number | null)[] = [];

			if (user.name !== undefined) {
				const nameParts = user.name ? user.name.split(' ') : ['', ''];
				updates.push('first_name = ?', 'last_name = ?');
				values.push(nameParts[0] || '', nameParts.slice(1).join(' ') || '');
			}

			if (user.email !== undefined) {
				updates.push('email = ?');
				values.push(user.email);
			}

			if (user.image !== undefined) {
				updates.push('profile_image_url = ?');
				values.push(user.image);
			}

			if (user.emailVerified !== undefined) {
				updates.push('email_verified = ?');
				values.push(user.emailVerified ? 1 : 0);
			}

			if (updates.length > 0) {
				values.push(user.id);
				await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
			}

			return {
				id: user.id,
				email: user.email || '',
				name: user.name ?? undefined,
				image: user.image ?? undefined,
				emailVerified: user.emailVerified ?? null,
			} as AdapterUser;
		},

		async linkAccount(account: Account) {
			// Check if this is a placeholder account that needs linking
			const [users] = await pool.execute<DbUser[]>('SELECT * FROM users WHERE id = ?', [account.userId]);

			if (users.length > 0) {
				const user = users[0];

				// Check if this is pending OAuth setup
				if (user.oauth_provider_id === 'pending') {
					// This is an existing user's first OAuth login - update their OAuth details
					await pool.execute('UPDATE users SET oauth_provider = ?, oauth_provider_id = ?, email_verified = 1 WHERE id = ?', [
						account.provider,
						account.providerAccountId,
						account.userId,
					]);
				} else if (user.oauth_provider === 'pending') {
					// This is a new user created via createUser - update their OAuth details
					await pool.execute('UPDATE users SET oauth_provider = ?, oauth_provider_id = ? WHERE id = ?', [
						account.provider,
						account.providerAccountId,
						account.userId,
					]);
				}
			}

			// Still store in nextauth_accounts for session management
			// Convert undefined to null for MySQL
			await pool.execute(
				`INSERT INTO nextauth_accounts (
          user_id, type, provider, provider_account_id,
          refresh_token, access_token, expires_at, token_type,
          scope, id_token, session_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					account.userId,
					account.type,
					account.provider,
					account.providerAccountId,
					account.refresh_token ?? null,
					account.access_token ?? null,
					account.expires_at ?? null,
					account.token_type ?? null,
					account.scope ?? null,
					account.id_token ?? null,
					account.session_state ?? null,
				]
			);
		},

		async unlinkAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
			await pool.execute('DELETE FROM nextauth_accounts WHERE provider = ? AND provider_account_id = ?', [provider, providerAccountId]);
		},

		async createSession({ sessionToken, userId, expires }) {
			await pool.execute('INSERT INTO nextauth_sessions (session_token, user_id, expires) VALUES (?, ?, ?)', [sessionToken, userId, expires]);
			return { sessionToken, userId, expires };
		},

		async getSessionAndUser(sessionToken) {
			const [rows] = await pool.execute<RowDataPacket[]>(
				`SELECT 
          s.session_token, s.user_id, s.expires,
          u.id, u.email, u.first_name, u.last_name, 
          u.email_verified, u.profile_image_url,
          u.household_id, h.name as household_name
         FROM nextauth_sessions s
         JOIN users u ON s.user_id = u.id
         JOIN households h ON u.household_id = h.id
         WHERE s.session_token = ? AND s.expires > NOW()`,
				[sessionToken]
			);

			if (rows.length === 0) return null;

			const row = rows[0];
			return {
				session: {
					sessionToken: row.session_token,
					userId: row.user_id.toString(),
					expires: row.expires,
				},
				user: {
					id: row.id.toString(),
					email: row.email,
					name: `${row.first_name} ${row.last_name}`.trim(),
					image: row.profile_image_url,
					emailVerified: row.email_verified ? new Date() : null,
				},
			};
		},

		async updateSession({ sessionToken }) {
			const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM nextauth_sessions WHERE session_token = ?', [sessionToken]);

			if (rows.length === 0) return null;

			return {
				sessionToken: rows[0].session_token,
				userId: rows[0].user_id.toString(),
				expires: rows[0].expires,
			};
		},

		async deleteSession(sessionToken) {
			await pool.execute('DELETE FROM nextauth_sessions WHERE session_token = ?', [sessionToken]);
		},

		async deleteUser(userId) {
			const connection = await pool.getConnection();
			try {
				await connection.beginTransaction();

				// Get user's household
				const [users] = await connection.execute<DbUser[]>('SELECT household_id FROM users WHERE id = ?', [userId]);

				if (users.length > 0) {
					const householdId = users[0].household_id;

					// Check if user is only member
					const [members] = await connection.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM users WHERE household_id = ?', [householdId]);

					// Delete user
					await connection.execute('DELETE FROM users WHERE id = ?', [userId]);

					// If they were the only member, delete household
					if (members[0].count === 1) {
						await connection.execute('DELETE FROM households WHERE id = ?', [householdId]);
					}
				}

				await connection.commit();
			} catch (error) {
				await connection.rollback();
				throw error;
			} finally {
				connection.release();
			}
		},

		// These are required by the adapter interface but not used in our setup
		async createVerificationToken({ identifier, expires, token }) {
			return { identifier, expires, token };
		},
		async useVerificationToken() {
			return null;
		},
	};
}
