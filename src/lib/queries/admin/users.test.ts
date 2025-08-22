import { getAllUsers, getUserById, updateUser, deleteUser, getUserStats } from './users';
import pool from '../../db.js';

// Mock the database pool
jest.mock('../../db.js', () => ({
  __esModule: true,
  default: {
    execute: jest.fn(),
  },
}));

const mockPool = pool as jest.Mocked<typeof pool>;

describe('Admin Users Queries', () => {
  const mockUsers = [
    {
      id: 1,
      username: 'user1',
      email: 'user1@example.com',
      first_name: 'John',
      last_name: 'Doe',
      is_active: true,
      is_admin: false,
      date_joined: '2024-01-01T00:00:00.000Z',
      last_login: '2024-01-02T00:00:00.000Z'
    },
    {
      id: 2,
      username: 'admin',
      email: 'admin@example.com',
      first_name: 'Admin',
      last_name: 'User',
      is_active: true,
      is_admin: true,
      date_joined: '2024-01-01T00:00:00.000Z',
      last_login: '2024-01-02T00:00:00.000Z'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    it('returns all users ordered by date_joined DESC', async () => {
      mockPool.execute.mockResolvedValue([mockUsers] as any);

      const result = await getAllUsers();

      expect(result).toEqual(mockUsers);
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT')
      );
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY u.date_joined DESC')
      );
    });

    it('returns empty array when no users exist', async () => {
      mockPool.execute.mockResolvedValue([[]] as any);

      const result = await getAllUsers();

      expect(result).toEqual([]);
    });

    it('handles database errors', async () => {
      mockPool.execute.mockRejectedValue(new Error('Database connection failed'));

      await expect(getAllUsers()).rejects.toThrow('Database connection failed');
    });

    it('selects correct user fields', async () => {
      mockPool.execute.mockResolvedValue([mockUsers] as any);

      await getAllUsers();

      const query = mockPool.execute.mock.calls[0][0] as string;
      expect(query).toContain('u.id');
      expect(query).toContain('u.username');
      expect(query).toContain('u.first_name');
      expect(query).toContain('u.last_name');
      expect(query).toContain('u.email');
      expect(query).toContain('u.is_active');
      expect(query).toContain('u.is_admin');
      expect(query).toContain('u.date_joined');
      expect(query).toContain('u.last_login');
    });
  });

  describe('getUserById', () => {
    it('returns user when found', async () => {
      mockPool.execute.mockResolvedValue([[mockUsers[0]]] as any);

      const result = await getUserById(1);

      expect(result).toEqual(mockUsers[0]);
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('WHERE u.id = ?'),
        [1]
      );
    });

    it('returns null when user not found', async () => {
      mockPool.execute.mockResolvedValue([[]] as any);

      const result = await getUserById(999);

      expect(result).toBeNull();
    });

    it('handles database errors', async () => {
      mockPool.execute.mockRejectedValue(new Error('Database error'));

      await expect(getUserById(1)).rejects.toThrow('Database error');
    });

    it('uses parameterized query to prevent SQL injection', async () => {
      mockPool.execute.mockResolvedValue([[mockUsers[0]]] as any);

      await getUserById(1);

      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.any(String),
        [1]
      );
    });
  });

  describe('updateUser', () => {
    const updateData = {
      username: 'newusername',
      email: 'newemail@example.com',
      first_name: 'NewFirst',
      is_active: false
    };

    it('updates user successfully', async () => {
      mockPool.execute.mockResolvedValue([{ affectedRows: 1 }] as any);

      const result = await updateUser(1, updateData);

      expect(result).toBe(true);
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        ['newusername', 'NewFirst', 'newemail@example.com', 0, 1]
      );
    });

    it('returns false when user not found', async () => {
      mockPool.execute.mockResolvedValue([{ affectedRows: 0 }] as any);

      const result = await updateUser(999, updateData);

      expect(result).toBe(false);
    });

    it('handles partial updates', async () => {
      const partialUpdate = { username: 'newusername' };
      mockPool.execute.mockResolvedValue([{ affectedRows: 1 }] as any);

      const result = await updateUser(1, partialUpdate);

      expect(result).toBe(true);
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET'),
        expect.arrayContaining(['newusername', 1])
      );
    });

    it('handles database errors', async () => {
      mockPool.execute.mockRejectedValue(new Error('Update failed'));

      await expect(updateUser(1, updateData)).rejects.toThrow('Update failed');
    });

    it('prevents updating when no fields provided', async () => {
      const result = await updateUser(1, {});

      expect(result).toBe(false);
      expect(mockPool.execute).not.toHaveBeenCalled();
    });

    it('uses parameterized query to prevent SQL injection', async () => {
      mockPool.execute.mockResolvedValue([{ affectedRows: 1 }] as any);

      await updateUser(1, { username: 'test' });

      const [query, params] = mockPool.execute.mock.calls[0];
      expect(query).toContain('?');
      expect(params).toEqual(['test', 1]);
    });
  });

  describe('deleteUser', () => {
    it('deletes user successfully', async () => {
      mockPool.execute.mockResolvedValue([{ affectedRows: 1 }] as any);

      const result = await deleteUser(1);

      expect(result).toBe(true);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = ?',
        [1]
      );
    });

    it('returns false when user not found', async () => {
      mockPool.execute.mockResolvedValue([{ affectedRows: 0 }] as any);

      const result = await deleteUser(999);

      expect(result).toBe(false);
    });

    it('handles database errors', async () => {
      mockPool.execute.mockRejectedValue(new Error('Delete failed'));

      await expect(deleteUser(1)).rejects.toThrow('Delete failed');
    });

    it('uses parameterized query to prevent SQL injection', async () => {
      mockPool.execute.mockResolvedValue([{ affectedRows: 1 }] as any);

      await deleteUser(1);

      expect(mockPool.execute).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = ?',
        [1]
      );
    });
  });

  describe('getUserStats', () => {
    const mockStatsResult = [{
      total: 10,
      active: 8,
      admins: 2
    }];

    it('returns user statistics', async () => {
      mockPool.execute.mockResolvedValue([mockStatsResult] as any);

      const result = await getUserStats();

      expect(result).toEqual({
        total: 10,
        active: 8,
        admins: 2
      });
      expect(mockPool.execute).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) as total')
      );
    });

    it('calculates correct statistics', async () => {
      mockPool.execute.mockResolvedValue([mockStatsResult] as any);

      await getUserStats();

      const query = mockPool.execute.mock.calls[0][0] as string;
      expect(query).toContain('COUNT(*) as total');
      expect(query).toContain('SUM(is_active) as active');
      expect(query).toContain('SUM(is_admin) as admins');
    });

    it('handles empty database', async () => {
      mockPool.execute.mockResolvedValue([[{
        total: 0,
        active: 0,
        admins: 0
      }]] as any);

      const result = await getUserStats();

      expect(result).toEqual({
        total: 0,
        active: 0,
        admins: 0
      });
    });

    it('handles database errors', async () => {
      mockPool.execute.mockRejectedValue(new Error('Stats query failed'));

      await expect(getUserStats()).rejects.toThrow('Stats query failed');
    });
  });
});