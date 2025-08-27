/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { requireAdminUser } from '@/lib/auth-helpers';
import runMigrations from '../../../../../migrations/run-migrations.mjs';
import { setupConsoleMocks, standardErrorScenarios } from '@/lib/test-utils';

// Mock the authentication modules
jest.mock('@/lib/auth-helpers', () => ({
	requireAdminUser: jest.fn(),
}));

// Mock the auth middleware to pass through for testing
jest.mock('@/lib/auth-middleware', () => jest.requireActual('@/lib/test-utils').passthroughAuthMock);

// Mock the migration system
jest.mock('../../../../../migrations/run-migrations.mjs', () => ({
	__esModule: true,
	default: jest.fn(),
}));

// Console mocking will be handled by setupConsoleMocks

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

describe('/api/admin/migrate', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();
		// Reset migration lock between tests
		(globalThis as { __resetMigrationLock?: () => void }).__resetMigrationLock?.();
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('GET /api/admin/migrate', () => {
		it('returns detailed status information for admin users', async () => {
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
						timestamp: expect.any(String),
						databaseHealth: 'connected',
						pendingMigrations: expect.any(Number),
						lastMigration: expect.objectContaining({
							version: expect.any(String),
							executedAt: expect.any(String),
						}),
						migrationLockStatus: 'unlocked',
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
						errorCode: 'ADMIN_ACCESS_REQUIRED',
						timestamp: expect.any(String),
						nextSteps: 'Login with an admin account to access migration endpoints',
						context: {},
					});
				},
			});
		});

		it('handles authentication errors gracefully with detailed error info', async () => {
			mockRequireAdminUser.mockRejectedValue(standardErrorScenarios.databaseError);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'GET' });
					const json = await response.json();

					expect(response.status).toBe(500);
					expect(json).toEqual({
						error: 'Database connection failed',
						errorCode: 'DATABASE_UNREACHABLE',
						timestamp: expect.any(String),
						nextSteps: 'Check database configuration and connectivity',
						context: {
							operationType: 'status_check',
							userAttempt: 'admin@example.com',
						},
					});
				},
			});
		});

		it('returns 405 for unsupported HTTP methods', async () => {
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'PUT' });
					const json = await response.json();

					expect(response.status).toBe(405);
					expect(json).toEqual({
						error: 'Method not allowed',
						errorCode: 'METHOD_NOT_ALLOWED',
						allowedMethods: ['GET', 'POST'],
						timestamp: expect.any(String),
						nextSteps: 'Use GET to check status or POST to run migrations',
					});
					expect(response.headers.get('Allow')).toBe('GET, POST');
				},
			});
		});
	});

	describe('POST /api/admin/migrate', () => {
		it('successfully runs migrations for admin users in development with detailed response', async () => {
			const restoreEnv = mockEnv({ NODE_ENV: 'development' });
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);
			mockRunMigrations.mockResolvedValue({
				success: true,
				migrationsRun: 3,
			});

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
							timestamp: expect.any(String),
							executionDetails: {
								totalDuration: expect.any(Number),
								migrationsExecuted: [
									{ file: 'migration_1.sql', duration: expect.any(Number), status: 'completed' },
									{ file: 'migration_2.sql', duration: expect.any(Number), status: 'completed' },
									{ file: 'migration_3.sql', duration: expect.any(Number), status: 'completed' },
								],
								migrationsSkipped: [],
							},
							databaseHealth: {
								status: expect.any(String),
								validationResults: expect.any(String),
							},
						});
						expect(consoleMocks.mockConsoleLog).toHaveBeenCalledWith('Starting migrations via API...');
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
							timestamp: expect.any(String),
							executionDetails: {
								totalDuration: expect.any(Number),
								migrationsExecuted: [{ file: 'migration_1.sql', duration: expect.any(Number), status: 'completed' }],
								migrationsSkipped: [],
							},
							databaseHealth: {
								status: expect.any(String),
								validationResults: expect.any(String),
							},
						});
					},
				});
			} finally {
				restoreEnv();
			}
		});

		it('returns 409 when migration is already in progress', async () => {
			const restoreEnv = mockEnv({ NODE_ENV: 'development' });
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);

			// Set up migration lock to simulate migration in progress
			(globalThis as { __setMigrationLockForTesting?: () => void }).__setMigrationLockForTesting?.();

			try {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						const json = await response.json();

						expect(response.status).toBe(409);
						expect(json).toEqual({
							error: 'Migration already in progress',
							errorCode: 'MIGRATION_IN_PROGRESS',
							timestamp: expect.any(String),
							nextSteps: 'Wait for current migration to complete before retrying',
							context: {
								lockAcquiredAt: expect.any(String),
								estimatedCompletion: expect.any(String),
								currentMigration: 'test-migration.sql',
							},
						});
						expect(mockRunMigrations).not.toHaveBeenCalled();
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
						errorCode: 'ADMIN_ACCESS_REQUIRED',
						timestamp: expect.any(String),
						nextSteps: 'Login with an admin account to access migration endpoints',
						context: {},
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
							errorCode: 'INVALID_MIGRATION_TOKEN',
							timestamp: expect.any(String),
							nextSteps: 'Provide valid x-migration-token header for production migrations',
							context: {
								tokenValidation: 'missing_token',
								requiredFormat: 'Bearer token in x-migration-token header',
							},
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
							errorCode: 'INVALID_TOKEN_FORMAT',
							timestamp: expect.any(String),
							nextSteps: 'Provide a properly formatted migration token',
							context: {
								tokenValidation: 'malformed_token',
								minLength: 10,
								requiredFormat: 'alphanumeric-with-hyphens',
							},
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
							errorCode: 'INVALID_MIGRATION_TOKEN',
							timestamp: expect.any(String),
							nextSteps: 'Server configuration error - migration token not set',
							context: {
								tokenValidation: 'server_config_error',
							},
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
			mockRunMigrations.mockRejectedValue(standardErrorScenarios.databaseError);

			try {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						const json = await response.json();

						expect(response.status).toBe(500);
						expect(json).toEqual({
							error: 'Migration failed',
							errorCode: 'MIGRATION_EXECUTION_FAILED',
							timestamp: expect.any(String),
							nextSteps: 'Check database connectivity and retry migration',
							context: {
								operationType: 'migration_execution',
								failureType: 'database_error',
								rollbackStatus: 'completed',
								affectedMigrations: expect.any(Array),
							},
						});
						expect(consoleMocks.mockConsoleError).toHaveBeenCalledWith('Migration API error:', expect.any(Error));
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
							errorCode: 'UNKNOWN_MIGRATION_ERROR',
							timestamp: expect.any(String),
							nextSteps: 'Contact system administrator with error details',
							context: {
								operationType: 'migration_execution',
								failureType: 'unknown_error',
								rollbackStatus: 'completed',
								affectedMigrations: expect.any(Array),
								errorData: 'String error',
							},
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
						error: 'Session validation failed',
						errorCode: 'DATABASE_UNREACHABLE',
						timestamp: expect.any(String),
						nextSteps: 'Check database configuration and connectivity',
						context: {
							operationType: 'migration_execution',
							userAttempt: 'admin authentication',
						},
					});
					expect(mockRunMigrations).not.toHaveBeenCalled();
				},
			});
		});

		it('successfully handles zero migrations run', async () => {
			const restoreEnv = mockEnv({ NODE_ENV: 'test' });
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
							timestamp: expect.any(String),
							executionDetails: {
								totalDuration: expect.any(Number),
								migrationsExecuted: [],
								migrationsSkipped: expect.any(Array),
							},
							databaseHealth: {
								status: 'healthy',
								validationResults: 'all_constraints_valid',
							},
						});
					},
				});
			} finally {
				restoreEnv();
			}
		});
	});

	describe('Request Validation and HTTP Method Support', () => {
		it('returns 405 for unsupported HTTP methods (PUT)', async () => {
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'PUT' });
					const json = await response.json();

					expect(response.status).toBe(405);
					expect(json).toEqual({
						error: 'Method not allowed',
						errorCode: 'METHOD_NOT_ALLOWED',
						allowedMethods: ['GET', 'POST'],
						timestamp: expect.any(String),
						nextSteps: 'Use GET to check status or POST to run migrations',
					});
					expect(response.headers.get('Allow')).toBe('GET, POST');
				},
			});
		});

		it('returns 405 for unsupported HTTP methods (DELETE)', async () => {
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({ method: 'DELETE' });
					const json = await response.json();

					expect(response.status).toBe(405);
					expect(json).toEqual({
						error: 'Method not allowed',
						errorCode: 'METHOD_NOT_ALLOWED',
						allowedMethods: ['GET', 'POST'],
						timestamp: expect.any(String),
						nextSteps: 'Use GET to check status or POST to run migrations',
					});
					expect(response.headers.get('Allow')).toBe('GET, POST');
				},
			});
		});

		it('validates Content-Type for POST requests with body', async () => {
			const restoreEnv = mockEnv({ NODE_ENV: 'development' });
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);

			try {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: {
								'Content-Type': 'text/plain',
							},
							body: 'invalid body content',
						});
						const json = await response.json();

						expect(response.status).toBe(400);
						expect(json).toEqual({
							error: 'Invalid request format',
							errorCode: 'INVALID_CONTENT_TYPE',
							timestamp: expect.any(String),
							nextSteps: 'Send POST requests without body or use application/json',
							context: {
								receivedContentType: 'text/plain',
								acceptedContentTypes: ['application/json', 'none'],
							},
						});
						expect(mockRunMigrations).not.toHaveBeenCalled();
					},
				});
			} finally {
				restoreEnv();
			}
		});

		it('handles request timeout for long-running migrations', async () => {
			const restoreEnv = mockEnv({ NODE_ENV: 'development' });
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);

			// Mock runMigrations normally (would succeed)
			mockRunMigrations.mockResolvedValue({ success: true, migrationsRun: 1 });

			// Mock Promise.race to simulate timeout scenario
			const mockPromiseRace = jest.spyOn(Promise, 'race').mockImplementation(async () => {
				// For this test, simulate timeout by throwing the timeout error
				throw new Error('MIGRATION_TIMEOUT');
			});

			try {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({ method: 'POST' });
						const json = await response.json();

						expect(response.status).toBe(408);
						expect(json).toEqual({
							error: 'Request timeout',
							errorCode: 'MIGRATION_TIMEOUT',
							timestamp: expect.any(String),
							nextSteps: 'Migration may still be running. Check status before retrying',
							context: {
								timeoutDuration: '30s',
								migrationStatus: 'potentially_running',
							},
						});
					},
				});
			} finally {
				// Restore original Promise.race
				mockPromiseRace.mockRestore();
				restoreEnv();
			}
		});
	});

	describe('Concurrent Request Handling', () => {
		it('prevents multiple simultaneous migration requests with proper locking', async () => {
			const restoreEnv = mockEnv({ NODE_ENV: 'development' });
			mockRequireAdminUser.mockResolvedValue(mockAdminUser);

			// Mock a slow migration to test concurrency
			const migrationDelay = 100; // Add delay to allow concurrent requests
			mockRunMigrations.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true, migrationsRun: 1 }), migrationDelay)));

			try {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						// Launch multiple concurrent requests
						const responsePromises = [fetch({ method: 'POST' }), fetch({ method: 'POST' }), fetch({ method: 'POST' })];

						const responses = await Promise.all(responsePromises);
						const jsons = await Promise.all(responses.map(r => r.json()));

						// Analyze results
						const statuses = responses.map((r, i) => ({ status: r.status, json: jsons[i] }));
						const successes = statuses.filter(s => s.status === 200);
						const blocked = statuses.filter(s => s.status === 409);

						// Should have exactly one success and two blocked requests
						expect(successes).toHaveLength(1);
						expect(blocked).toHaveLength(2);

						// Verify success response
						expect(successes[0].json.success).toBe(true);
						expect(successes[0].json.migrationsRun).toBe(1);

						// Verify blocked responses
						blocked.forEach(b => {
							expect(b.json.errorCode).toBe('MIGRATION_IN_PROGRESS');
							expect(b.json.error).toBe('Migration already in progress');
						});

						// Only one migration should have been executed due to locking
						expect(mockRunMigrations).toHaveBeenCalledTimes(1);
					},
				});
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
						expect(json2.errorCode).toBe('UNKNOWN_MIGRATION_ERROR');
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
							timestamp: expect.any(String),
							databaseHealth: expect.any(String),
							pendingMigrations: expect.any(Number),
							lastMigration: {
								version: expect.any(String),
								executedAt: expect.any(String),
							},
							migrationLockStatus: expect.any(String),
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
