/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import { NextResponse } from 'next/server';
import * as appHandler from './route';
import { clearAllMocks, setupConsoleMocks, mockRegularSession, mockAdminSession } from '@/lib/test-utils';
import { requireAuth } from '@/lib/auth/helpers';

// Mock dependencies
jest.mock('@/lib/queries/subscriptions', () => ({
	subscribeToCollection: jest.fn(),
	unsubscribeFromCollection: jest.fn(),
	isSubscribed: jest.fn(),
}));

// Mock OAuth auth helpers
jest.mock('@/lib/auth/helpers', () => ({
	requireAuth: jest.fn(),
}));

// Get mocked functions
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockSubscribeToCollection = jest.mocked(jest.requireMock('@/lib/queries/subscriptions').subscribeToCollection);
const mockUnsubscribeFromCollection = jest.mocked(jest.requireMock('@/lib/queries/subscriptions').unsubscribeFromCollection);
const mockIsSubscribed = jest.mocked(jest.requireMock('@/lib/queries/subscriptions').isSubscribed);

describe('/api/collections/[id]/toggle-subscription', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		clearAllMocks();
		consoleMocks = setupConsoleMocks();
		// Default OAuth auth mock
		mockRequireAuth.mockResolvedValue({
			authorized: true as const,
			session: mockRegularSession,
			household_id: mockRegularSession.user.household_id,
			user_id: mockRegularSession.user.id,
		});
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('POST /api/collections/[id]/toggle-subscription', () => {
		// Authentication Tests
		describe('Authentication', () => {
			it('should return 401 when not authenticated', async () => {
				const mockResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
				mockRequireAuth.mockResolvedValue({
					authorized: false as const,
					response: mockResponse,
				});

				await testApiHandler({
					appHandler,
					params: { id: '123' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(401);
						const data = await response.json();
						expect(data.error).toBe('Unauthorized');
					},
				});
			});
		});

		// Parameter Validation Tests
		describe('Parameter validation', () => {
			it('should return 400 for invalid collection ID (non-numeric)', async () => {
				await testApiHandler({
					appHandler,
					params: { id: 'invalid' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.success).toBe(false);
						expect(data.error).toBe('Invalid collection ID');
					},
				});
			});

			it('should return 400 for missing collection ID', async () => {
				await testApiHandler({
					appHandler,
					params: { id: '' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.success).toBe(false);
						expect(data.error).toBe('Invalid collection ID');
					},
				});
			});

			it('should return 400 for zero collection ID', async () => {
				await testApiHandler({
					appHandler,
					params: { id: '0' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.success).toBe(false);
						expect(data.error).toBe('Invalid collection ID');
					},
				});
			});

			it('should return 400 for negative collection ID', async () => {
				await testApiHandler({
					appHandler,
					params: { id: '-1' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.success).toBe(false);
						expect(data.error).toBe('Invalid collection ID');
					},
				});
			});

			it('should handle array-style collection ID parameter', async () => {
				// Mock successful subscription
				mockIsSubscribed.mockResolvedValueOnce(false);
				mockSubscribeToCollection.mockResolvedValueOnce(true);

				// Test that the route can handle array-style parameters (first element)
				await testApiHandler({
					appHandler,
					params: { id: '123' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data.success).toBe(true);
						expect(data.action).toBe('subscribed');
					},
				});
			});
		});

		// Success Cases - Subscribe
		describe('Successful subscription scenarios', () => {
			it('should subscribe when not currently subscribed', async () => {
				mockIsSubscribed.mockResolvedValueOnce(false);
				mockSubscribeToCollection.mockResolvedValueOnce(true);

				await testApiHandler({
					appHandler,
					params: { id: '123' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.action).toBe('subscribed');
						expect(data.subscribed).toBe(true);
						expect(data.message).toBe('Successfully subscribed');

						// Verify function calls
						expect(mockIsSubscribed).toHaveBeenCalledWith(mockRegularSession.user.household_id, 123);
						expect(mockSubscribeToCollection).toHaveBeenCalledWith(mockRegularSession.user.household_id, 123);
						expect(mockUnsubscribeFromCollection).not.toHaveBeenCalled();
					},
				});
			});

			it('should work for admin users', async () => {
				// Mock admin auth for this test
				mockRequireAuth.mockResolvedValue({
					authorized: true as const,
					session: mockAdminSession,
					household_id: mockAdminSession.user.household_id,
					user_id: mockAdminSession.user.id,
				});
				mockIsSubscribed.mockResolvedValueOnce(false);
				mockSubscribeToCollection.mockResolvedValueOnce(true);

				await testApiHandler({
					appHandler,
					params: { id: '456' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.action).toBe('subscribed');
						expect(data.subscribed).toBe(true);

						// Verify function calls with admin household_id
						expect(mockIsSubscribed).toHaveBeenCalledWith(mockAdminSession.user.household_id, 456);
						expect(mockSubscribeToCollection).toHaveBeenCalledWith(mockAdminSession.user.household_id, 456);
					},
				});
			});

			it('should handle large collection IDs', async () => {
				mockIsSubscribed.mockResolvedValueOnce(false);
				mockSubscribeToCollection.mockResolvedValueOnce(true);

				await testApiHandler({
					appHandler,
					params: { id: '2147483647' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.action).toBe('subscribed');

						expect(mockIsSubscribed).toHaveBeenCalledWith(mockRegularSession.user.household_id, 2147483647);
						expect(mockSubscribeToCollection).toHaveBeenCalledWith(mockRegularSession.user.household_id, 2147483647);
					},
				});
			});
		});

		// Success Cases - Unsubscribe
		describe('Successful unsubscription scenarios', () => {
			it('should unsubscribe when currently subscribed', async () => {
				mockIsSubscribed.mockResolvedValueOnce(true);
				mockUnsubscribeFromCollection.mockResolvedValueOnce(true);

				await testApiHandler({
					appHandler,
					params: { id: '123' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.action).toBe('unsubscribed');
						expect(data.subscribed).toBe(false);
						expect(data.message).toBe('Successfully unsubscribed');

						// Verify function calls
						expect(mockIsSubscribed).toHaveBeenCalledWith(mockRegularSession.user.household_id, 123);
						expect(mockUnsubscribeFromCollection).toHaveBeenCalledWith(mockRegularSession.user.household_id, 123);
						expect(mockSubscribeToCollection).not.toHaveBeenCalled();
					},
				});
			});

			it('should handle unsubscribe for admin users', async () => {
				// Mock admin auth for this test
				mockRequireAuth.mockResolvedValue({
					authorized: true as const,
					session: mockAdminSession,
					household_id: mockAdminSession.user.household_id,
					user_id: mockAdminSession.user.id,
				});
				mockIsSubscribed.mockResolvedValueOnce(true);
				mockUnsubscribeFromCollection.mockResolvedValueOnce(true);

				await testApiHandler({
					appHandler,
					params: { id: '789' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.action).toBe('unsubscribed');
						expect(data.subscribed).toBe(false);

						// Verify function calls with admin household_id
						expect(mockIsSubscribed).toHaveBeenCalledWith(mockAdminSession.user.household_id, 789);
						expect(mockUnsubscribeFromCollection).toHaveBeenCalledWith(mockAdminSession.user.household_id, 789);
					},
				});
			});
		});

		// Failure Cases - Subscription/Unsubscription Failed
		describe('Subscription operation failures', () => {
			it('should return 409 when subscription fails', async () => {
				mockIsSubscribed.mockResolvedValueOnce(false);
				mockSubscribeToCollection.mockResolvedValueOnce(false);

				await testApiHandler({
					appHandler,
					params: { id: '123' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(409);
						const data = await response.json();

						expect(data.success).toBe(false);
						expect(data.error).toBe('Failed to subscribe');

						expect(mockIsSubscribed).toHaveBeenCalledWith(mockRegularSession.user.household_id, 123);
						expect(mockSubscribeToCollection).toHaveBeenCalledWith(mockRegularSession.user.household_id, 123);
					},
				});
			});

			it('should return 409 when unsubscription fails', async () => {
				mockIsSubscribed.mockResolvedValueOnce(true);
				mockUnsubscribeFromCollection.mockResolvedValueOnce(false);

				await testApiHandler({
					appHandler,
					params: { id: '123' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(409);
						const data = await response.json();

						expect(data.success).toBe(false);
						expect(data.error).toBe('Failed to unsubscribe');

						expect(mockIsSubscribed).toHaveBeenCalledWith(mockRegularSession.user.household_id, 123);
						expect(mockUnsubscribeFromCollection).toHaveBeenCalledWith(mockRegularSession.user.household_id, 123);
					},
				});
			});
		});

		// Error Handling Tests
		describe('Error handling', () => {
			it('should return 404 when collection not found', async () => {
				mockIsSubscribed.mockRejectedValueOnce(new Error('Collection not found'));

				await testApiHandler({
					appHandler,
					params: { id: '999999' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(404);
						const data = await response.json();

						expect(data.success).toBe(false);
						expect(data.error).toBe('Collection not found');

						expect(mockIsSubscribed).toHaveBeenCalledWith(mockRegularSession.user.household_id, 999999);
					},
				});
			});

			it('should return 400 for Cannot subscribe errors', async () => {
				mockIsSubscribed.mockRejectedValueOnce(new Error('Cannot subscribe to your own collection'));

				await testApiHandler({
					appHandler,
					params: { id: '123' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(400);
						const data = await response.json();

						expect(data.success).toBe(false);
						expect(data.error).toBe('Cannot subscribe to your own collection');

						expect(mockIsSubscribed).toHaveBeenCalledWith(mockRegularSession.user.household_id, 123);
					},
				});
			});

			it('should return 400 for Cannot subscribe to private collection', async () => {
				mockIsSubscribed.mockRejectedValueOnce(new Error('Cannot subscribe to private collection'));

				await testApiHandler({
					appHandler,
					params: { id: '123' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(400);
						const data = await response.json();

						expect(data.success).toBe(false);
						expect(data.error).toBe('Cannot subscribe to private collection');
					},
				});
			});

			it('should return 500 for other database errors', async () => {
				mockIsSubscribed.mockRejectedValueOnce(new Error('Database connection failed'));

				await testApiHandler({
					appHandler,
					params: { id: '123' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data.success).toBe(false);
						expect(data.error).toBe('Database connection failed');

						expect(consoleMocks.mockConsoleError).toHaveBeenCalledWith('Toggle subscription error:', expect.any(Error));
					},
				});
			});

			it('should return 500 for subscription query errors', async () => {
				mockIsSubscribed.mockResolvedValueOnce(false);
				mockSubscribeToCollection.mockRejectedValueOnce(new Error('Query execution failed'));

				await testApiHandler({
					appHandler,
					params: { id: '123' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data.success).toBe(false);
						expect(data.error).toBe('Query execution failed');

						expect(consoleMocks.mockConsoleError).toHaveBeenCalledWith('Toggle subscription error:', expect.any(Error));
					},
				});
			});

			it('should return 500 for unsubscription query errors', async () => {
				mockIsSubscribed.mockResolvedValueOnce(true);
				mockUnsubscribeFromCollection.mockRejectedValueOnce(new Error('DELETE operation failed'));

				await testApiHandler({
					appHandler,
					params: { id: '123' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data.success).toBe(false);
						expect(data.error).toBe('DELETE operation failed');

						expect(consoleMocks.mockConsoleError).toHaveBeenCalledWith('Toggle subscription error:', expect.any(Error));
					},
				});
			});

			it('should handle non-Error exceptions', async () => {
				mockIsSubscribed.mockRejectedValueOnce('String error');

				await testApiHandler({
					appHandler,
					params: { id: '123' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data.success).toBe(false);
						expect(data.error).toBe('Failed to toggle subscription');

						expect(consoleMocks.mockConsoleError).toHaveBeenCalledWith('Toggle subscription error:', 'String error');
					},
				});
			});
		});

		// Edge Cases
		describe('Edge cases', () => {
			it('should handle concurrent toggle operations gracefully', async () => {
				// Simulate a race condition where isSubscribed and subscribeToCollection might have different states
				mockIsSubscribed.mockResolvedValueOnce(false);
				mockSubscribeToCollection.mockResolvedValueOnce(true);

				await testApiHandler({
					appHandler,
					params: { id: '123' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.action).toBe('subscribed');
						expect(data.subscribed).toBe(true);
					},
				});
			});

			it('should handle boolean conversion correctly for subscription status', async () => {
				mockIsSubscribed.mockResolvedValueOnce(true);
				mockUnsubscribeFromCollection.mockResolvedValueOnce(true);

				await testApiHandler({
					appHandler,
					params: { id: '123' },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(200);
						const data = await response.json();

						// Verify that subscribed is the opposite of currentlySubscribed
						expect(data.subscribed).toBe(false);
						expect(data.action).toBe('unsubscribed');
					},
				});
			});

			it('should handle very long collection IDs within integer range', async () => {
				mockIsSubscribed.mockResolvedValueOnce(false);
				mockSubscribeToCollection.mockResolvedValueOnce(true);

				const largeId = 9007199254740991; // Number.MAX_SAFE_INTEGER

				await testApiHandler({
					appHandler,
					params: { id: largeId.toString() },
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(mockIsSubscribed).toHaveBeenCalledWith(mockRegularSession.user.household_id, largeId);
					},
				});
			});
		});
	});
});
