/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import { NextResponse } from 'next/server';
import * as appHandler from './route';
import pool from '@/lib/db.js';
import { requireAuth } from '@/lib/auth/helpers';
import { setupConsoleMocks, mockRegularSession } from '@/lib/test-utils';
import { RowDataPacket } from 'mysql2';

// Mock the database BEFORE other imports
jest.mock('@/lib/db.js', () => ({
	__esModule: true,
	default: {
		execute: jest.fn(),
		getConnection: jest.fn(),
	},
}));

// Mock the auth helpers
jest.mock('@/lib/auth/helpers', () => ({
	requireAuth: jest.fn(),
}));

const mockExecute = pool.execute as jest.MockedFunction<typeof pool.execute>;
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

describe('/api/settings GET', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	beforeEach(() => {
		jest.clearAllMocks();
		consoleMocks = setupConsoleMocks();
	});

	afterEach(() => {
		consoleMocks.cleanup();
	});

	it('should return 401 when user is not authenticated', async () => {
		const mockResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		mockRequireAuth.mockResolvedValue({
			authorized: false as const,
			response: mockResponse,
		});

		await testApiHandler({
			appHandler,
			test: async ({ fetch }) => {
				const response = await fetch({ method: 'GET' });
				expect(response.status).toBe(401);

				const data = await response.json();
				expect(data.error).toBe('Unauthorized');
			},
		});
	});

	it('should return 403 when user is not in the household', async () => {
		mockRequireAuth.mockResolvedValue({
			authorized: true as const,
			session: mockRegularSession,
			household_id: mockRegularSession.user.household_id,
			user_id: mockRegularSession.user.id,
		});
		mockExecute.mockResolvedValueOnce([[] as RowDataPacket[], []]); // Empty user validation result

		await testApiHandler({
			appHandler,
			test: async ({ fetch }) => {
				const response = await fetch({ method: 'GET' });
				expect(response.status).toBe(403);

				const data = await response.json();
				expect(data.error).toBe('User not authorized for this household');

				expect(mockExecute).toHaveBeenCalledWith(`SELECT id FROM users WHERE id = ? AND household_id = ?`, ['2', 1]);
			},
		});
	});

	it('should return household data when user is authorized', async () => {
		mockRequireAuth.mockResolvedValue({
			authorized: true as const,
			session: mockRegularSession,
			household_id: mockRegularSession.user.household_id,
			user_id: mockRegularSession.user.id,
		});
		const mockUserValidation = [{ id: 2 }];
		const mockHouseholdMembers = [{ email: 'alice@example.com' }, { email: 'bob@example.com' }, { email: 'user@example.com' }];

		mockExecute
			.mockResolvedValueOnce([mockUserValidation as RowDataPacket[], []]) // User validation query
			.mockResolvedValueOnce([mockHouseholdMembers as RowDataPacket[], []]); // Household members query

		await testApiHandler({
			appHandler,
			test: async ({ fetch }) => {
				const response = await fetch({ method: 'GET' });
				expect(response.status).toBe(200);

				const data = await response.json();
				expect(data).toEqual({
					household_name: 'Test Household',
					members: ['alice@example.com', 'bob@example.com', 'user@example.com'],
				});

				expect(mockExecute).toHaveBeenCalledWith(`SELECT id FROM users WHERE id = ? AND household_id = ?`, ['2', 1]);
				expect(mockExecute).toHaveBeenCalledWith(
					`SELECT email 
			 FROM users 
			 WHERE household_id = ? 
			 ORDER BY email ASC`,
					[1]
				);
			},
		});
	});

	it('should return empty members array when no household members found', async () => {
		mockRequireAuth.mockResolvedValue({
			authorized: true as const,
			session: mockRegularSession,
			household_id: mockRegularSession.user.household_id,
			user_id: mockRegularSession.user.id,
		});
		const mockUserValidation = [{ id: 2 }];

		mockExecute
			.mockResolvedValueOnce([mockUserValidation as RowDataPacket[], []]) // User validation query
			.mockResolvedValueOnce([[] as RowDataPacket[], []]); // Empty household members

		await testApiHandler({
			appHandler,
			test: async ({ fetch }) => {
				const response = await fetch({ method: 'GET' });
				expect(response.status).toBe(200);

				const data = await response.json();
				expect(data).toEqual({
					household_name: 'Test Household',
					members: [],
				});
			},
		});
	});

	it('should handle single member household', async () => {
		mockRequireAuth.mockResolvedValue({
			authorized: true as const,
			session: mockRegularSession,
			household_id: mockRegularSession.user.household_id,
			user_id: mockRegularSession.user.id,
		});
		const mockUserValidation = [{ id: 2 }];
		const mockHouseholdMembers = [{ email: 'user@example.com' }];

		mockExecute
			.mockResolvedValueOnce([mockUserValidation as RowDataPacket[], []]) // User validation query
			.mockResolvedValueOnce([mockHouseholdMembers as RowDataPacket[], []]); // Single household member

		await testApiHandler({
			appHandler,
			test: async ({ fetch }) => {
				const response = await fetch({ method: 'GET' });
				expect(response.status).toBe(200);

				const data = await response.json();
				expect(data).toEqual({
					household_name: 'Test Household',
					members: ['user@example.com'],
				});
			},
		});
	});

	it('should handle database errors gracefully', async () => {
		mockRequireAuth.mockResolvedValue({
			authorized: true as const,
			session: mockRegularSession,
			household_id: mockRegularSession.user.household_id,
			user_id: mockRegularSession.user.id,
		});
		mockExecute.mockRejectedValueOnce(new Error('Database connection failed'));

		await testApiHandler({
			appHandler,
			test: async ({ fetch }) => {
				const response = await fetch({ method: 'GET' });
				expect(response.status).toBe(500);

				const data = await response.json();
				expect(data.error).toBe('Failed to fetch household members');

				expect(consoleMocks.mockConsoleError).toHaveBeenCalledWith('Error fetching household members:', expect.any(Error));
			},
		});
	});

	it('should handle members with special characters in emails', async () => {
		mockRequireAuth.mockResolvedValue({
			authorized: true as const,
			session: mockRegularSession,
			household_id: mockRegularSession.user.household_id,
			user_id: mockRegularSession.user.id,
		});
		const mockUserValidation = [{ id: 2 }];
		const mockHouseholdMembers = [{ email: 'test+alias@example.com' }, { email: 'user.name@sub.domain.com' }, { email: 'special_chars-123@test.org' }];

		mockExecute
			.mockResolvedValueOnce([mockUserValidation as RowDataPacket[], []]) // User validation query
			.mockResolvedValueOnce([mockHouseholdMembers as RowDataPacket[], []]); // Household members with special characters

		await testApiHandler({
			appHandler,
			test: async ({ fetch }) => {
				const response = await fetch({ method: 'GET' });
				expect(response.status).toBe(200);

				const data = await response.json();
				expect(data).toEqual({
					household_name: 'Test Household',
					members: ['test+alias@example.com', 'user.name@sub.domain.com', 'special_chars-123@test.org'],
				});
			},
		});
	});
});
