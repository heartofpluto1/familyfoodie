import mysql from 'mysql2/promise';

const originalPool = mysql.createPool({
	host: process.env.DB_HOST,
	port: process.env.DB_PORT,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
	socketPath: process.env.DB_INSTANCE_UNIX_SOCKET ? process.env.DB_INSTANCE_UNIX_SOCKET : undefined,
});

// Wrap pool to throw clearer database connection errors
const pool = {
	async execute(query, params) {
		try {
			return await originalPool.execute(query, params);
		} catch (error) {
			if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
				throw new Error('DATABASE_CONNECTION_FAILED: Unable to connect to the database');
			}
			throw error;
		}
	},

	async getConnection() {
		try {
			return await originalPool.getConnection();
		} catch (error) {
			if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
				throw new Error('DATABASE_CONNECTION_FAILED: Unable to connect to the database');
			}
			throw error;
		}
	}
};

export default pool;
