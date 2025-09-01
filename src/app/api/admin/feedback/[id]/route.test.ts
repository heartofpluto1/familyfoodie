/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { getFeedbackById, updateFeedback, deleteFeedback, addFeedbackResponse } from '@/lib/queries/feedback';
import { getServerSession } from 'next-auth';
import { setupConsoleMocks, mockAdminSession, mockRegularSession } from '@/lib/test-utils';
import type { Feedback } from '@/types/feedback';

// Mock next-auth
jest.mock('next-auth', () => ({
	getServerSession: jest.fn(),
}));

// Mock the feedback queries
jest.mock('@/lib/queries/feedback', () => ({
	getFeedbackById: jest.fn(),
	updateFeedback: jest.fn(),
	deleteFeedback: jest.fn(),
	addFeedbackResponse: jest.fn(),
}));

// Type assertions for mocked modules
const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockGetFeedbackById = getFeedbackById as jest.MockedFunction<typeof getFeedbackById>;
const mockUpdateFeedback = updateFeedback as jest.MockedFunction<typeof updateFeedback>;
const mockDeleteFeedback = deleteFeedback as jest.MockedFunction<typeof deleteFeedback>;
const mockAddFeedbackResponse = addFeedbackResponse as jest.MockedFunction<typeof addFeedbackResponse>;

// Test data
const mockFeedback: Feedback = {
	id: 1,
	user_id: 2,
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
};

