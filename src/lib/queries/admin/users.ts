import pool from '../../db.js';
import type { User, UserUpdate } from '@/types/user';
import type { RowDataPacket } from 'mysql2';

interface UserRow extends RowDataPacket, User {}

export async function getAllUsers(): Promise<User[]> {
	const [users] = await pool.execute<UserRow[]>(`
		SELECT 
			u.id,
			u.username,
			u.first_name,
			u.last_name,
			u.email,
			u.is_active,
			u.is_admin,
			u.date_joined,
			u.last_login,
		FROM users u
		ORDER BY u.date_joined DESC
	`);

	return users;
}

export async function getUserById(userId: number): Promise<User | null> {
	const [users] = await pool.execute<UserRow[]>(
		`
		SELECT 
			u.id,
			u.username,
			u.first_name,
			u.last_name,
			u.email,
			u.is_active,
			u.is_admin,
			u.date_joined,
			u.last_login,
		FROM users u
		WHERE u.id = ?
		`,
		[userId]
	);

	return users[0] || null;
}

export async function updateUser(userId: number, updates: UserUpdate): Promise<void> {
	const fields: string[] = [];
	const values: (string | number)[] = [];

	if (updates.first_name !== undefined) {
		fields.push('first_name = ?');
		values.push(updates.first_name);
	}
	if (updates.last_name !== undefined) {
		fields.push('last_name = ?');
		values.push(updates.last_name);
	}
	if (updates.email !== undefined) {
		fields.push('email = ?');
		values.push(updates.email);
	}
	if (updates.is_active !== undefined) {
		fields.push('is_active = ?');
		values.push(updates.is_active ? 1 : 0);
	}
	if (updates.is_admin !== undefined) {
		fields.push('is_admin = ?');
		values.push(updates.is_admin ? 1 : 0);
	}

	if (fields.length === 0) {
		return;
	}

	values.push(userId);

	await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteUser(userId: number): Promise<void> {
	await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
}

export async function getUserStats(): Promise<{
	total: number;
	active: number;
	admins: number;
}> {
	const [[stats]] = await pool.execute<RowDataPacket[]>(`
		SELECT 
			COUNT(*) as total,
			SUM(is_active) as active,
			SUM(is_admin) as admins
		FROM users
	`);

	return {
		total: stats.total || 0,
		active: stats.active || 0,
		admins: stats.admins || 0,
	};
}
