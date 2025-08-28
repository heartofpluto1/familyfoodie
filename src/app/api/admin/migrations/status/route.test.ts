/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { mockAuthenticatedUser, mockNonAuthenticatedUser, clearAllMocks, setupConsoleMocks } from '@/lib/test-utils';
import { requireAdminUser } from '@/lib/auth-helpers';
import path from 'path';

// Type definitions for response
interface MigrationItem {
	version: string;
	status: 'pending' | 'completed';
	executed_at: string | null;
	execution_time_ms: number | null;
}

interface MigrationStatusResponse {
	success: boolean;
	summary: {
		total: number;
		completed: number;
		pending: number;
		schema_migrations_exists: boolean;
	};
	migrations: MigrationItem[];
	environment: string;
}

// Mock the database pool
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
	readdir: jest.fn(),
}));

// Mock path.join to return predictable paths
jest.mock('path', () => ({
	...jest.requireActual('path'),
	join: jest.fn((...args) => args.join('/')),
}));

// Mock the auth-helpers module
jest.mock('@/lib/auth-helpers', () => ({
	requireAdminUser: jest.fn(),
}));

// Get mocked functions
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);
const mockReaddir = jest.requireMock('fs/promises').readdir as jest.MockedFunction<(path: string) => Promise<string[]>>;
const mockPathJoin = jest.mocked(path.join);
const mockRequireAdminUser = jest.mocked(requireAdminUser);

// Mock the auth middleware
jest.mock('@/lib/auth-middleware', () => jest.requireActual('@/lib/test-utils').authMiddlewareMock);

// Helper to mock environment variables
const mockEnv = (env: Record<string, string | undefined>) => {
	const originalEnv = process.env;
	process.env = { ...originalEnv, ...env };
	return () => {
		process.env = originalEnv;
	};
};

