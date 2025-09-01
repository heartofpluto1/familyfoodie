import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import pool from '@/lib/db.js';
import { Feedback, FeedbackSubmission, FeedbackQuery, FeedbackStats } from '@/types/feedback';

interface FeedbackRow extends RowDataPacket, Feedback {}

export async function createFeedback(userId: number, householdId: number | null, submission: FeedbackSubmission): Promise<number> {
	const [result] = await pool.execute<ResultSetHeader>(
		`INSERT INTO feedback (
      user_id, household_id, rating, category, message,
      page_context, user_agent, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			userId,
			householdId,
			submission.rating || null,
			submission.category || 'general',
			submission.message || null,
			submission.pageContext,
			submission.metadata?.browserInfo || null,
			JSON.stringify(submission.metadata || {}),
		]
	);
	return result.insertId;
}

export async function getFeedback(query: FeedbackQuery): Promise<Feedback[]> {
	let sql = `
    SELECT 
      f.*,
      u.email as user_email,
      CONCAT(u.first_name, ' ', u.last_name) as user_name
    FROM feedback f
    LEFT JOIN users u ON f.user_id = u.id
    WHERE 1=1
  `;
	const params: (string | number)[] = [];

	if (query.status) {
		sql += ' AND f.status = ?';
		params.push(query.status);
	}

	if (query.category) {
		sql += ' AND f.category = ?';
		params.push(query.category);
	}

	if (query.rating) {
		sql += ' AND f.rating = ?';
		params.push(query.rating);
	}

	if (query.userId) {
		sql += ' AND f.user_id = ?';
		params.push(query.userId);
	}

	if (query.startDate) {
		sql += ' AND f.created_at >= ?';
		params.push(query.startDate);
	}

	if (query.endDate) {
		sql += ' AND f.created_at <= ?';
		params.push(query.endDate);
	}

	sql += ' ORDER BY f.created_at DESC';

	// Use string interpolation for LIMIT/OFFSET as MySQL has issues with prepared statements for these clauses
	// The values are already validated as numbers in the API route
	if (query.limit !== undefined && query.limit > 0) {
		if (query.offset !== undefined && query.offset > 0) {
			sql += ` LIMIT ${query.offset}, ${query.limit}`;
		} else {
			sql += ` LIMIT ${query.limit}`;
		}
	}

	const [rows] = await pool.execute<FeedbackRow[]>(sql, params);
	return rows;
}

export async function getFeedbackById(id: number): Promise<Feedback | null> {
	const [rows] = await pool.execute<FeedbackRow[]>(
		`SELECT 
      f.*,
      u.email as user_email,
      CONCAT(u.first_name, ' ', u.last_name) as user_name
    FROM feedback f
    LEFT JOIN users u ON f.user_id = u.id
    WHERE f.id = ?`,
		[id]
	);
	return rows[0] || null;
}

export async function updateFeedback(
	id: number,
	adminId: number,
	updates: {
		status?: string;
		adminNotes?: string;
	}
): Promise<boolean> {
	const fields: string[] = [];
	const values: (string | number | undefined)[] = [];

	if (updates.status) {
		fields.push('status = ?');
		values.push(updates.status);
	}

	if (updates.adminNotes !== undefined) {
		fields.push('admin_notes = ?');
		values.push(updates.adminNotes);
	}

	if (fields.length === 0) {
		return false;
	}

	fields.push('reviewed_at = NOW()');
	fields.push('reviewed_by = ?');
	values.push(adminId);
	values.push(id);

	const [result] = await pool.execute<ResultSetHeader>(`UPDATE feedback SET ${fields.join(', ')} WHERE id = ?`, values);

	return result.affectedRows > 0;
}

export async function getFeedbackStats(): Promise<FeedbackStats> {
	const [statsRows] = await pool.execute<RowDataPacket[]>(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new,
      SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) as reviewed,
      SUM(CASE WHEN status = 'actioned' THEN 1 ELSE 0 END) as actioned,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
      AVG(rating) as averageRating
    FROM feedback
  `);

	const [categoryRows] = await pool.execute<RowDataPacket[]>(`
    SELECT category, COUNT(*) as count
    FROM feedback
    GROUP BY category
  `);

	const byCategory = categoryRows.reduce(
		(acc: Record<string, number>, row: RowDataPacket) => {
			acc[row.category] = row.count;
			return acc;
		},
		{} as Record<string, number>
	);

	const stats = statsRows[0];
	return {
		total: stats.total || 0,
		new: stats.new || 0,
		reviewed: stats.reviewed || 0,
		actioned: stats.actioned || 0,
		closed: stats.closed || 0,
		averageRating: stats.averageRating,
		byCategory,
	};
}

export async function addFeedbackResponse(feedbackId: number, adminId: number, response: string): Promise<number> {
	const [result] = await pool.execute<ResultSetHeader>(
		`INSERT INTO feedback_responses (feedback_id, admin_id, response)
     VALUES (?, ?, ?)`,
		[feedbackId, adminId, response]
	);
	return result.insertId;
}

export async function deleteFeedback(feedbackId: number): Promise<boolean> {
	const [result] = await pool.execute<ResultSetHeader>('DELETE FROM feedback WHERE id = ?', [feedbackId]);
	return result.affectedRows > 0;
}
