// __tests__/api/test-db/route.test.js
import { GET, POST } from '../../../src/app/api/test-db/route';

// Mock the database pool
jest.mock('../../../src/lib/db', () => ({
  execute: jest.fn(),
}));

// Mock Response.json for Next.js API routes
global.Response = {
  json: jest.fn((data, init) => ({
    json: async () => data,
    status: init?.status || 200,
    ...init,
  })),
};

describe('/api/test-db', () => {
  const mockPool = require('../../../src/lib/db');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return successful response with data when database query succeeds', async () => {
      // Arrange
      const mockRows = [
        { week: 45, year: 2024 },
        { week: 44, year: 2024 },
        { week: 43, year: 2024 }
      ];
      mockPool.execute.mockResolvedValue([mockRows]);

      // Act
      const response = await GET();

      // Assert
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT week, year from menus_recipeweek order by year desc, week desc limit 10'
      );
      expect(Response.json).toHaveBeenCalledWith({
        message: 'Database connected successfully',
        data: mockRows
      });
      expect(response.status).toBe(200);
    });

    it('should return successful response with empty data when no records found', async () => {
      // Arrange
      const mockRows = [];
      mockPool.execute.mockResolvedValue([mockRows]);

      // Act
      const response = await GET();

      // Assert
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT week, year from menus_recipeweek order by year desc, week desc limit 10'
      );
      expect(Response.json).toHaveBeenCalledWith({
        message: 'Database connected successfully',
        data: mockRows
      });
      expect(response.status).toBe(200);
    });

    it('should return 500 error when database query fails with error object', async () => {
      // Arrange
      const mockError = new Error('Connection timeout');
      mockPool.execute.mockRejectedValue(mockError);

      // Act
      const response = await GET();

      // Assert
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT week, year from menus_recipeweek order by year desc, week desc limit 10'
      );
      expect(Response.json).toHaveBeenCalledWith(
        {
          error: 'Database connection failed',
          details: 'Connection timeout'
        },
        { status: 500 }
      );
      expect(response.status).toBe(500);
    });

    it('should handle database error with custom error message', async () => {
      // Arrange
      const mockError = new Error('Table does not exist');
      mockPool.execute.mockRejectedValue(mockError);

      // Act
      const response = await GET();

      // Assert
      expect(Response.json).toHaveBeenCalledWith(
        {
          error: 'Database connection failed',
          details: 'Table does not exist'
        },
        { status: 500 }
      );
    });

    it('should handle database error without message property', async () => {
      // Arrange
      const mockError = { code: 'ER_NO_SUCH_TABLE' };
      mockPool.execute.mockRejectedValue(mockError);

      // Act
      const response = await GET();

      // Assert
      expect(Response.json).toHaveBeenCalledWith(
        {
          error: 'Database connection failed',
          details: "Unknown error"
        },
        { status: 500 }
      );
    });

    it('should handle string error thrown by database', async () => {
      // Arrange
      mockPool.execute.mockRejectedValue('Database unavailable');

      // Act
      const response = await GET();

      // Assert
      expect(Response.json).toHaveBeenCalledWith(
        {
          error: 'Database connection failed',
          details: "Unknown error"
        },
        { status: 500 }
      );
    });

    it('should verify exact SQL query is executed', async () => {
      // Arrange
      mockPool.execute.mockResolvedValue([[]]);

      // Act
      await GET();

      // Assert
      expect(mockPool.execute).toHaveBeenCalledTimes(1);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT week, year from menus_recipeweek order by year desc, week desc limit 10'
      );
    });

    it('should handle database query returning multiple result sets', async () => {
      // Arrange
      const mockRows = [{ week: 1, year: 2024 }];
      const mockMetadata = { affectedRows: 1 };
      mockPool.execute.mockResolvedValue([mockRows, mockMetadata]);

      // Act
      const response = await GET();

      // Assert
      expect(Response.json).toHaveBeenCalledWith({
        message: 'Database connected successfully',
        data: mockRows
      });
    });
  });

  describe('POST', () => {
    it('should return POST method message for POST requests', async () => {
      // Act
      const response = await POST();

      // Assert
      expect(Response.json).toHaveBeenCalledWith({
        message: 'POST method'
      });
      expect(response.status).toBe(200);
    });

    it('should not call database pool for POST requests', async () => {
      // Act
      await POST();

      // Assert
      expect(mockPool.execute).not.toHaveBeenCalled();
    });

    it('should return response object with correct structure', async () => {
      // Act
      const response = await POST();

      // Assert
      expect(typeof response).toBe('object');
      expect(response).toHaveProperty('json');
      expect(typeof response.json).toBe('function');
    });
  });

  describe('Error edge cases', () => {
    it('should handle null error', async () => {
      // Arrange
      mockPool.execute.mockRejectedValue(null);

      // Act
      const response = await GET();

      // Assert
      expect(Response.json).toHaveBeenCalledWith(
        {
          error: 'Database connection failed',
          details: "Unknown error"
        },
        { status: 500 }
      );
    });

    it('should handle unknown error', async () => {
      // Arrange
      mockPool.execute.mockRejectedValue("Unknown error");

      // Act
      const response = await GET();

      // Assert
      expect(Response.json).toHaveBeenCalledWith(
        {
          error: 'Database connection failed',
          details: "Unknown error"
        },
        { status: 500 }
      );
    });
  });

  describe('Response format validation', () => {
    it('should return response with correct content type structure for successful GET', async () => {
      // Arrange
      mockPool.execute.mockResolvedValue([[]]);

      // Act
      const response = await GET();

      // Assert
      const responseData = await response.json();
      expect(responseData).toHaveProperty('message');
      expect(responseData).toHaveProperty('data');
      expect(responseData.message).toBe('Database connected successfully');
      expect(Array.isArray(responseData.data)).toBe(true);
    });

    it('should return response with correct error structure for failed GET', async () => {
      // Arrange
      mockPool.execute.mockRejectedValue(new Error('Test error'));

      // Act
      const response = await GET();

      // Assert
      const responseData = await response.json();
      expect(responseData).toHaveProperty('error');
      expect(responseData).toHaveProperty('details');
      expect(responseData.error).toBe('Database connection failed');
      expect(responseData.details).toBe('Test error');
    });
  });
});