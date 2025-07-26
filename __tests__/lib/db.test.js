// Mock mysql2/promise before any imports
jest.mock('mysql2/promise', () => ({
  createPool: jest.fn(() => ({
    getConnection: jest.fn(),
    execute: jest.fn(),
    end: jest.fn(),
  })),
}))

describe('Database Pool', () => {
  let mysql

  beforeEach(async () => {
    // Clear all mocks and reset modules
    jest.clearAllMocks()
    jest.resetModules()
    
    // Clear environment variables
    delete process.env.DB_HOST
    delete process.env.DB_PORT
    delete process.env.DB_USER
    delete process.env.DB_PASSWORD
    delete process.env.DB_NAME
    delete process.env.DB_INSTANCE_UNIX_SOCKET
    
    // Re-import mysql mock
    mysql = await import('mysql2/promise')
  })

  it('creates pool with environment variables', async () => {
    // Set environment variables
    process.env.DB_HOST = 'test-host'
    process.env.DB_PORT = '3307'
    process.env.DB_USER = 'test-user'
    process.env.DB_PASSWORD = 'test-password'
    process.env.DB_NAME = 'test-database'
    process.env.DB_INSTANCE_UNIX_SOCKET = '/cloudsql/test-instance'

    // Import the module after setting env vars
    await import('@/lib/db')

    expect(mysql.createPool).toHaveBeenCalledWith({
      host: 'test-host',
      port: '3307',
      user: 'test-user',
      password: 'test-password',
      database: 'test-database',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      socketPath: '/cloudsql/test-instance',
    })
  })

  it('uses default values when environment variables are missing', async () => {
    // Import without setting env vars
    await import('@/lib/db')

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
    })
  })

  it('exports the pool instance', async () => {
    const dbModule = await import('@/lib/db')
    expect(dbModule.default).toBeDefined()
  })

  it('configures pool with correct connection settings', async () => {
    await import('@/lib/db')

    const poolConfig = mysql.createPool.mock.calls[0][0]
    expect(poolConfig.waitForConnections).toBe(true)
    expect(poolConfig.connectionLimit).toBe(10)
    expect(poolConfig.queueLimit).toBe(0)
  })
})