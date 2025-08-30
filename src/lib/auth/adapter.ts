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
	oauth_provider: string | null;
	oauth_provider_id: string | null;
	email_verified: boolean;
	profile_image_url: string | null;
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
					// User exists, return existing user
					const existingUser = existingUsers[0];
					await connection.commit();
					return {
						id: existingUser.id.toString(),
						email: existingUser.email,
						name: `${existingUser.first_name} ${existingUser.last_name}`.trim(),
						image: existingUser.profile_image_url,
						emailVerified: existingUser.email_verified ? new Date() : null,
					};
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
					// Create new household for user
					const [householdResult] = await connection.execute<ResultSetHeader>('INSERT INTO households (name) VALUES (?)', [
						`${user.name || user.email}'s Household`,
					]);
					householdId = householdResult.insertId;

					// Auto-subscribe to default collection (id=1)
					await connection.execute('INSERT IGNORE INTO collection_subscriptions (household_id, collection_id) VALUES (?, 1)', [householdId]);
				}

				// Create user
				const nameParts = (user.name || '').split(' ');
				const firstName = nameParts[0] || '';
				const lastName = nameParts.slice(1).join(' ') || '';

				const [userResult] = await connection.execute<ResultSetHeader>(
					`INSERT INTO users (
            username, email, first_name, last_name, 
            household_id, email_verified, profile_image_url,
            is_admin, is_active, date_joined, password
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, NOW(), NULL)`,
					[user.email, user.email, firstName, lastName, householdId, user.emailVerified ? 1 : 0, user.image]
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

		async getUserByAccount({ provider, providerAccountId }) {
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
					account.refresh_token,
					account.access_token,
					account.expires_at,
					account.token_type,
					account.scope,
					account.id_token,
					account.session_state,
				]
			);

			// Update user with OAuth provider info
			await pool.execute('UPDATE users SET oauth_provider = ?, oauth_provider_id = ? WHERE id = ?', [
				account.provider,
				account.providerAccountId,
				account.userId,
			]);
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
