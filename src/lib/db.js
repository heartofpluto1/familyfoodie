import mysql from 'mysql2/promise';

const pool = mysql.createPool({
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

export default pool;
