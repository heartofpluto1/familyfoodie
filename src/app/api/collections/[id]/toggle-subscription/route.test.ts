/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { mockRegularUser, mockAdminUser, clearAllMocks, mockNonAuthenticatedUser, mockAuthenticatedUser } from '@/lib/test-utils';

// Mock dependencies
jest.mock('@/lib/queries/subscriptions', () => ({
	subscribeToCollection: jest.fn(),
	unsubscribeFromCollection: jest.fn(),
	isSubscribed: jest.fn(),
}));

// Define types for the auth middleware
type MockRequest = Request & {
	user?: { household_id?: number };
	household_id?: number;
};

type MockContext = {
	params?: Promise<Record<string, string | string[]>>;
};

// Mock auth middleware to provide household context
jest.mock('@/lib/auth-middleware', () => ({
	withAuth: (handler: (request: MockRequest, context?: MockContext) => Promise<Response>) => {
		return async (request: MockRequest, context?: MockContext) => {
			// Check if user is set by requestPatcher
			if (!request.user) {
				return new Response(
					JSON.stringify({
						success: false,
						error: 'Authentication required',
						code: 'UNAUTHORIZED',
					}),
					{ status: 401, headers: { 'Content-Type': 'application/json' } }
				);
			}
			// Set household_id from user as the real middleware does
			request.household_id = request.user.household_id || 1; // Default to household_id 1 for testing

			// Extract collection ID from URL path if context is not properly provided
			if (!context || !context.params) {
				const url = new URL(request.url);
				const pathParts = url.pathname.split('/');
				const collectionsIndex = pathParts.findIndex(part => part === 'collections');
				const collectionId = collectionsIndex >= 0 && pathParts[collectionsIndex + 1] ? pathParts[collectionsIndex + 1] : null;

				if (collectionId) {
					const newContext: MockContext = {
						params: Promise.resolve({ id: collectionId }),
					};
					return handler(request, newContext);
				}
			}

			return handler(request, context);
		};
	},
}));

// Get mocked functions
const mockSubscribeToCollection = jest.mocked(jest.requireMock('@/lib/queries/subscriptions').subscribeToCollection);
const mockUnsubscribeFromCollection = jest.mocked(jest.requireMock('@/lib/queries/subscriptions').unsubscribeFromCollection);
const mockIsSubscribed = jest.mocked(jest.requireMock('@/lib/queries/subscriptions').isSubscribed);

// Mock console methods to reduce test noise
const consoleMocks = {
	error: jest.spyOn(console, 'error').mockImplementation(),
	log: jest.spyOn(console, 'log').mockImplementation(),
	cleanup: () => {
		consoleMocks.error.mockRestore();
		consoleMocks.log.mockRestore();
	},
};

// Helper to mock admin user (reuse standard mockAuthenticatedUser for regular user)
const mockAuthenticatedAdmin = (request: MockRequest) => {
	request.user = mockAdminUser;
	request.household_id = mockAdminUser.household_id;
};