describe('/api/admin/migrations/status', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		clearAllMocks();
		consoleMocks = setupConsoleMocks();
		// Reset all mocks
		mockExecute.mockReset();
		mockReaddir.mockReset();
		mockRequireAdminUser.mockReset();
		mockPathJoin.mockImplementation((...args) => args.join('/'));
		// Default to admin user
		mockRequireAdminUser.mockResolvedValue({
			id: 1,
			username: 'admin',
			email: 'admin@example.com',
			is_admin: true,
			is_active: true,
		});
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	describe('GET /api/admin/migrations/status', () => {
		describe('Authentication Tests', () => {
			it('should return 401 for unauthenticated requests', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(401);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Authentication required',
							code: 'UNAUTHORIZED',
						});
					},
					requestPatcher: mockNonAuthenticatedUser,
				});
			});

			it('should process authenticated admin requests', async () => {
				// Mock file system - no migrations
				mockReaddir.mockResolvedValueOnce([]);
				// Mock database - table exists but no migrations
				mockExecute
					.mockResolvedValueOnce([[{ Tables_in_db: 'schema_migrations' }], []]) // SHOW TABLES
					.mockResolvedValueOnce([[], []]); // SELECT from schema_migrations

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data.success).toBe(true);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should return 403 for non-admin users', async () => {
				// Mock requireAdminUser to reject for non-admin
				mockRequireAdminUser.mockRejectedValueOnce(new Error('User is not an admin'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(403);
						const data = await response.json();
						expect(data).toEqual({
							error: 'Admin access required',
							code: 'FORBIDDEN',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should verify requireAdminUser is called', async () => {
				mockReaddir.mockResolvedValueOnce([]);
				mockExecute.mockResolvedValueOnce([[], []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						await fetch({ method: 'GET' });

						// Verify that requireAdminUser was called
						expect(mockRequireAdminUser).toHaveBeenCalledTimes(1);
						expect(mockRequireAdminUser).toHaveBeenCalledWith(expect.any(Object));
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('File System Operations', () => {
			it('should correctly read and filter SQL migration files', async () => {
				// Mock file system with various file types
				mockReaddir.mockResolvedValueOnce([
					'001_initial_schema.sql',
					'002_add_users.sql',
					'003_add_indexes.sql',
					'README.md',
					'.gitignore',
					'backup.sql.bak',
				]);

				// Mock database - no table
				mockExecute.mockResolvedValueOnce([[], []]); // SHOW TABLES

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						// Should only include .sql files
						expect(data.migrations).toHaveLength(3);
						const migrationData = data as MigrationStatusResponse;
						expect(migrationData.migrations.map(m => m.version)).toEqual(['001_initial_schema.sql', '002_add_users.sql', '003_add_indexes.sql']);

						// Verify correct path was used
						expect(mockPathJoin).toHaveBeenCalledWith(process.cwd(), 'migrations');
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle empty migrations directory', async () => {
				// Mock empty directory
				mockReaddir.mockResolvedValueOnce([]);
				// Mock database - no table
				mockExecute.mockResolvedValueOnce([[], []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.migrations).toEqual([]);
						expect(data.summary).toEqual({
							total: 0,
							completed: 0,
							pending: 0,
							schema_migrations_exists: false,
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should sort migration files alphabetically', async () => {
				// Mock unsorted files
				mockReaddir.mockResolvedValueOnce(['003_third.sql', '001_first.sql', '002_second.sql']);

				mockExecute.mockResolvedValueOnce([[], []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						const data = await response.json();
						const migrationData = data as MigrationStatusResponse;
						expect(migrationData.migrations.map(m => m.version)).toEqual(['001_first.sql', '002_second.sql', '003_third.sql']);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle file system errors gracefully', async () => {
				// Mock file system error
				mockReaddir.mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data.error).toBe('Failed to fetch migration status');
						expect(data.details).toContain('ENOENT');
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Database Operations', () => {
			it('should handle when schema_migrations table exists with migrations', async () => {
				// Mock files
				mockReaddir.mockResolvedValueOnce(['001_initial.sql', '002_users.sql', '003_indexes.sql']);

				// Mock database - table exists with executed migrations
				mockExecute
					.mockResolvedValueOnce([[{ Tables_in_db: 'schema_migrations' }], []]) // Table exists
					.mockResolvedValueOnce([
						[
							{
								version: '001_initial.sql',
								executed_at: new Date('2024-01-01T10:00:00Z'),
								execution_time_ms: 125,
							},
							{
								version: '002_users.sql',
								executed_at: new Date('2024-01-02T10:00:00Z'),
								execution_time_ms: 50,
							},
						],
						[],
					]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.summary).toEqual({
							total: 3,
							completed: 2,
							pending: 1,
							schema_migrations_exists: true,
						});

						// Check migration statuses
						expect(data.migrations).toHaveLength(3);
						expect(data.migrations[0]).toEqual({
							version: '001_initial.sql',
							status: 'completed',
							executed_at: expect.any(String),
							execution_time_ms: 125,
						});
						expect(data.migrations[1]).toEqual({
							version: '002_users.sql',
							status: 'completed',
							executed_at: expect.any(String),
							execution_time_ms: 50,
						});
						expect(data.migrations[2]).toEqual({
							version: '003_indexes.sql',
							status: 'pending',
							executed_at: null,
							execution_time_ms: null,
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle when schema_migrations table does not exist', async () => {
				// Mock files
				mockReaddir.mockResolvedValueOnce(['001_initial.sql', '002_users.sql']);

				// Mock database - no table
				mockExecute.mockResolvedValueOnce([[], []]); // SHOW TABLES returns empty

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.summary.schema_migrations_exists).toBe(false);
						expect(data.summary.completed).toBe(0);
						expect(data.summary.pending).toBe(2);

						// All migrations should be pending
						const migrationData = data as MigrationStatusResponse;
						migrationData.migrations.forEach(migration => {
							expect(migration.status).toBe('pending');
							expect(migration.executed_at).toBeNull();
							expect(migration.execution_time_ms).toBeNull();
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle database connection errors', async () => {
				// Mock files successfully
				mockReaddir.mockResolvedValueOnce(['001_initial.sql']);

				// Mock database connection error
				mockExecute.mockRejectedValueOnce(new Error('DATABASE_CONNECTION_FAILED: Unable to connect to the database'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data.error).toBe('Failed to fetch migration status');
						expect(data.details).toContain('DATABASE_CONNECTION_FAILED');
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle query errors when fetching migration records', async () => {
				mockReaddir.mockResolvedValueOnce(['001_initial.sql']);

				// First query succeeds (table exists)
				mockExecute
					.mockResolvedValueOnce([[{ Tables_in_db: 'schema_migrations' }], []])
					// Second query fails
					.mockRejectedValueOnce(new Error('Column not found'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data.error).toBe('Failed to fetch migration status');
						expect(data.details).toContain('Column not found');
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Migration Status Logic', () => {
			it('should correctly identify completed vs pending migrations', async () => {
				mockReaddir.mockResolvedValueOnce(['001_initial.sql', '002_users.sql', '003_indexes.sql', '004_constraints.sql']);

				mockExecute.mockResolvedValueOnce([[{ Tables_in_db: 'schema_migrations' }], []]).mockResolvedValueOnce([
					[
						{ version: '001_initial.sql', executed_at: new Date(), execution_time_ms: 100 },
						{ version: '003_indexes.sql', executed_at: new Date(), execution_time_ms: 75 },
					],
					[],
				]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						const data = await response.json();

						// Check specific statuses
						const migrationData = data as MigrationStatusResponse;
						const statuses = migrationData.migrations.reduce<Record<string, string>>((acc, m) => {
							acc[m.version] = m.status;
							return acc;
						}, {});

						expect(statuses['001_initial.sql']).toBe('completed');
						expect(statuses['002_users.sql']).toBe('pending');
						expect(statuses['003_indexes.sql']).toBe('completed');
						expect(statuses['004_constraints.sql']).toBe('pending');
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should preserve execution metadata for completed migrations', async () => {
				const executionDate = new Date('2024-01-15T14:30:00Z');

				mockReaddir.mockResolvedValueOnce(['001_initial.sql']);
				mockExecute.mockResolvedValueOnce([[{ Tables_in_db: 'schema_migrations' }], []]).mockResolvedValueOnce([
					[
						{
							version: '001_initial.sql',
							executed_at: executionDate,
							execution_time_ms: 1250,
						},
					],
					[],
				]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						const data = await response.json();
						const migration = data.migrations[0];

						expect(migration.executed_at).toBe(executionDate.toISOString());
						expect(migration.execution_time_ms).toBe(1250);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle null execution times gracefully', async () => {
				mockReaddir.mockResolvedValueOnce(['001_initial.sql']);
				mockExecute.mockResolvedValueOnce([[{ Tables_in_db: 'schema_migrations' }], []]).mockResolvedValueOnce([
					[
						{
							version: '001_initial.sql',
							executed_at: new Date(),
							execution_time_ms: null, // Can be null in database
						},
					],
					[],
				]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						const data = await response.json();
						expect(response.status).toBe(200);
						expect(data.migrations[0].execution_time_ms).toBeNull();
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Response Format', () => {
			it('should include environment information', async () => {
				mockReaddir.mockResolvedValueOnce([]);
				mockExecute.mockResolvedValueOnce([[], []]);

				// Test with different NODE_ENV values
				const restoreEnv = mockEnv({
					NODE_ENV: 'production',
				});

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						const data = await response.json();
						expect(data.environment).toBe('production');
					},
					requestPatcher: mockAuthenticatedUser,
				});

				// Restore original env
				restoreEnv();
			});

			it('should return complete response structure', async () => {
				mockReaddir.mockResolvedValueOnce(['001_initial.sql']);
				mockExecute.mockResolvedValueOnce([[{ Tables_in_db: 'schema_migrations' }], []]).mockResolvedValueOnce([[], []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						const data = await response.json();

						// Check top-level structure
						expect(data).toHaveProperty('success');
						expect(data).toHaveProperty('summary');
						expect(data).toHaveProperty('migrations');
						expect(data).toHaveProperty('environment');

						// Check summary structure
						expect(data.summary).toHaveProperty('total');
						expect(data.summary).toHaveProperty('completed');
						expect(data.summary).toHaveProperty('pending');
						expect(data.summary).toHaveProperty('schema_migrations_exists');

						// Check migration item structure
						if (data.migrations.length > 0) {
							const migration = data.migrations[0];
							expect(migration).toHaveProperty('version');
							expect(migration).toHaveProperty('status');
							expect(migration).toHaveProperty('executed_at');
							expect(migration).toHaveProperty('execution_time_ms');
						}
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should order migrations in SELECT query by executed_at DESC', async () => {
				mockReaddir.mockResolvedValueOnce(['001_initial.sql']);
				mockExecute.mockResolvedValueOnce([[{ Tables_in_db: 'schema_migrations' }], []]).mockResolvedValueOnce([[], []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						await fetch({ method: 'GET' });

						// Verify the SELECT query includes ORDER BY executed_at DESC
						expect(mockExecute).toHaveBeenNthCalledWith(
							2,
							'SELECT version, executed_at, execution_time_ms FROM schema_migrations ORDER BY executed_at DESC'
						);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Edge Cases', () => {
			it('should handle migrations with special characters in filenames', async () => {
				mockReaddir.mockResolvedValueOnce(['001_initial-schema.sql', '002_add_users_table.sql', '003_update-indexes.sql']);

				mockExecute
					.mockResolvedValueOnce([[{ Tables_in_db: 'schema_migrations' }], []])
					.mockResolvedValueOnce([[{ version: '002_add_users_table.sql', executed_at: new Date(), execution_time_ms: 50 }], []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						const data = await response.json();
						expect(response.status).toBe(200);
						expect(data.migrations).toHaveLength(3);

						// Check that special characters are preserved
						const migrationData = data as MigrationStatusResponse;
						expect(migrationData.migrations.map(m => m.version)).toContain('001_initial-schema.sql');
						expect(migrationData.migrations.map(m => m.version)).toContain('002_add_users_table.sql');
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle very long migration filenames', async () => {
				const longFilename = '001_' + 'a'.repeat(200) + '.sql';
				mockReaddir.mockResolvedValueOnce([longFilename]);
				mockExecute.mockResolvedValueOnce([[], []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'GET',
						});

						const data = await response.json();
						expect(response.status).toBe(200);
						expect(data.migrations[0].version).toBe(longFilename);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle concurrent requests properly', async () => {
				// Setup same mocks for multiple concurrent requests
				mockReaddir.mockResolvedValue(['001_initial.sql']);
				mockExecute.mockResolvedValueOnce([[], []]).mockResolvedValueOnce([[], []]).mockResolvedValueOnce([[], []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						// Make concurrent requests
						const promises = [fetch({ method: 'GET' }), fetch({ method: 'GET' }), fetch({ method: 'GET' })];

						const responses = await Promise.all(promises);

						// All should succeed
						responses.forEach(response => {
							expect(response.status).toBe(200);
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});
	});
});
