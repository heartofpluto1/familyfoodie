/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import { NextRequest } from 'next/server';
import * as appHandler from './route';
import { requireAdminUser } from '@/lib/auth-helpers';
import runMigrations from '../../../../../migrations/run-migrations.mjs';

// Mock the authentication modules
jest.mock('@/lib/auth-helpers', () => ({
	requireAdminUser: jest.fn(),
}));

// Mock the auth middleware to pass through for testing
jest.mock('@/lib/auth-middleware', () => ({
	withAuth: (handler: Function) => handler,
}));

// Mock the migration system
jest.mock('../../../../../migrations/run-migrations.mjs', () => ({
	__esModule: true,
	default: jest.fn(),
}));

// Mock console methods to verify logging
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Type assertions for mocked modules
const mockRequireAdminUser = requireAdminUser as jest.MockedFunction<typeof requireAdminUser>;
const mockRunMigrations = runMigrations as jest.MockedFunction<typeof runMigrations>;

// Helper to mock environment variables
const mockEnv = (env: Record<string, string | undefined>) => {
	const originalEnv = process.env;
	process.env = { ...originalEnv, ...env };
	return () => {
		process.env = originalEnv;
	};
};

// Mock admin user data
const mockAdminUser = {
	id: 1,
	username: 'admin',
	email: 'admin@example.com',
	is_admin: true,
	is_active: true,
};

const mockRegularUser = {
	id: 2,
	username: 'user',
	email: 'user@example.com',
	is_admin: false,
	is_active: true,
};

