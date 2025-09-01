/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { createFeedback } from '@/lib/queries/feedback';
import { getServerSession } from 'next-auth';
import { setupConsoleMocks, mockRegularSession } from '@/lib/test-utils';
import type { FeedbackSubmission } from '@/types/feedback';

// Mock next-auth
jest.mock('next-auth', () => ({
	getServerSession: jest.fn(),
}));

// Mock the feedback queries
jest.mock('@/lib/queries/feedback', () => ({
	createFeedback: jest.fn(),
}));

// Type assertions for mocked modules
const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockCreateFeedback = createFeedback as jest.MockedFunction<typeof createFeedback>;

// Test data
const mockFeedbackSubmission: FeedbackSubmission = {
	rating: 5,
	category: 'general',
	message: 'Great app!',
	pageContext: '/dashboard',
	metadata: {
		browserInfo: 'Mozilla/5.0',
		lastActions: ['viewed', 'clicked'],
		timestamp: Date.now(),
	},
};

describe('/api/feedback', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('POST /api/feedback', () => {
		describe('Authentication Tests', () => {
			it('returns 401 for unauthenticated users', async () => {
				mockGetServerSession.mockResolvedValue(null);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(mockFeedbackSubmission),
						});

						expect(response.status).toBe(401);
						const json = await response.json();
						expect(json).toEqual({ error: 'Unauthorized' });
						expect(mockCreateFeedback).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Validation Tests', () => {
			beforeEach(() => {
				mockGetServerSession.mockResolvedValue(mockRegularSession);
			});

			it('returns 400 when pageContext is missing', async () => {
				const invalidSubmission = { ...mockFeedbackSubmission };
				delete (invalidSubmission as Partial<FeedbackSubmission>).pageContext;

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(invalidSubmission),
						});

						expect(response.status).toBe(400);
						const json = await response.json();
						expect(json).toEqual({ error: 'Page context is required' });
						expect(mockCreateFeedback).not.toHaveBeenCalled();
					},
				});
			});

			it('returns 400 when rating is out of range', async () => {
				const invalidSubmission = { ...mockFeedbackSubmission, rating: 6 };

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(invalidSubmission),
						});

						expect(response.status).toBe(400);
						const json = await response.json();
						expect(json).toEqual({ error: 'Rating must be between 1 and 5' });
						expect(mockCreateFeedback).not.toHaveBeenCalled();
					},
				});
			});

			it('returns 400 when message exceeds 5000 characters', async () => {
				const invalidSubmission = {
					...mockFeedbackSubmission,
					message: 'a'.repeat(5001),
				};

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(invalidSubmission),
						});

						expect(response.status).toBe(400);
						const json = await response.json();
						expect(json).toEqual({ error: 'Message must be 5000 characters or less' });
						expect(mockCreateFeedback).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Success Path Tests', () => {
			beforeEach(() => {
				mockGetServerSession.mockResolvedValue(mockRegularSession);
				mockCreateFeedback.mockResolvedValue(123);
			});

			it('successfully creates feedback with all fields', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(mockFeedbackSubmission),
						});

						expect(response.status).toBe(201);
						const json = await response.json();
						expect(json).toEqual({
							success: true,
							id: 123,
							message: 'Thank you for your feedback!',
						});

						expect(mockCreateFeedback).toHaveBeenCalledWith(
							2, // user id from mockRegularSession
							1, // household_id from mockRegularSession
							mockFeedbackSubmission
						);
					},
				});
			});

			it('successfully creates feedback with minimal fields', async () => {
				const minimalSubmission = {
					pageContext: '/home',
				};

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(minimalSubmission),
						});

						expect(response.status).toBe(201);
						const json = await response.json();
						expect(json).toEqual({
							success: true,
							id: 123,
							message: 'Thank you for your feedback!',
						});

						expect(mockCreateFeedback).toHaveBeenCalledWith(2, 1, minimalSubmission);
					},
				});
			});

			it('handles null household_id', async () => {
				const sessionWithoutHousehold = {
					...mockRegularSession,
					user: {
						...mockRegularSession.user,
						household_id: null,
					},
				};
				mockGetServerSession.mockResolvedValue(sessionWithoutHousehold);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(mockFeedbackSubmission),
						});

						expect(response.status).toBe(201);
						expect(mockCreateFeedback).toHaveBeenCalledWith(2, null, mockFeedbackSubmission);
					},
				});
			});
		});

		describe('Error Handling', () => {
			it('returns 500 when database operation fails', async () => {
				mockGetServerSession.mockResolvedValue(mockRegularSession);
				mockCreateFeedback.mockRejectedValue(new Error('Database error'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(mockFeedbackSubmission),
						});

						expect(response.status).toBe(500);
						const json = await response.json();
						expect(json).toEqual({ error: 'Failed to submit feedback' });
					},
				});
			});
		});
	});
});
