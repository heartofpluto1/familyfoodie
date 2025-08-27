import { authenticateUserWithHousehold, validateSessionWithHousehold } from './auth';
import pool from './db.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Mock the database pool
jest.mock('./db.js');
const mockPool = pool as jest.Mocked<typeof pool>;

// Mock the toast function
jest.mock('@/lib/toast', () => ({
	addToast: jest.fn(),
}));

// Mock the crypto module for password verification
jest.mock('crypto', () => ({
	pbkdf2Sync: jest.fn(),
}));

import * as crypto from 'crypto';
const mockPbkdf2Sync = crypto.pbkdf2Sync as jest.MockedFunction<typeof crypto.pbkdf2Sync>;

describe('Authentication with Household Context', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('authenticateUserWithHousehold', () => {
		it('should authenticate user and return household context', async () => {
			// Mock user with household data
			const mockUser = {
				id: 1,
				username: 'testuser',
				email: 'test@example.com',
				first_name: 'Test',
				last_name: 'User',
				password: 'pbkdf2_sha256$100000$salt123$aGFzaGVkUGFzc3dvcmQ=', // base64 of 'hashedPassword'
				is_active: 1,
				is_admin: 0,
				household_id: 1,
				household_name: 'Spencer',
			};

			// Mock database response
			mockPool.execute
				.mockResolvedValueOnce([[mockUser] as RowDataPacket[], []]) // User lookup with household
				.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader, []]); // Update last_login

			// Mock password verification to succeed
			mockPbkdf2Sync.mockReturnValue(Buffer.from('aGFzaGVkUGFzc3dvcmQ=', 'base64'));

			const result = await authenticateUserWithHousehold('testuser', 'password123');

			expect(result.success).toBe(true);
			expect(result.user).toEqual({
				id: 1,
				username: 'testuser',
				email: 'test@example.com',
				first_name: 'Test',
				last_name: 'User',
				is_active: 1,
				is_admin: 0,
				household_id: 1,
				household_name: 'Spencer',
			});

			// Verify database queries
			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('JOIN households h ON u.household_id = h.id'), ['testuser']);
		});

		it('should reject authentication for invalid username', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			const result = await authenticateUserWithHousehold('invaliduser', 'password123');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid username or password');
			expect(result.user).toBeUndefined();
		});

		it('should reject authentication for invalid password', async () => {
			const mockUser = {
				id: 1,
				username: 'testuser',
				password: 'pbkdf2_sha256$100000$salt123$Y29ycmVjdEhhc2g=', // base64 of 'correctHash'
				is_active: 1,
				household_id: 1,
				household_name: 'Spencer',
			};

			mockPool.execute.mockResolvedValueOnce([[mockUser] as RowDataPacket[], []]);

			// Mock password verification to fail
			mockPbkdf2Sync.mockReturnValue(Buffer.from('d3JvbmdIYXNo', 'base64')); // base64 of 'wrongHash'

			const result = await authenticateUserWithHousehold('testuser', 'wrongpassword');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid username or password');
		});
	});

	describe('validateSessionWithHousehold', () => {
		it('should return user with household context for valid user ID', async () => {
			const mockUser = {
				id: 1,
				username: 'testuser',
				email: 'test@example.com',
				first_name: 'Test',
				last_name: 'User',
				is_active: 1,
				is_admin: 0,
				household_id: 1,
				household_name: 'Spencer',
			};

			mockPool.execute.mockResolvedValueOnce([[mockUser] as RowDataPacket[], []]);

			const result = await validateSessionWithHousehold(1);

			expect(result).toEqual(mockUser);
			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('JOIN households h ON u.household_id = h.id'), [1]);
		});

		it('should return null for invalid user ID', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			const result = await validateSessionWithHousehold(999);

			expect(result).toBeNull();
		});

		it('should return null for inactive user', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			const result = await validateSessionWithHousehold(1);

			expect(result).toBeNull();
		});

		it('should handle database errors gracefully', async () => {
			mockPool.execute.mockRejectedValueOnce(new Error('Database connection failed'));

			const result = await validateSessionWithHousehold(1);

			expect(result).toBeNull();
		});
	});
});
