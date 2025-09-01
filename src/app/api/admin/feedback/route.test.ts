/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { getFeedback, getFeedbackStats } from '@/lib/queries/feedback';
import { getServerSession } from 'next-auth';
import { setupConsoleMocks, mockAdminSession, mockRegularSession } from '@/lib/test-utils';
import type { Feedback, FeedbackStats } from '@/types/feedback';

// Mock next-auth
jest.mock('next-auth', () => ({
	getServerSession: jest.fn(),
}));

// Mock the feedback queries
jest.mock('@/lib/queries/feedback', () => ({
	getFeedback: jest.fn(),
	getFeedbackStats: jest.fn(),
}));

// Type assertions for mocked modules
const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockGetFeedback = getFeedback as jest.MockedFunction<typeof getFeedback>;
const mockGetFeedbackStats = getFeedbackStats as jest.MockedFunction<typeof getFeedbackStats>;

// Test data

const mockFeedbackList: Feedback[] = [
	{
		id: 1,
		user_id: 1,
		household_id: 1,
		rating: 5,
		category: 'general',
		message: 'Great app!',
		page_context: '/dashboard',
		user_agent: 'Mozilla/5.0',
		metadata: {},
		status: 'new',
		created_at: '2024-01-01T10:00:00Z',
		reviewed_at: null,
		reviewed_by: null,
		admin_notes: null,
		user_email: 'user@example.com',
		user_name: 'John Doe',
	},
	{
		id: 2,
		user_id: 2,
		household_id: 2,
		rating: 3,
		category: 'bug',
		message: 'Found an issue',
		page_context: '/recipes',
		user_agent: 'Chrome/120.0',
		metadata: {},
		status: 'reviewed',
		created_at: '2024-01-02T10:00:00Z',
		reviewed_at: '2024-01-03T10:00:00Z',
		reviewed_by: 1,
		admin_notes: 'Looking into this',
		user_email: 'jane@example.com',
		user_name: 'Jane Smith',
	},
];

const mockStats: FeedbackStats = {
	total: 10,
	new: 3,
	reviewed: 4,
	actioned: 2,
	closed: 1,
	averageRating: 4.2,
	byCategory: {
		general: 5,
		bug: 3,
		feature_request: 2,
		praise: 0,
	},
};

describe('/api/admin/feedback', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('GET /api/admin/feedback', () => {
		describe('Authentication & Authorization Tests', () => {
			it('returns 401 for unauthenticated users', async () => {
				mockGetServerSession.mockResolvedValue(null);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.status).toBe(401);
						const json = await response.json();
						expect(json).toEqual({ error: 'Unauthorized' });
						expect(mockGetFeedback).not.toHaveBeenCalled();
					},
				});
			});

			it('returns 401 for non-admin users', async () => {
				mockGetServerSession.mockResolvedValue(mockRegularSession);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.status).toBe(401);
						const json = await response.json();
						expect(json).toEqual({ error: 'Unauthorized' });
						expect(mockGetFeedback).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Success Path Tests', () => {
			beforeEach(() => {
				mockGetServerSession.mockResolvedValue(mockAdminSession);
				mockGetFeedback.mockResolvedValue(mockFeedbackList);
				mockGetFeedbackStats.mockResolvedValue(mockStats);
			});

			it('returns feedback list without stats for admin', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.status).toBe(200);
						const json = await response.json();
						expect(json).toEqual({
							feedback: mockFeedbackList,
							stats: undefined,
							query: {
								status: undefined,
								category: undefined,
								rating: undefined,
								userId: undefined,
								startDate: undefined,
								endDate: undefined,
								limit: 50,
								offset: 0,
							},
						});

						expect(mockGetFeedback).toHaveBeenCalledWith({
							status: undefined,
							category: undefined,
							rating: undefined,
							userId: undefined,
							startDate: undefined,
							endDate: undefined,
							limit: 50,
							offset: 0,
						});
						expect(mockGetFeedbackStats).not.toHaveBeenCalled();
					},
				});
			});

			it('returns feedback with stats when includeStats=true', async () => {
				await testApiHandler({
					appHandler,
					url: '/api/admin/feedback?includeStats=true',
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const json = await response.json();
						expect(json).toEqual({
							feedback: mockFeedbackList,
							stats: mockStats,
							query: expect.any(Object),
						});

						expect(mockGetFeedbackStats).toHaveBeenCalled();
					},
				});
			});

			it('handles query parameters correctly', async () => {
				await testApiHandler({
					appHandler,
					url: '/api/admin/feedback?status=new&category=bug&rating=5&limit=10&offset=5',
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						await response.json();

						expect(mockGetFeedback).toHaveBeenCalledWith({
							status: 'new',
							category: 'bug',
							rating: 5,
							userId: undefined,
							startDate: undefined,
							endDate: undefined,
							limit: 10,
							offset: 5,
						});
					},
				});
			});

			it('handles date range filters', async () => {
				await testApiHandler({
					appHandler,
					url: '/api/admin/feedback?startDate=2024-01-01&endDate=2024-12-31',
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);

						expect(mockGetFeedback).toHaveBeenCalledWith(
							expect.objectContaining({
								startDate: '2024-01-01',
								endDate: '2024-12-31',
							})
						);
					},
				});
			});

			it('validates and handles invalid numeric parameters', async () => {
				await testApiHandler({
					appHandler,
					url: '/api/admin/feedback?rating=invalid&limit=abc&offset=xyz',
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);

						expect(mockGetFeedback).toHaveBeenCalledWith({
							status: undefined,
							category: undefined,
							rating: undefined, // invalid rating becomes undefined
							userId: undefined,
							startDate: undefined,
							endDate: undefined,
							limit: 50, // invalid limit defaults to 50
							offset: 0, // invalid offset defaults to 0
						});
					},
				});
			});
		});

		describe('Error Handling', () => {
			it('returns 500 when database operation fails', async () => {
				mockGetServerSession.mockResolvedValue(mockAdminSession);
				mockGetFeedback.mockRejectedValue(new Error('Database error'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.status).toBe(500);
						const json = await response.json();
						expect(json).toEqual({ error: 'Failed to fetch feedback' });
					},
				});
			});
		});
	});
});
