#!/usr/bin/env node

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

// Load environment variables
dotenv.config();

async function checkCollections() {
	let connection;

	try {
		// Create database connection using environment variables
		connection = await mysql.createConnection({
			host: process.env.DB_HOST,
			port: process.env.DB_PORT,
			user: process.env.DB_USER,
			password: process.env.DB_PASSWORD,
			database: process.env.DB_NAME,
			socketPath: process.env.DB_INSTANCE_UNIX_SOCKET || undefined,
		});

		console.log('Connected to database successfully');

		// Query to get recent collections with specific columns
		const query = `
			SELECT 
				id,
				title,
				subtitle,
				filename,
				created_at
			FROM collections 
			ORDER BY created_at DESC 
			LIMIT 20
		`;

		const [rows] = await connection.execute(query);
		
		console.log('\nRecent Collection Entries:');
		console.log('=' + '='.repeat(50));
		
		if (rows.length === 0) {
			console.log('No collections found in the database.');
		} else {
			// Display results in a formatted table
			rows.forEach((row, index) => {
				console.log(`\n${index + 1}. Collection ID: ${row.id}`);
				console.log(`   Title: ${row.title || 'NULL'}`);
				console.log(`   Subtitle: ${row.subtitle || 'NULL'}`);
				console.log(`   Filename: ${row.filename || 'NULL'}`);
				console.log(`   Created At: ${row.created_at}`);
			});
		}

		console.log(`\nTotal collections found: ${rows.length}`);

		// Additional query to look for specific hash-like filenames
		const hashQuery = `
			SELECT 
				id,
				title,
				filename,
				created_at
			FROM collections 
			WHERE filename REGEXP '^[a-f0-9]{32}$'
			ORDER BY created_at DESC
		`;

		const [hashRows] = await connection.execute(hashQuery);
		
		if (hashRows.length > 0) {
			console.log('\n\nCollections with hash-like filenames (32 character hex):');
			console.log('=' + '='.repeat(50));
			
			hashRows.forEach((row, index) => {
				console.log(`\n${index + 1}. Collection ID: ${row.id}`);
				console.log(`   Title: ${row.title || 'NULL'}`);
				console.log(`   Filename: ${row.filename}`);
				console.log(`   Created At: ${row.created_at}`);
			});
		}

	} catch (error) {
		console.error('Database connection or query failed:', error.message);
		
		// Check if it's an environment variable issue
		if (!process.env.DB_HOST) {
			console.error('\nMissing environment variables. Please check:');
			console.error('- DB_HOST');
			console.error('- DB_PORT'); 
			console.error('- DB_USER');
			console.error('- DB_PASSWORD');
			console.error('- DB_NAME');
		}
	} finally {
		if (connection) {
			await connection.end();
			console.log('\nDatabase connection closed.');
		}
	}
}

// Run the function
checkCollections().catch(console.error);