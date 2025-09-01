import {
	createFeedback,
	getFeedback,
	getFeedbackById,
	updateFeedback,
	getFeedbackStats,
	addFeedbackResponse,
	deleteFeedback,
} from './feedback';
import pool from '@/lib/db.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Mock the database pool
jest.mock('@/lib/db.js');
const mockPool = pool as jest.Mocked<typeof pool>;

describe('Feedback Queries', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('createFeedback', () => {
		it('should create new feedback and return insert id', async () => {
			const mockResult = { insertId: 123, affectedRows: 1 } as ResultSetHeader;
			mockPool.execute.mockResolvedValueOnce([mockResult, []]);

			const result = await createFeedback(1, 2, {
				rating: 5,
				category: 'general',
				message: 'Great app!',
				pageContext: '/dashboard',
				metadata: {
					browserInfo: 'Mozilla/5.0',
					lastActions: ['viewed', 'clicked'],
				},
			});

			expect(result).toBe(123);
			expect(mockPool.execute).toHaveBeenCalledWith(
				expect.stringContaining('INSERT INTO feedback'),
				[1, 2, 5, 'general', 'Great app!', '/dashboard', 'Mozilla/5.0', expect.any(String)]
			);
		});

		it('should handle null optional fields', async () => {
			const mockResult = { insertId: 124, affectedRows: 1 } as ResultSetHeader;
			mockPool.execute.mockResolvedValueOnce([mockResult, []]);

			const result = await createFeedback(1, null, {
				pageContext: '/home',
			});

			expect(result).toBe(124);
			expect(mockPool.execute).toHaveBeenCalledWith(
				expect.stringContaining('INSERT INTO feedback'),
				[1, null, null, 'general', null, '/home', null, '{}']
			);
		});
	});

	describe('getFeedback', () => {
		it('should return filtered feedback with user info', async () => {
			const mockFeedback = [
				{
					id: 1,
					user_id: 1,
					household_id: 2,
					rating: 5,
					category: 'general',
					message: 'Great app!',
					status: 'new',
					created_at: new Date(),
					user_email: 'user@example.com',
					user_name: 'John Doe',
				},
			];

			mockPool.execute.mockResolvedValueOnce([mockFeedback as RowDataPacket[], []]);

			const result = await getFeedback({
				status: 'new',
				limit: 10,
			});

			expect(result).toEqual(mockFeedback);
			expect(mockPool.execute).toHaveBeenCalledWith(
				expect.stringContaining('AND f.status = ?'),
				['new']
			);
			expect(mockPool.execute).toHaveBeenCalledWith(
				expect.stringContaining('LIMIT 10'),
				expect.any(Array)
			);
		});

		it('should handle all filter parameters', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getFeedback({
				status: 'reviewed',
				category: 'bug',
				rating: 3,
				userId: 5,
				startDate: '2024-01-01',
				endDate: '2024-12-31',
				limit: 50,
				offset: 10,
			});

			expect(mockPool.execute).toHaveBeenCalledWith(
				expect.stringContaining('AND f.status = ?'),
				expect.arrayContaining(['reviewed', 'bug', 3, 5, '2024-01-01', '2024-12-31'])
			);
		});

		it('should order by created_at DESC', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getFeedback({});

			expect(mockPool.execute).toHaveBeenCalledWith(
				expect.stringContaining('ORDER BY f.created_at DESC'),
				[]
			);
		});
	});

	describe('getFeedbackById', () => {
		it('should return single feedback item with user info', async () => {
			const mockFeedback = {
				id: 1,
				user_id: 1,
				household_id: 2,
				rating: 5,
				category: 'general',
				message: 'Great app!',
				status: 'new',
				created_at: new Date(),
				user_email: 'user@example.com',
				user_name: 'John Doe',
			};

			mockPool.execute.mockResolvedValueOnce([[mockFeedback] as RowDataPacket[], []]);

			const result = await getFeedbackById(1);

			expect(result).toEqual(mockFeedback);
			expect(mockPool.execute).toHaveBeenCalledWith(
				expect.stringContaining('WHERE f.id = ?'),
				[1]
			);
		});

		it('should return null when feedback not found', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			const result = await getFeedbackById(999);

			expect(result).toBeNull();
		});
	});

	describe('updateFeedback', () => {
		it('should update feedback status and notes', async () => {
			const mockResult = { affectedRows: 1 } as ResultSetHeader;
			mockPool.execute.mockResolvedValueOnce([mockResult, []]);

			const result = await updateFeedback(1, 10, {
				status: 'reviewed',
				adminNotes: 'Looking into this issue',
			});

			expect(result).toBe(true);
			expect(mockPool.execute).toHaveBeenCalledWith(
				expect.stringContaining('UPDATE feedback SET'),
				expect.arrayContaining(['reviewed', 'Looking into this issue', 10, 1])
			);
		});

		it('should update only status when notes not provided', async () => {
			const mockResult = { affectedRows: 1 } as ResultSetHeader;
			mockPool.execute.mockResolvedValueOnce([mockResult, []]);

			const result = await updateFeedback(1, 10, {
				status: 'actioned',
			});

			expect(result).toBe(true);
			expect(mockPool.execute).toHaveBeenCalledWith(
				expect.stringContaining('status = ?'),
				expect.arrayContaining(['actioned', 10, 1])
			);
		});

		it('should return false when no fields to update', async () => {
			const result = await updateFeedback(1, 10, {});

			expect(result).toBe(false);
			expect(mockPool.execute).not.toHaveBeenCalled();
		});

		it('should return false when update fails', async () => {
			const mockResult = { affectedRows: 0 } as ResultSetHeader;
			mockPool.execute.mockResolvedValueOnce([mockResult, []]);

			const result = await updateFeedback(999, 10, {
				status: 'reviewed',
			});

			expect(result).toBe(false);
		});
	});

	describe('getFeedbackStats', () => {
		it('should return aggregated feedback statistics', async () => {
			const mockStats = [
				{
					total: 100,
					new: 20,
					reviewed: 30,
					actioned: 40,
					closed: 10,
					averageRating: 4.2,
				},
			];

			const mockCategories = [
				{ category: 'general', count: 50 },
				{ category: 'bug', count: 30 },
				{ category: 'feature_request', count: 20 },
			];

			mockPool.execute
				.mockResolvedValueOnce([mockStats as RowDataPacket[], []])
				.mockResolvedValueOnce([mockCategories as RowDataPacket[], []]);

			const result = await getFeedbackStats();

			expect(result).toEqual({
				total: 100,
				new: 20,
				reviewed: 30,
				actioned: 40,
				closed: 10,
				averageRating: 4.2,
				byCategory: {
					general: 50,
					bug: 30,
					feature_request: 20,
				},
			});
		});

		it('should handle empty stats', async () => {
			const mockStats = [
				{
					total: null,
					new: null,
					reviewed: null,
					actioned: null,
					closed: null,
					averageRating: null,
				},
			];

			mockPool.execute
				.mockResolvedValueOnce([mockStats as RowDataPacket[], []])
				.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			const result = await getFeedbackStats();

			expect(result).toEqual({
				total: 0,
				new: 0,
				reviewed: 0,
				actioned: 0,
				closed: 0,
				averageRating: null,
				byCategory: {},
			});
		});
	});

	describe('addFeedbackResponse', () => {
		it('should add admin response and return insert id', async () => {
			const mockResult = { insertId: 456, affectedRows: 1 } as ResultSetHeader;
			mockPool.execute.mockResolvedValueOnce([mockResult, []]);

			const result = await addFeedbackResponse(1, 10, 'We are looking into this issue');

			expect(result).toBe(456);
			expect(mockPool.execute).toHaveBeenCalledWith(
				expect.stringContaining('INSERT INTO feedback_responses'),
				[1, 10, 'We are looking into this issue']
			);
		});
	});

	describe('deleteFeedback', () => {
		it('should delete feedback and return true on success', async () => {
			const mockResult = { affectedRows: 1 } as ResultSetHeader;
			mockPool.execute.mockResolvedValueOnce([mockResult, []]);

			const result = await deleteFeedback(1);

			expect(result).toBe(true);
			expect(mockPool.execute).toHaveBeenCalledWith('DELETE FROM feedback WHERE id = ?', [1]);
		});

		it('should return false when feedback not found', async () => {
			const mockResult = { affectedRows: 0 } as ResultSetHeader;
			mockPool.execute.mockResolvedValueOnce([mockResult, []]);

			const result = await deleteFeedback(999);

			expect(result).toBe(false);
		});
	});
});