describe('/api/admin/feedback/[id]', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('GET /api/admin/feedback/[id]', () => {
		describe('Authentication & Authorization Tests', () => {
			it('returns 401 for unauthenticated users', async () => {
				mockGetServerSession.mockResolvedValue(null);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.status).toBe(401);
						const json = await response.json();
						expect(json).toEqual({ error: 'Unauthorized' });
						expect(mockGetFeedbackById).not.toHaveBeenCalled();
					},
				});
			});

			it('returns 401 for non-admin users', async () => {
				mockGetServerSession.mockResolvedValue(mockRegularSession);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.status).toBe(401);
						const json = await response.json();
						expect(json).toEqual({ error: 'Unauthorized' });
						expect(mockGetFeedbackById).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Validation Tests', () => {
			beforeEach(() => {
				mockGetServerSession.mockResolvedValue(mockAdminSession);
			});

			it('returns 400 for invalid feedback ID', async () => {
				await testApiHandler({
					appHandler,
					params: { id: 'invalid' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.status).toBe(400);
						const json = await response.json();
						expect(json).toEqual({ error: 'Invalid feedback ID' });
						expect(mockGetFeedbackById).not.toHaveBeenCalled();
					},
				});
			});

			it('returns 404 when feedback not found', async () => {
				mockGetFeedbackById.mockResolvedValue(null);

				await testApiHandler({
					appHandler,
					params: { id: '999' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.status).toBe(404);
						const json = await response.json();
						expect(json).toEqual({ error: 'Feedback not found' });
					},
				});
			});
		});

		describe('Success Path Tests', () => {
			beforeEach(() => {
				mockGetServerSession.mockResolvedValue(mockAdminSession);
				mockGetFeedbackById.mockResolvedValue(mockFeedback);
			});

			it('returns feedback details for admin', async () => {
				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.status).toBe(200);
						const json = await response.json();
						expect(json).toEqual(mockFeedback);
						expect(mockGetFeedbackById).toHaveBeenCalledWith(1);
					},
				});
			});
		});

		describe('Error Handling', () => {
			it('returns 500 when database operation fails', async () => {
				mockGetServerSession.mockResolvedValue(mockAdminSession);
				mockGetFeedbackById.mockRejectedValue(new Error('Database error'));

				await testApiHandler({
					appHandler,
					params: { id: '1' },
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

	describe('PATCH /api/admin/feedback/[id]', () => {
		describe('Authentication & Authorization Tests', () => {
			it('returns 401 for unauthenticated users', async () => {
				mockGetServerSession.mockResolvedValue(null);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ status: 'reviewed' }),
						});

						expect(response.status).toBe(401);
						const json = await response.json();
						expect(json).toEqual({ error: 'Unauthorized' });
						expect(mockUpdateFeedback).not.toHaveBeenCalled();
					},
				});
			});

			it('returns 401 for non-admin users', async () => {
				mockGetServerSession.mockResolvedValue(mockRegularSession);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ status: 'reviewed' }),
						});

						expect(response.status).toBe(401);
						const json = await response.json();
						expect(json).toEqual({ error: 'Unauthorized' });
						expect(mockUpdateFeedback).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Validation Tests', () => {
			beforeEach(() => {
				mockGetServerSession.mockResolvedValue(mockAdminSession);
			});

			it('returns 400 for invalid feedback ID', async () => {
				await testApiHandler({
					appHandler,
					params: { id: 'invalid' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ status: 'reviewed' }),
						});

						expect(response.status).toBe(400);
						const json = await response.json();
						expect(json).toEqual({ error: 'Invalid feedback ID' });
						expect(mockUpdateFeedback).not.toHaveBeenCalled();
					},
				});
			});

			it('returns 400 for invalid status value', async () => {
				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ status: 'invalid_status' }),
						});

						expect(response.status).toBe(400);
						const json = await response.json();
						expect(json).toEqual({ error: 'Invalid status value' });
						expect(mockUpdateFeedback).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Success Path Tests', () => {
			beforeEach(() => {
				mockGetServerSession.mockResolvedValue(mockAdminSession);
				mockUpdateFeedback.mockResolvedValue(true);
			});

			it('successfully updates feedback status', async () => {
				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ status: 'reviewed' }),
						});

						expect(response.status).toBe(200);
						const json = await response.json();
						expect(json).toEqual({
							success: true,
							message: 'Feedback updated successfully',
						});

						expect(mockUpdateFeedback).toHaveBeenCalledWith(1, 1, {
							status: 'reviewed',
							adminNotes: undefined,
						});
					},
				});
			});

			it('successfully updates feedback with admin notes', async () => {
				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								status: 'actioned',
								adminNotes: 'Fixed the issue',
							}),
						});

						expect(response.status).toBe(200);
						const json = await response.json();
						expect(json).toEqual({
							success: true,
							message: 'Feedback updated successfully',
						});

						expect(mockUpdateFeedback).toHaveBeenCalledWith(1, 1, {
							status: 'actioned',
							adminNotes: 'Fixed the issue',
						});
					},
				});
			});

			it('returns 400 when update fails', async () => {
				mockUpdateFeedback.mockResolvedValue(false);

				await testApiHandler({
					appHandler,
					params: { id: '999' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ status: 'reviewed' }),
						});

						expect(response.status).toBe(400);
						const json = await response.json();
						expect(json).toEqual({ error: 'Failed to update feedback' });
					},
				});
			});
		});

		describe('Error Handling', () => {
			it('returns 500 when database operation fails', async () => {
				mockGetServerSession.mockResolvedValue(mockAdminSession);
				mockUpdateFeedback.mockRejectedValue(new Error('Database error'));

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'PATCH',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ status: 'reviewed' }),
						});

						expect(response.status).toBe(500);
						const json = await response.json();
						expect(json).toEqual({ error: 'Failed to update feedback' });
					},
				});
			});
		});
	});

	describe('DELETE /api/admin/feedback/[id]', () => {
		describe('Authentication & Authorization Tests', () => {
			it('returns 401 for unauthenticated users', async () => {
				mockGetServerSession.mockResolvedValue(null);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'DELETE' });

						expect(response.status).toBe(401);
						const json = await response.json();
						expect(json).toEqual({ error: 'Unauthorized' });
						expect(mockDeleteFeedback).not.toHaveBeenCalled();
					},
				});
			});

			it('returns 401 for non-admin users', async () => {
				mockGetServerSession.mockResolvedValue(mockRegularSession);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'DELETE' });

						expect(response.status).toBe(401);
						const json = await response.json();
						expect(json).toEqual({ error: 'Unauthorized' });
						expect(mockDeleteFeedback).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Validation Tests', () => {
			beforeEach(() => {
				mockGetServerSession.mockResolvedValue(mockAdminSession);
			});

			it('returns 400 for invalid feedback ID', async () => {
				await testApiHandler({
					appHandler,
					params: { id: 'invalid' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'DELETE' });

						expect(response.status).toBe(400);
						const json = await response.json();
						expect(json).toEqual({ error: 'Invalid feedback ID' });
						expect(mockDeleteFeedback).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Success Path Tests', () => {
			beforeEach(() => {
				mockGetServerSession.mockResolvedValue(mockAdminSession);
			});

			it('successfully deletes feedback', async () => {
				mockDeleteFeedback.mockResolvedValue(true);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'DELETE' });

						expect(response.status).toBe(200);
						const json = await response.json();
						expect(json).toEqual({
							success: true,
							message: 'Feedback deleted successfully',
						});

						expect(mockDeleteFeedback).toHaveBeenCalledWith(1);
					},
				});
			});

			it('returns 404 when feedback not found', async () => {
				mockDeleteFeedback.mockResolvedValue(false);

				await testApiHandler({
					appHandler,
					params: { id: '999' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'DELETE' });

						expect(response.status).toBe(404);
						const json = await response.json();
						expect(json).toEqual({ error: 'Feedback not found or already deleted' });
					},
				});
			});
		});

		describe('Error Handling', () => {
			it('returns 500 when database operation fails', async () => {
				mockGetServerSession.mockResolvedValue(mockAdminSession);
				mockDeleteFeedback.mockRejectedValue(new Error('Database error'));

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'DELETE' });

						expect(response.status).toBe(500);
						const json = await response.json();
						expect(json).toEqual({ error: 'Failed to delete feedback' });
					},
				});
			});
		});
	});

	describe('POST /api/admin/feedback/[id]/response', () => {
		describe('Authentication & Authorization Tests', () => {
			it('returns 401 for unauthenticated users', async () => {
				mockGetServerSession.mockResolvedValue(null);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ response: 'Thank you for your feedback' }),
						});

						expect(response.status).toBe(401);
						const json = await response.json();
						expect(json).toEqual({ error: 'Unauthorized' });
						expect(mockAddFeedbackResponse).not.toHaveBeenCalled();
					},
				});
			});

			it('returns 401 for non-admin users', async () => {
				mockGetServerSession.mockResolvedValue(mockRegularSession);

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ response: 'Thank you for your feedback' }),
						});

						expect(response.status).toBe(401);
						const json = await response.json();
						expect(json).toEqual({ error: 'Unauthorized' });
						expect(mockAddFeedbackResponse).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Validation Tests', () => {
			beforeEach(() => {
				mockGetServerSession.mockResolvedValue(mockAdminSession);
			});

			it('returns 400 for invalid feedback ID', async () => {
				await testApiHandler({
					appHandler,
					params: { id: 'invalid' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ response: 'Thank you' }),
						});

						expect(response.status).toBe(400);
						const json = await response.json();
						expect(json).toEqual({ error: 'Invalid feedback ID' });
						expect(mockAddFeedbackResponse).not.toHaveBeenCalled();
					},
				});
			});

			it('returns 400 when response is missing', async () => {
				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({}),
						});

						expect(response.status).toBe(400);
						const json = await response.json();
						expect(json).toEqual({ error: 'Response message is required' });
						expect(mockAddFeedbackResponse).not.toHaveBeenCalled();
					},
				});
			});

			it('returns 400 when response is empty', async () => {
				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ response: '  ' }),
						});

						expect(response.status).toBe(400);
						const json = await response.json();
						expect(json).toEqual({ error: 'Response message is required' });
						expect(mockAddFeedbackResponse).not.toHaveBeenCalled();
					},
				});
			});
		});

		describe('Success Path Tests', () => {
			beforeEach(() => {
				mockGetServerSession.mockResolvedValue(mockAdminSession);
				mockAddFeedbackResponse.mockResolvedValue(456);
			});

			it('successfully adds admin response', async () => {
				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ response: 'Thank you for your feedback' }),
						});

						expect(response.status).toBe(200);
						const json = await response.json();
						expect(json).toEqual({
							success: true,
							id: 456,
							message: 'Response added successfully',
						});

						expect(mockAddFeedbackResponse).toHaveBeenCalledWith(1, 1, 'Thank you for your feedback');
					},
				});
			});
		});

		describe('Error Handling', () => {
			it('returns 500 when database operation fails', async () => {
				mockGetServerSession.mockResolvedValue(mockAdminSession);
				mockAddFeedbackResponse.mockRejectedValue(new Error('Database error'));

				await testApiHandler({
					appHandler,
					params: { id: '1' },
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ response: 'Thank you' }),
						});

						expect(response.status).toBe(500);
						const json = await response.json();
						expect(json).toEqual({ error: 'Failed to add response' });
					},
				});
			});
		});
	});
});
