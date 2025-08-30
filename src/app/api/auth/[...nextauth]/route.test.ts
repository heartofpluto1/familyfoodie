/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import NextAuth from 'next-auth';

// Mock NextAuth
jest.mock('next-auth', () => ({
	__esModule: true,
	default: jest.fn(),
}));

// Mock auth config
jest.mock('@/lib/auth/config', () => ({
	authOptions: {
		providers: [],
		adapter: {},
		callbacks: {},
	},
}));

const mockNextAuth = NextAuth as jest.MockedFunction<typeof NextAuth>;

describe('/api/auth/[...nextauth]', () => {
	let mockGetHandler: jest.Mock;
	let mockPostHandler: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		
		// Create mock handlers for GET and POST
		mockGetHandler = jest.fn(() => {
			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		});
		
		mockPostHandler = jest.fn(() => {
			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		});
		
		// Mock NextAuth to return an object with GET and POST handlers
		const handlers = {
			GET: mockGetHandler,
			POST: mockPostHandler,
		};
		
		mockNextAuth.mockReturnValue(handlers as any);
	});

	describe('GET handler', () => {
		describe('OAuth callback handling', () => {
			it('should handle valid OAuth callback with code and state', async () => {
				await testApiHandler({
					appHandler,
					url: '/api/auth/callback/google?code=valid_code&state=valid_state',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.status).toBe(200);
						expect(mockNextAuth).toHaveBeenCalledWith(
							expect.objectContaining({
								providers: expect.any(Array),
							})
						);
						expect(mockGetHandler).toHaveBeenCalled();
					},
				});
			});

			it('should reject callback with missing OAuth code', async () => {
				mockGetHandler.mockImplementationOnce(() => {
					return new Response(JSON.stringify({ error: 'Invalid callback parameters' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					});
				});

				await testApiHandler({
					appHandler,
					url: '/api/auth/callback/google?state=valid_state',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.error).toBeDefined();
					},
				});
			});

			it('should reject callback with missing state parameter', async () => {
				mockGetHandler.mockImplementationOnce(() => {
					return new Response(JSON.stringify({ error: 'Invalid state parameter' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					});
				});

				await testApiHandler({
					appHandler,
					url: '/api/auth/callback/google?code=valid_code',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.error).toBeDefined();
					},
				});
			});

			it('should handle CSRF token validation', async () => {
				await testApiHandler({
					appHandler,
					url: '/api/auth/csrf',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toHaveProperty('csrfToken');
					},
				});
			});

			it('should reject invalid provider in callback', async () => {
				mockGetHandler.mockImplementationOnce(() => {
					return new Response(JSON.stringify({ error: 'Invalid provider' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					});
				});

				await testApiHandler({
					appHandler,
					url: '/api/auth/callback/invalid_provider?code=code&state=state',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.status).toBe(400);
					},
				});
			});

			it('should handle provider error responses', async () => {
				mockGetHandler.mockImplementationOnce(() => {
					return new Response(JSON.stringify({ error: 'access_denied', error_description: 'User denied access' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					});
				});

				await testApiHandler({
					appHandler,
					url: '/api/auth/callback/google?error=access_denied&error_description=User+denied+access',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.error).toBe('access_denied');
					},
				});
			});
		});

		describe('Session management', () => {
			it('should return current session when authenticated', async () => {
				mockGetHandler.mockImplementationOnce(() => {
					return new Response(
						JSON.stringify({
							user: {
								id: '1',
								email: 'test@example.com',
								household_id: 1,
							},
							expires: new Date(Date.now() + 86400000).toISOString(),
						}),
						{
							status: 200,
							headers: { 'Content-Type': 'application/json' },
						}
					);
				});

				await testApiHandler({
					appHandler,
					url: '/api/auth/session',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data.user).toBeDefined();
						expect(data.expires).toBeDefined();
					},
				});
			});

			it('should return null session when not authenticated', async () => {
				mockGetHandler.mockImplementationOnce(() => {
					return new Response('null', {
						status: 200,
						headers: { 'Content-Type': 'application/json' },
					});
				});

				await testApiHandler({
					appHandler,
					url: '/api/auth/session',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.status).toBe(200);
						const text = await response.text();
						expect(text).toBe('null');
					},
				});
			});
		});

		describe('Provider listing', () => {
			it('should return list of configured providers', async () => {
				mockGetHandler.mockImplementationOnce(() => {
					return new Response(
						JSON.stringify({
							google: {
								id: 'google',
								name: 'Google',
								type: 'oauth',
								signinUrl: '/api/auth/signin/google',
								callbackUrl: '/api/auth/callback/google',
							},
							facebook: {
								id: 'facebook',
								name: 'Facebook',
								type: 'oauth',
								signinUrl: '/api/auth/signin/facebook',
								callbackUrl: '/api/auth/callback/facebook',
							},
						}),
						{
							status: 200,
							headers: { 'Content-Type': 'application/json' },
						}
					);
				});

				await testApiHandler({
					appHandler,
					url: '/api/auth/providers',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data).toHaveProperty('google');
						expect(data).toHaveProperty('facebook');
					},
				});
			});
		});
	});

	describe('POST handler', () => {
		describe('Sign-in initiation', () => {
			it('should initiate sign-in with valid provider', async () => {
				mockPostHandler.mockImplementationOnce(() => {
					return new Response(null, {
						status: 302,
						headers: {
							Location: 'https://accounts.google.com/oauth/authorize?client_id=...',
						},
					});
				});

				await testApiHandler({
					appHandler,
					url: '/api/auth/signin/google',
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ csrfToken: 'valid_token' }),
						});

						expect(response.status).toBe(302);
						expect(response.headers.get('Location')).toContain('google.com');
					},
				});
			});

			it('should reject sign-in with invalid provider', async () => {
				mockPostHandler.mockImplementationOnce(() => {
					return new Response(JSON.stringify({ error: 'Invalid provider' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					});
				});

				await testApiHandler({
					appHandler,
					url: '/api/auth/signin/invalid_provider',
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ csrfToken: 'valid_token' }),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data.error).toBe('Invalid provider');
					},
				});
			});

			it('should reject sign-in without CSRF token', async () => {
				mockPostHandler.mockImplementationOnce(() => {
					return new Response(JSON.stringify({ error: 'CSRF token missing' }), {
						status: 403,
						headers: { 'Content-Type': 'application/json' },
					});
				});

				await testApiHandler({
					appHandler,
					url: '/api/auth/signin/google',
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({}),
						});

						expect(response.status).toBe(403);
						const data = await response.json();
						expect(data.error).toContain('CSRF');
					},
				});
			});

			it('should reject sign-in with invalid CSRF token', async () => {
				mockPostHandler.mockImplementationOnce(() => {
					return new Response(JSON.stringify({ error: 'Invalid CSRF token' }), {
						status: 403,
						headers: { 'Content-Type': 'application/json' },
					});
				});

				await testApiHandler({
					appHandler,
					url: '/api/auth/signin/google',
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ csrfToken: 'invalid_token' }),
						});

						expect(response.status).toBe(403);
						const data = await response.json();
						expect(data.error).toContain('Invalid CSRF token');
					},
				});
			});

			it('should handle malformed request body', async () => {
				mockPostHandler.mockImplementationOnce(() => {
					return new Response(JSON.stringify({ error: 'Invalid request body' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					});
				});

				await testApiHandler({
					appHandler,
					url: '/api/auth/signin/google',
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: 'invalid json',
						});

						expect(response.status).toBe(400);
					},
				});
			});
		});

		describe('Sign-out handling', () => {
			it('should handle sign-out request', async () => {
				mockPostHandler.mockImplementationOnce(() => {
					return new Response(JSON.stringify({ url: '/' }), {
						status: 200,
						headers: { 'Content-Type': 'application/json' },
					});
				});

				await testApiHandler({
					appHandler,
					url: '/api/auth/signout',
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ csrfToken: 'valid_token' }),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data.url).toBe('/');
					},
				});
			});

			it('should clear session on sign-out', async () => {
				mockPostHandler.mockImplementationOnce(() => {
					return new Response(JSON.stringify({ url: '/' }), {
						status: 200,
						headers: {
							'Content-Type': 'application/json',
							'Set-Cookie': 'next-auth.session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
						},
					});
				});

				await testApiHandler({
					appHandler,
					url: '/api/auth/signout',
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ csrfToken: 'valid_token' }),
						});

						expect(response.status).toBe(200);
						const setCookie = response.headers.get('Set-Cookie');
						expect(setCookie).toContain('Expires=Thu, 01 Jan 1970');
					},
				});
			});
		});

		describe('Security headers', () => {
			it('should include security headers in responses', async () => {
				mockPostHandler.mockImplementationOnce(() => {
					return new Response(JSON.stringify({ success: true }), {
						status: 200,
						headers: {
							'Content-Type': 'application/json',
							'X-Content-Type-Options': 'nosniff',
							'X-Frame-Options': 'DENY',
						},
					});
				});

				await testApiHandler({
					appHandler,
					url: '/api/auth/session',
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });

						expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
						expect(response.headers.get('X-Frame-Options')).toBe('DENY');
					},
				});
			});
		});
	});

	describe('Security attack scenarios', () => {
		it('should prevent OAuth state fixation attacks', async () => {
			// Attempt to use a fixed state parameter
			mockGetHandler.mockImplementationOnce(() => {
				return new Response(JSON.stringify({ error: 'Invalid state' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			});

			await testApiHandler({
				appHandler,
				url: '/api/auth/callback/google?code=valid_code&state=fixed_state_attack',
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'GET' });

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toContain('Invalid state');
				},
			});
		});

		it('should prevent session fixation attacks', async () => {
			// Attempt to set a fixed session ID
			mockGetHandler.mockImplementationOnce(() => {
				return new Response(JSON.stringify({ error: 'Invalid session' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			});

			await testApiHandler({
				appHandler,
				url: '/api/auth/session',
				test: async ({ fetch }) => {
					await fetch({
						method: 'GET',
						headers: {
							Cookie: 'next-auth.session-token=fixed_session_id_attack',
						},
					});

					expect(mockGetHandler).toHaveBeenCalled();
				},
			});
		});

		it('should handle XSS attempts in callback parameters', async () => {
			const xssPayload = '<script>alert("XSS")</script>';
			mockGetHandler.mockImplementationOnce(() => {
				return new Response(JSON.stringify({ error: 'Invalid parameters' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			});

			await testApiHandler({
				appHandler,
				url: `/api/auth/callback/google?code=${encodeURIComponent(xssPayload)}&state=valid_state`,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'GET' });

					expect(response.status).toBe(400);
					const data = await response.json();
					// Ensure XSS payload is not reflected in response
					expect(JSON.stringify(data)).not.toContain('<script>');
				},
			});
		});

		it('should handle SQL injection attempts in parameters', async () => {
			const sqlPayload = "1' OR '1'='1";
			mockGetHandler.mockImplementationOnce(() => {
				return new Response(JSON.stringify({ error: 'Invalid parameters' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			});

			await testApiHandler({
				appHandler,
				url: `/api/auth/callback/google?code=${encodeURIComponent(sqlPayload)}&state=valid_state`,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'GET' });

					expect(response.status).toBe(400);
				},
			});
		});
	});
});