describe('/api/admin/migrate', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockConsoleLog.mockClear();
		mockConsoleError.mockClear();
	});

	afterAll(() => {
		mockConsoleLog.mockRestore();
		mockConsoleError.mockRestore();
	});

	describe('GET /api/admin/migrate', () => {
		it('returns status information for admin users', async () => {
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'GET' });
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json).toEqual({
						status: 'ready',
						message: 'Migration endpoint is available',
						environment: process.env.NODE_ENV,
					});
				},
			});
		});

		it('returns 403 for non-admin users', async () => {
			mockRequireAdminUser.mockResolvedValue(null);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'GET' });
					const json = await response.json();

					expect(response.status).toBe(403);
					expect(json).toEqual({
						error: 'Admin access required',
					});
				},
			});
		});

		it('handles authentication errors gracefully', async () => {
			mockRequireAdminUser.mockRejectedValue(new Error('Database connection failed'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'GET' });
					const json = await response.json();

					expect(response.status).toBe(500);
					expect(json).toEqual({
						error: 'Database connection failed',
					});
				},
			});
		});
	});

	describe('POST /api/admin/migrate', () => {
		it('successfully runs migrations for admin users in development', async () => {
			const restoreEnv = mockEnv({ NODE_ENV: 'development' });
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);
			mockRunMigrations.mockResolvedValue({ success: true, migrationsRun: 3 });

			try {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							success: true,
							message: 'Successfully ran 3 migration(s)',
							migrationsRun: 3,
						});
						expect(mockConsoleLog).toHaveBeenCalledWith('Starting migrations via API...');
					},
				});
			} finally {
				restoreEnv();
			}
		});

		it('successfully runs migrations for admin users with valid token in production', async () => {
			const restoreEnv = mockEnv({
				NODE_ENV: 'production',
				MIGRATION_TOKEN: 'valid-token-123',
			});
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);
			mockRunMigrations.mockResolvedValue({ success: true, migrationsRun: 1 });

			try {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'x-migration-token': 'valid-token-123',
							},
						});
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							success: true,
							message: 'Successfully ran 1 migration(s)',
							migrationsRun: 1,
						});
					},
				});
			} finally {
				restoreEnv();
			}
		});

		it('returns 403 for non-admin users', async () => {
			mockRequireAdminUser.mockResolvedValue(null);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST' });
					const json = await response.json();

					expect(response.status).toBe(403);
					expect(json).toEqual({
						error: 'Admin access required',
					});
					expect(mockRunMigrations).not.toHaveBeenCalled();
				},
			});
		});

		it('returns 403 when migration token is missing in production', async () => {
			const restoreEnv = mockEnv({
				NODE_ENV: 'production',
				MIGRATION_TOKEN: 'valid-token-123',
			});
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);

			try {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						const json = await response.json();

						expect(response.status).toBe(403);
						expect(json).toEqual({
							error: 'Invalid migration token',
						});
						expect(mockRunMigrations).not.toHaveBeenCalled();
					},
				});
			} finally {
				restoreEnv();
			}
		});

		it('returns 403 when migration token is invalid in production', async () => {
			const restoreEnv = mockEnv({
				NODE_ENV: 'production',
				MIGRATION_TOKEN: 'valid-token-123',
			});
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);

			try {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'x-migration-token': 'invalid-token',
							},
						});
						const json = await response.json();

						expect(response.status).toBe(403);
						expect(json).toEqual({
							error: 'Invalid migration token',
						});
						expect(mockRunMigrations).not.toHaveBeenCalled();
					},
				});
			} finally {
				restoreEnv();
			}
		});

		it('returns 403 when MIGRATION_TOKEN environment variable is not set in production', async () => {
			const restoreEnv = mockEnv({
				NODE_ENV: 'production',
				MIGRATION_TOKEN: undefined,
			});
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);

			try {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'x-migration-token': 'any-token',
							},
						});
						const json = await response.json();

						expect(response.status).toBe(403);
						expect(json).toEqual({
							error: 'Invalid migration token',
						});
						expect(mockRunMigrations).not.toHaveBeenCalled();
					},
				});
			} finally {
				restoreEnv();
			}
		});

		it('handles migration execution failures', async () => {
			const restoreEnv = mockEnv({ NODE_ENV: 'development' });
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);
			mockRunMigrations.mockRejectedValue(new Error('Migration table creation failed'));

			try {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						const json = await response.json();

						expect(response.status).toBe(500);
						expect(json).toEqual({
							error: 'Migration failed',
							details: 'Migration table creation failed',
						});
						expect(mockConsoleError).toHaveBeenCalledWith('Migration API error:', expect.any(Error));
					},
				});
			} finally {
				restoreEnv();
			}
		});

		it('handles unknown migration errors', async () => {
			const restoreEnv = mockEnv({ NODE_ENV: 'development' });
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);
			mockRunMigrations.mockRejectedValue('String error');

			try {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						const json = await response.json();

						expect(response.status).toBe(500);
						expect(json).toEqual({
							error: 'Migration failed',
							details: 'Unknown error',
						});
					},
				});
			} finally {
				restoreEnv();
			}
		});

		it('handles authentication errors during migration', async () => {
			mockRequireAdminUser.mockRejectedValue(new Error('Session validation failed'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'POST' });
					const json = await response.json();

					expect(response.status).toBe(500);
					expect(json).toEqual({
						error: 'Migration failed',
						details: 'Session validation failed',
					});
					expect(mockRunMigrations).not.toHaveBeenCalled();
				},
			});
		});

		it('successfully handles zero migrations run', async () => {
			const restoreEnv = mockEnv({ NODE_ENV: 'development' });
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);
			mockRunMigrations.mockResolvedValue({ success: true, migrationsRun: 0 });

			try {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						const json = await response.json();

						expect(response.status).toBe(200);
						expect(json).toEqual({
							success: true,
							message: 'Successfully ran 0 migration(s)',
							migrationsRun: 0,
						});
					},
				});
			} finally {
				restoreEnv();
			}
		});
	});

	describe('Concurrent Request Handling', () => {
		it('handles multiple simultaneous migration requests', async () => {
			const restoreEnv = mockEnv({ NODE_ENV: 'development' });
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);

			// Mock a slow migration to test concurrency
			mockRunMigrations.mockResolvedValue({ success: true, migrationsRun: 1 });

			try {
				// Test multiple concurrent calls to the same functionality
				await Promise.all([
					testApiHandler({
						appHandler,
						test: async ({ fetch }) => {
							const response = await fetch({ method: 'POST' });
							const json = await response.json();
							expect(response.status).toBe(200);
							expect(json.success).toBe(true);
							expect(json.migrationsRun).toBe(1);
						},
					}),
					testApiHandler({
						appHandler,
						test: async ({ fetch }) => {
							const response = await fetch({ method: 'POST' });
							const json = await response.json();
							expect(response.status).toBe(200);
							expect(json.success).toBe(true);
							expect(json.migrationsRun).toBe(1);
						},
					}),
					testApiHandler({
						appHandler,
						test: async ({ fetch }) => {
							const response = await fetch({ method: 'POST' });
							const json = await response.json();
							expect(response.status).toBe(200);
							expect(json.success).toBe(true);
							expect(json.migrationsRun).toBe(1);
						},
					}),
				]);

				// Migration should be called for each request
				expect(mockRunMigrations).toHaveBeenCalledTimes(3);
			} finally {
				restoreEnv();
			}
		});

		it('handles concurrent migration requests with different outcomes', async () => {
			const restoreEnv = mockEnv({ NODE_ENV: 'development' });

			// Set up different mock scenarios for sequential calls
			mockRequireAdminUser
				.mockResolvedValueOnce(mockAdminUser) // First succeeds
				.mockResolvedValueOnce(mockAdminUser) // Second succeeds but migration fails
				.mockResolvedValueOnce(null); // Third fails auth

			mockRunMigrations.mockResolvedValueOnce({ success: true, migrationsRun: 1 }).mockRejectedValueOnce(new Error('Migration conflict'));

			try {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response1 = await fetch({ method: 'POST' });
						const json1 = await response1.json();
						expect(response1.status).toBe(200);
						expect(json1.success).toBe(true);
						expect(json1.migrationsRun).toBe(1);
					},
				});

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response2 = await fetch({ method: 'POST' });
						const json2 = await response2.json();
						expect(response2.status).toBe(500);
						expect(json2.error).toBe('Migration failed');
						expect(json2.details).toBe('Migration conflict');
					},
				});

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response3 = await fetch({ method: 'POST' });
						const json3 = await response3.json();
						expect(response3.status).toBe(403);
						expect(json3.error).toBe('Admin access required');
					},
				});

				expect(mockRunMigrations).toHaveBeenCalledTimes(2);
			} finally {
				restoreEnv();
			}
		});

		it('handles concurrent requests with authentication variations', async () => {
			const restoreEnv = mockEnv({ NODE_ENV: 'development' });
			mockRunMigrations.mockResolvedValue({ success: true, migrationsRun: 1 });

			try {
				// Test admin user success
				mockRequireAdminUser.mockResolvedValueOnce(mockAdminUser);
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						const json = await response.json();
						expect(response.status).toBe(200);
						expect(json.success).toBe(true);
					},
				});

				// Test non-admin failure
				mockRequireAdminUser.mockResolvedValueOnce(null);
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						const json = await response.json();
						expect(response.status).toBe(403);
						expect(json.error).toBe('Admin access required');
					},
				});

				// Migration should only run once (for successful auth)
				expect(mockRunMigrations).toHaveBeenCalledTimes(1);
			} finally {
				restoreEnv();
			}
		});

		it('handles production token validation under concurrent load', async () => {
			const restoreEnv = mockEnv({
				NODE_ENV: 'production',
				MIGRATION_TOKEN: 'valid-token-123',
			});
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);
			mockRunMigrations.mockResolvedValue({ success: true, migrationsRun: 1 });

			try {
				// Valid token should succeed
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'x-migration-token': 'valid-token-123' },
						});
						const json = await response.json();
						expect(response.status).toBe(200);
						expect(json.success).toBe(true);
					},
				});

				// Invalid token should fail
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'x-migration-token': 'invalid-token' },
						});
						const json = await response.json();
						expect(response.status).toBe(403);
						expect(json.error).toBe('Invalid migration token');
					},
				});

				// Missing token should fail
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						const json = await response.json();
						expect(response.status).toBe(403);
						expect(json.error).toBe('Invalid migration token');
					},
				});

				// Migration should only run once (for valid token)
				expect(mockRunMigrations).toHaveBeenCalledTimes(1);
			} finally {
				restoreEnv();
			}
		});

		it('handles rapid sequential migration requests', async () => {
			const restoreEnv = mockEnv({ NODE_ENV: 'development' });
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);

			// Mock migrations with different results
			mockRunMigrations
				.mockResolvedValueOnce({ success: true, migrationsRun: 2 })
				.mockResolvedValueOnce({ success: true, migrationsRun: 0 })
				.mockResolvedValueOnce({ success: true, migrationsRun: 1 });

			try {
				// Send requests one after another rapidly
				for (let i = 0; i < 3; i++) {
					await testApiHandler({
						appHandler,
						test: async ({ fetch }) => {
							const response = await fetch({ method: 'POST' });
							const json = await response.json();
							expect(response.status).toBe(200);
							expect(json.success).toBe(true);
						},
					});
				}

				expect(mockRunMigrations).toHaveBeenCalledTimes(3);
			} finally {
				restoreEnv();
			}
		});

		it('handles mixed GET and POST requests', async () => {
			const restoreEnv = mockEnv({ NODE_ENV: 'development' });
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);
			mockRunMigrations.mockResolvedValue({ success: true, migrationsRun: 1 });

			try {
				// Test GET request
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'GET' });
						const json = await response.json();
						expect(response.status).toBe(200);
						expect(json).toEqual({
							status: 'ready',
							message: 'Migration endpoint is available',
							environment: 'development',
						});
					},
				});

				// Test POST request
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						const json = await response.json();
						expect(response.status).toBe(200);
						expect(json.success).toBe(true);
						expect(json.migrationsRun).toBe(1);
					},
				});

				// Migration should run once (for the POST request)
				expect(mockRunMigrations).toHaveBeenCalledTimes(1);
			} finally {
				restoreEnv();
			}
		});
	});
});
