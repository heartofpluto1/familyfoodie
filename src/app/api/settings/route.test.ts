/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import pool from '@/lib/db.js';
import { clearAllMocks, setupConsoleMocks, mockRegularUser } from '@/lib/test-utils';
import type { SessionUser } from '@/types/auth';
import { RowDataPacket } from 'mysql2';

// Mock the database BEFORE other imports
jest.mock('@/lib/db.js', () => ({
	__esModule: true,
	default: {
		execute: jest.fn(),
		getConnection: jest.fn(),
	},
}));

// Mock the auth middleware using test utils
jest.mock('@/lib/auth-middleware', () => jest.requireActual('@/lib/test-utils').authMiddlewareMock);

// Helper to mock authenticated requests
interface AuthenticatedRequest extends Request {
	user?: SessionUser;
	household_id?: number;
	household_name?: string;
}

const mockAuthenticatedUser = (request: AuthenticatedRequest, options: Partial<SessionUser> = {}) => {
	request.user = { ...mockRegularUser, ...options };
	request.household_id = request.user.household_id;
	request.household_name = 'Test Household';
};

const mockExecute = pool.execute as jest.MockedFunction<typeof pool.execute>;

beforeEach(() => {
	clearAllMocks();
	setupConsoleMocks();
});

describe('/api/settings GET', () => {
	it('should return 401 when user is not authenticated', async () => {
		await testApiHandler({
			appHandler,
			test: async ({ fetch }) => {
				const response = await fetch({ method: 'GET' });
				expect(response.status).toBe(401);

				const data = await response.json();
				expect(data.error).toBe('Authentication required');
			},
		});
	});

	it('should return 403 when user is not in the household', async () => {
		mockExecute.mockResolvedValueOnce([[] as RowDataPacket[], []]); // Empty user validation result

		await testApiHandler({
			appHandler,
			requestPatcher: req => {
				const authReq = req as AuthenticatedRequest;
				mockAuthenticatedUser(authReq, { id: 1, household_id: 123 });
				authReq.household_id = 123;
			},
			test: async ({ fetch }) => {
				const response = await fetch({ method: 'GET' });
				expect(response.status).toBe(403);

				const data = await response.json();
				expect(data.error).toBe('User not authorized for this household');

				expect(mockExecute).toHaveBeenCalledWith(`SELECT id FROM users WHERE id = ? AND household_id = ?`, [1, 123]);
			},
		});
	});

	it('should return household data when user is authorized', async () => {
		const mockUserValidation = [{ id: 1 }];
		const mockHouseholdMembers = [{ username: 'alice' }, { username: 'bob' }, { username: 'testuser' }];

		mockExecute
			.mockResolvedValueOnce([mockUserValidation as RowDataPacket[], []]) // User validation query
			.mockResolvedValueOnce([mockHouseholdMembers as RowDataPacket[], []]); // Household members query

		await testApiHandler({
			appHandler,
			requestPatcher: req => {
				const authReq = req as AuthenticatedRequest;
				mockAuthenticatedUser(authReq, { id: 1, household_id: 123, household_name: 'Test Household' });
				authReq.household_id = 123;
			},
			test: async ({ fetch }) => {
				const response = await fetch({ method: 'GET' });
				expect(response.status).toBe(200);

				const data = await response.json();
				expect(data).toEqual({
					household_name: 'Test Household',
					members: ['alice', 'bob', 'testuser'],
				});

				expect(mockExecute).toHaveBeenCalledTimes(2);
				expect(mockExecute).toHaveBeenNthCalledWith(1, `SELECT id FROM users WHERE id = ? AND household_id = ?`, [1, 123]);
				expect(mockExecute).toHaveBeenNthCalledWith(
					2,
					`SELECT username 
			 FROM users 
			 WHERE household_id = ? 
			 ORDER BY username ASC`,
					[123]
				);
			},
		});
	});

	it('should return empty members array when no household members found', async () => {
		const mockUserValidation = [{ id: 1 }];

		mockExecute
			.mockResolvedValueOnce([mockUserValidation as RowDataPacket[], []]) // User validation query
			.mockResolvedValueOnce([[] as RowDataPacket[], []]); // Empty household members query

		await testApiHandler({
			appHandler,
			requestPatcher: req => {
				const authReq = req as AuthenticatedRequest;
				mockAuthenticatedUser(authReq, { id: 1, household_id: 456, household_name: 'Empty Household' });
				authReq.household_id = 456;
			},
			test: async ({ fetch }) => {
				const response = await fetch({ method: 'GET' });
				expect(response.status).toBe(200);

				const data = await response.json();
				expect(data).toEqual({
					household_name: 'Empty Household',
					members: [],
				});
			},
		});
	});

	it('should handle single member household', async () => {
		const mockUserValidation = [{ id: 1 }];
		const mockHouseholdMembers = [{ username: 'onlyuser' }];

		mockExecute.mockResolvedValueOnce([mockUserValidation as RowDataPacket[], []]).mockResolvedValueOnce([mockHouseholdMembers as RowDataPacket[], []]);

		await testApiHandler({
			appHandler,
			requestPatcher: req => {
				const authReq = req as AuthenticatedRequest;
				mockAuthenticatedUser(authReq, { id: 1, household_id: 789, household_name: 'Single Household' });
				authReq.household_id = 789;
			},
			test: async ({ fetch }) => {
				const response = await fetch({ method: 'GET' });
				expect(response.status).toBe(200);

				const data = await response.json();
				expect(data).toEqual({
					household_name: 'Single Household',
					members: ['onlyuser'],
				});
			},
		});
	});

	it('should handle database errors gracefully', async () => {
		mockExecute.mockRejectedValueOnce(new Error('Database connection failed'));

		await testApiHandler({
			appHandler,
			requestPatcher: req => {
				const authReq = req as AuthenticatedRequest;
				mockAuthenticatedUser(authReq, { id: 1, household_id: 123 });
				authReq.household_id = 123;
			},
			test: async ({ fetch }) => {
				const response = await fetch({ method: 'GET' });
				expect(response.status).toBe(500);

				const data = await response.json();
				expect(data.error).toBe('Failed to fetch household members');
			},
		});
	});

	it('should handle members with special characters in usernames', async () => {
		const mockUserValidation = [{ id: 1 }];
		const mockHouseholdMembers = [{ username: 'test_user-123' }, { username: 'user.with.dots' }, { username: 'user@domain' }];

		mockExecute.mockResolvedValueOnce([mockUserValidation as RowDataPacket[], []]).mockResolvedValueOnce([mockHouseholdMembers as RowDataPacket[], []]);

		await testApiHandler({
			appHandler,
			requestPatcher: req => {
				const authReq = req as AuthenticatedRequest;
				mockAuthenticatedUser(authReq, { id: 1, household_id: 123, household_name: 'Special Chars Household' });
				authReq.household_id = 123;
			},
			test: async ({ fetch }) => {
				const response = await fetch({ method: 'GET' });
				expect(response.status).toBe(200);

				const data = await response.json();
				expect(data.members).toEqual(['test_user-123', 'user.with.dots', 'user@domain']);
			},
		});
	});
});
