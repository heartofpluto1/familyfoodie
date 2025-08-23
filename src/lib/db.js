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

// Create a proxy to preserve all original pool methods and properties
const pool = new Proxy(originalPool, {
	get(target, prop) {
		if (prop === 'execute') {
			return async function (query, params) {
				try {
					return await target.execute(query, params);
				} catch (error) {
					if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
						throw new Error('DATABASE_CONNECTION_FAILED: Unable to connect to the database');
					}
					throw error;
				}
			};
		}
		if (prop === 'getConnection') {
			return async function () {
				try {
					return await target.getConnection();
				} catch (error) {
					if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
						throw new Error('DATABASE_CONNECTION_FAILED: Unable to connect to the database');
					}
					throw error;
				}
			};
		}
		return target[prop];
	},
});

export default pool;
