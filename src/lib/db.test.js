// Mock mysql2/promise before importing db module
jest.mock('mysql2/promise', () => ({
  createPool: jest.fn(() => ({
    getConnection: jest.fn(),
    execute: jest.fn(),
    end: jest.fn(),
  })),
}));

describe('Database Pool Configuration', () => {
  let mysql;
  let originalEnv;

  beforeEach(async () => {
    // Clear all mocks and reset modules
    jest.clearAllMocks();
    jest.resetModules();

    // Store original environment
    originalEnv = { ...process.env };

    // Clear environment variables
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;
    delete process.env.DB_INSTANCE_UNIX_SOCKET;

    // Re-import mysql mock
    mysql = await import('mysql2/promise');
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Pool Creation with Environment Variables', () => {
    it('creates pool with all environment variables set', async () => {
      // Set environment variables
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '3306';
      process.env.DB_USER = 'testuser';
      process.env.DB_PASSWORD = 'testpass';
      process.env.DB_NAME = 'testdb';
      process.env.DB_INSTANCE_UNIX_SOCKET = '/var/run/mysqld/mysqld.sock';

      // Import the module after setting env vars
      await import('./db.js');

      expect(mysql.createPool).toHaveBeenCalledWith({
        host: 'localhost',
        port: '3306',
        user: 'testuser',
        password: 'testpass',
        database: 'testdb',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        socketPath: '/var/run/mysqld/mysqld.sock',
      });
    });

    it('creates pool with cloud SQL socket path', async () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_USER = 'clouduser';
      process.env.DB_PASSWORD = 'cloudpass';
      process.env.DB_NAME = 'clouddb';
      process.env.DB_INSTANCE_UNIX_SOCKET = '/cloudsql/project:region:instance';

      await import('./db.js');

      expect(mysql.createPool).toHaveBeenCalledWith({
        host: 'localhost',
        port: undefined,
        user: 'clouduser',
        password: 'cloudpass',
        database: 'clouddb',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        socketPath: '/cloudsql/project:region:instance',
      });
    });

    it('creates pool with minimal configuration', async () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_USER = 'user';
      process.env.DB_NAME = 'db';

      await import('./db.js');

      expect(mysql.createPool).toHaveBeenCalledWith({
        host: 'localhost',
        port: undefined,
        user: 'user',
        password: undefined,
        database: 'db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        socketPath: undefined,
      });
    });
  });

  describe('Pool Creation without Environment Variables', () => {
    it('creates pool with undefined values when no env vars are set', async () => {
      await import('./db.js');

      expect(mysql.createPool).toHaveBeenCalledWith({
        host: undefined,
        port: undefined,
        user: undefined,
        password: undefined,
        database: undefined,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        socketPath: undefined,
      });
    });
  });

  describe('Pool Configuration Settings', () => {
    it('configures pool with correct connection settings', async () => {
      await import('./db.js');

      const poolConfig = mysql.createPool.mock.calls[0][0];
      expect(poolConfig.waitForConnections).toBe(true);
      expect(poolConfig.connectionLimit).toBe(10);
      expect(poolConfig.queueLimit).toBe(0);
    });

    it('exports the pool instance', async () => {
      const dbModule = await import('./db.js');
      expect(dbModule.default).toBeDefined();
    });
  });

  describe('Different Environment Scenarios', () => {
    it('handles production-like environment', async () => {
      process.env.DB_HOST = 'prod-db.example.com';
      process.env.DB_PORT = '3306';
      process.env.DB_USER = 'prod_user';
      process.env.DB_PASSWORD = 'secure_prod_password';
      process.env.DB_NAME = 'production_db';

      await import('./db.js');

      expect(mysql.createPool).toHaveBeenCalledWith({
        host: 'prod-db.example.com',
        port: '3306',
        user: 'prod_user',
        password: 'secure_prod_password',
        database: 'production_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        socketPath: undefined,
      });
    });

    it('handles development environment', async () => {
      process.env.DB_HOST = '127.0.0.1';
      process.env.DB_PORT = '3307';
      process.env.DB_USER = 'dev';
      process.env.DB_PASSWORD = 'dev123';
      process.env.DB_NAME = 'familyfoodie_dev';

      await import('./db.js');

      expect(mysql.createPool).toHaveBeenCalledWith({
        host: '127.0.0.1',
        port: '3307',
        user: 'dev',
        password: 'dev123',
        database: 'familyfoodie_dev',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        socketPath: undefined,
      });
    });

    it('handles empty string environment variables', async () => {
      process.env.DB_HOST = '';
      process.env.DB_PORT = '';
      process.env.DB_USER = 'user';
      process.env.DB_PASSWORD = '';
      process.env.DB_NAME = 'db';

      await import('./db.js');

      expect(mysql.createPool).toHaveBeenCalledWith({
        host: '',
        port: '',
        user: 'user',
        password: '',
        database: 'db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        socketPath: undefined,
      });
    });
  });

  describe('Module Import Behavior', () => {
    it('creates pool only once when imported multiple times', async () => {
      await import('./db.js');
      await import('./db.js');

      expect(mysql.createPool).toHaveBeenCalledTimes(1);
    });

    it('exports default pool instance', async () => {
      const dbModule = await import('./db.js');
      const mockPool = mysql.createPool.mock.results[0].value;
      
      expect(dbModule.default).toBe(mockPool);
    });
  });
});