import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Facebook from 'next-auth/providers/facebook';
import { MySQLAdapter } from './adapter';
import pool from '@/lib/db';
import type { RowDataPacket } from 'mysql2/promise';

// Extend the built-in session types
declare module 'next-auth' {
	interface Session {
		user: {
			id: string;
			email?: string | null;
			name?: string | null;
			image?: string | null;
			household_id: number;
			household_name: string;
			is_admin?: boolean;
		};
	}

	interface User {
		id: string;
		household_id?: number;
		household_name?: string;
		is_admin?: boolean;
	}
}

interface DbUser extends RowDataPacket {
	id: number;
	email: string;
	first_name: string;
	last_name: string;
	household_id: number;
	household_name: string;
	is_admin: boolean;
	profile_image_url: string | null;
}

export const authConfig: NextAuthConfig = {
	adapter: MySQLAdapter(),
	providers: [
		Google({
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		}),
		Facebook({
			clientId: process.env.FACEBOOK_CLIENT_ID!,
			clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
		}),
	],
	pages: {
		signIn: '/auth/signin',
	},
	session: {
		strategy: 'database',
		maxAge: 30 * 24 * 60 * 60, // 30 days
	},
	callbacks: {
		async session({ session, user }) {
			if (session.user) {
				// Get household information from database
				const [rows] = await pool.execute<DbUser[]>(
					`SELECT u.id, u.email, u.first_name, u.last_name,
					        u.household_id, h.name as household_name,
					        u.is_admin, u.profile_image_url
					 FROM users u
					 JOIN households h ON u.household_id = h.id
					 WHERE u.id = ?`,
					[user.id]
				);

				if (rows.length > 0) {
					session.user.id = rows[0].id.toString();
					session.user.email = rows[0].email;
					session.user.name = `${rows[0].first_name} ${rows[0].last_name}`.trim();
					session.user.image = rows[0].profile_image_url ?? null;
					session.user.household_id = rows[0].household_id;
					session.user.household_name = rows[0].household_name;
					session.user.is_admin = Boolean(rows[0].is_admin);
				}
			}
			return session;
		},
	},
};