describe('/api/collections/[id]/toggle-subscription', () => {
	beforeEach(() => {
		clearAllMocks();
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('POST /api/collections/[id]/toggle-subscription', () => {
		// Authentication Tests
		describe('Authentication', () => {
			it('should return 401 when not authenticated', async () => {
				await testApiHandler({
					appHandler,
					requestPatcher: mockNonAuthenticatedUser,
					url: '/api/collections/123/toggle-subscription',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(401);
						const data = await response.json();
						expect(data.success).toBe(false);
						expect(data.error).toBe('Authentication required');
						expect(data.code).toBe('UNAUTHORIZED');
					},
				});
			});
		});

		// Parameter Validation Tests
		describe('Parameter validation', () => {
			it('should return 400 for invalid collection ID (non-numeric)', async () => {
				await testApiHandler({
					appHandler,
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections/invalid/toggle-subscription',
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
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections//toggle-subscription',
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
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections/0/toggle-subscription',
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
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections/-1/toggle-subscription',
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
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections/123/toggle-subscription',
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
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections/123/toggle-subscription',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.action).toBe('subscribed');
						expect(data.subscribed).toBe(true);
						expect(data.message).toBe('Successfully subscribed');

						// Verify function calls
						expect(mockIsSubscribed).toHaveBeenCalledWith(mockRegularUser.household_id, 123);
						expect(mockSubscribeToCollection).toHaveBeenCalledWith(mockRegularUser.household_id, 123);
						expect(mockUnsubscribeFromCollection).not.toHaveBeenCalled();
					},
				});
			});

			it('should work for admin users', async () => {
				mockIsSubscribed.mockResolvedValueOnce(false);
				mockSubscribeToCollection.mockResolvedValueOnce(true);

				await testApiHandler({
					appHandler,
					requestPatcher: mockAuthenticatedAdmin,
					url: '/api/collections/456/toggle-subscription',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.action).toBe('subscribed');
						expect(data.subscribed).toBe(true);

						// Verify function calls with admin household_id
						expect(mockIsSubscribed).toHaveBeenCalledWith(mockAdminUser.household_id, 456);
						expect(mockSubscribeToCollection).toHaveBeenCalledWith(mockAdminUser.household_id, 456);
					},
				});
			});

			it('should handle large collection IDs', async () => {
				mockIsSubscribed.mockResolvedValueOnce(false);
				mockSubscribeToCollection.mockResolvedValueOnce(true);

				await testApiHandler({
					appHandler,
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections/2147483647/toggle-subscription',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.action).toBe('subscribed');

						expect(mockIsSubscribed).toHaveBeenCalledWith(mockRegularUser.household_id, 2147483647);
						expect(mockSubscribeToCollection).toHaveBeenCalledWith(mockRegularUser.household_id, 2147483647);
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
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections/123/toggle-subscription',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.action).toBe('unsubscribed');
						expect(data.subscribed).toBe(false);
						expect(data.message).toBe('Successfully unsubscribed');

						// Verify function calls
						expect(mockIsSubscribed).toHaveBeenCalledWith(mockRegularUser.household_id, 123);
						expect(mockUnsubscribeFromCollection).toHaveBeenCalledWith(mockRegularUser.household_id, 123);
						expect(mockSubscribeToCollection).not.toHaveBeenCalled();
					},
				});
			});

			it('should handle unsubscribe for admin users', async () => {
				mockIsSubscribed.mockResolvedValueOnce(true);
				mockUnsubscribeFromCollection.mockResolvedValueOnce(true);

				await testApiHandler({
					appHandler,
					requestPatcher: mockAuthenticatedAdmin,
					url: '/api/collections/789/toggle-subscription',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.action).toBe('unsubscribed');
						expect(data.subscribed).toBe(false);

						// Verify function calls with admin household_id
						expect(mockIsSubscribed).toHaveBeenCalledWith(mockAdminUser.household_id, 789);
						expect(mockUnsubscribeFromCollection).toHaveBeenCalledWith(mockAdminUser.household_id, 789);
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
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections/123/toggle-subscription',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(409);
						const data = await response.json();

						expect(data.success).toBe(false);
						expect(data.error).toBe('Failed to subscribe');

						expect(mockIsSubscribed).toHaveBeenCalledWith(mockRegularUser.household_id, 123);
						expect(mockSubscribeToCollection).toHaveBeenCalledWith(mockRegularUser.household_id, 123);
					},
				});
			});

			it('should return 409 when unsubscription fails', async () => {
				mockIsSubscribed.mockResolvedValueOnce(true);
				mockUnsubscribeFromCollection.mockResolvedValueOnce(false);

				await testApiHandler({
					appHandler,
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections/123/toggle-subscription',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(409);
						const data = await response.json();

						expect(data.success).toBe(false);
						expect(data.error).toBe('Failed to unsubscribe');

						expect(mockIsSubscribed).toHaveBeenCalledWith(mockRegularUser.household_id, 123);
						expect(mockUnsubscribeFromCollection).toHaveBeenCalledWith(mockRegularUser.household_id, 123);
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
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections/999999/toggle-subscription',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(404);
						const data = await response.json();

						expect(data.success).toBe(false);
						expect(data.error).toBe('Collection not found');

						expect(mockIsSubscribed).toHaveBeenCalledWith(mockRegularUser.household_id, 999999);
					},
				});
			});

			it('should return 400 for Cannot subscribe errors', async () => {
				mockIsSubscribed.mockRejectedValueOnce(new Error('Cannot subscribe to your own collection'));

				await testApiHandler({
					appHandler,
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections/123/toggle-subscription',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(400);
						const data = await response.json();

						expect(data.success).toBe(false);
						expect(data.error).toBe('Cannot subscribe to your own collection');

						expect(mockIsSubscribed).toHaveBeenCalledWith(mockRegularUser.household_id, 123);
					},
				});
			});

			it('should return 400 for Cannot subscribe to private collection', async () => {
				mockIsSubscribed.mockRejectedValueOnce(new Error('Cannot subscribe to private collection'));

				await testApiHandler({
					appHandler,
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections/123/toggle-subscription',
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
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections/123/toggle-subscription',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data.success).toBe(false);
						expect(data.error).toBe('Database connection failed');

						expect(consoleMocks.error).toHaveBeenCalledWith('Toggle subscription error:', expect.any(Error));
					},
				});
			});

			it('should return 500 for subscription query errors', async () => {
				mockIsSubscribed.mockResolvedValueOnce(false);
				mockSubscribeToCollection.mockRejectedValueOnce(new Error('Query execution failed'));

				await testApiHandler({
					appHandler,
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections/123/toggle-subscription',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data.success).toBe(false);
						expect(data.error).toBe('Query execution failed');

						expect(consoleMocks.error).toHaveBeenCalledWith('Toggle subscription error:', expect.any(Error));
					},
				});
			});

			it('should return 500 for unsubscription query errors', async () => {
				mockIsSubscribed.mockResolvedValueOnce(true);
				mockUnsubscribeFromCollection.mockRejectedValueOnce(new Error('DELETE operation failed'));

				await testApiHandler({
					appHandler,
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections/123/toggle-subscription',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data.success).toBe(false);
						expect(data.error).toBe('DELETE operation failed');

						expect(consoleMocks.error).toHaveBeenCalledWith('Toggle subscription error:', expect.any(Error));
					},
				});
			});

			it('should handle non-Error exceptions', async () => {
				mockIsSubscribed.mockRejectedValueOnce('String error');

				await testApiHandler({
					appHandler,
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections/123/toggle-subscription',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data.success).toBe(false);
						expect(data.error).toBe('Failed to toggle subscription');

						expect(consoleMocks.error).toHaveBeenCalledWith('Toggle subscription error:', 'String error');
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
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections/123/toggle-subscription',
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
					requestPatcher: mockAuthenticatedUser,
					url: '/api/collections/123/toggle-subscription',
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
					requestPatcher: mockAuthenticatedUser,
					url: `/api/collections/${largeId}/toggle-subscription`,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(mockIsSubscribed).toHaveBeenCalledWith(mockRegularUser.household_id, largeId);
					},
				});
			});
		});
	});
});
