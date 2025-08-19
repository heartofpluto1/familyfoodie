import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';
import { generateSecureFilename } from '@/lib/utils/secureFilename.server';
import { migrateFile, getStorageMode } from '@/lib/storage';

interface RecipeRow extends RowDataPacket {
	id: number;
	name: string;
	filename: string;
}

interface MigrationResult {
	recipeId: number;
	recipeName: string;
	oldFilename: string;
	newFilename: string;
	imageMigrated: boolean;
	pdfMigrated: boolean;
	imageUrl?: string;
	pdfUrl?: string;
	error?: string;
}

async function migrateHandler() {
	try {
		console.log(`Starting bulk file migration - Storage mode: ${getStorageMode()}`);

		// Get all recipes that have filenames
		const [recipeRows] = await pool.execute<RecipeRow[]>('SELECT id, name, filename FROM menus_recipe WHERE filename IS NOT NULL AND filename != ""');

		console.log(`Found ${recipeRows.length} recipes with filenames to check for migration`);

		const migrationResults: MigrationResult[] = [];
		let totalMigrated = 0;
		let totalSkipped = 0;
		let totalErrors = 0;

		for (const recipe of recipeRows) {
			try {
				const correctFilename = generateSecureFilename(recipe.id, recipe.name);

				// Check if migration is needed
				if (recipe.filename === correctFilename) {
					console.log(`Recipe ${recipe.id} (${recipe.name}) already has correct filename: ${correctFilename}`);
					totalSkipped++;
					continue;
				}

				console.log(`Migrating recipe ${recipe.id} (${recipe.name}): ${recipe.filename} -> ${correctFilename}`);

				const result: MigrationResult = {
					recipeId: recipe.id,
					recipeName: recipe.name,
					oldFilename: recipe.filename,
					newFilename: correctFilename,
					imageMigrated: false,
					pdfMigrated: false,
				};

				// Migrate image files (try different extensions)
				const imageExtensions: Array<'jpg' | 'jpeg' | 'png'> = ['jpg', 'jpeg', 'png'];
				for (const ext of imageExtensions) {
					const migrationResult = await migrateFile(recipe.filename, correctFilename, ext);
					if (migrationResult.success && migrationResult.url) {
						result.imageMigrated = true;
						result.imageUrl = migrationResult.url;
						console.log(`  ✓ Migrated image: ${recipe.filename}.${ext} -> ${correctFilename}.${ext}`);
						break;
					}
				}

				// Migrate PDF file
				const pdfMigrationResult = await migrateFile(recipe.filename, correctFilename, 'pdf');
				if (pdfMigrationResult.success && pdfMigrationResult.url) {
					result.pdfMigrated = true;
					result.pdfUrl = pdfMigrationResult.url;
					console.log(`  ✓ Migrated PDF: ${recipe.filename}.pdf -> ${correctFilename}.pdf`);
				}

				// Only update database if at least one file was migrated or if we want to update to secure filename anyway
				if (result.imageMigrated || result.pdfMigrated || recipe.filename !== correctFilename) {
					const [updateResult] = await pool.execute<ResultSetHeader>('UPDATE menus_recipe SET filename = ? WHERE id = ?', [correctFilename, recipe.id]);

					if (updateResult.affectedRows > 0) {
						console.log(`  ✓ Updated database filename for recipe ${recipe.id}`);
						totalMigrated++;
					} else {
						result.error = 'Failed to update database';
						totalErrors++;
					}
				} else {
					console.log(`  ⚠ No files found to migrate for recipe ${recipe.id}`);
					result.error = 'No files found to migrate';
					totalSkipped++;
				}

				migrationResults.push(result);
			} catch (error) {
				console.error(`Error migrating recipe ${recipe.id}:`, error);
				migrationResults.push({
					recipeId: recipe.id,
					recipeName: recipe.name,
					oldFilename: recipe.filename,
					newFilename: 'error',
					imageMigrated: false,
					pdfMigrated: false,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
				totalErrors++;
			}
		}

		const summary = {
			totalRecipes: recipeRows.length,
			totalMigrated,
			totalSkipped,
			totalErrors,
			storageMode: getStorageMode(),
		};

		console.log('Migration completed:', summary);

		return NextResponse.json({
			success: true,
			message: `Migration completed: ${totalMigrated} migrated, ${totalSkipped} skipped, ${totalErrors} errors`,
			summary,
			results: migrationResults.length > 50 ? migrationResults.slice(0, 50) : migrationResults, // Limit response size
		});
	} catch (error) {
		console.error('Error during bulk file migration:', error);

		// Check if it's a FILENAME_SECRET error
		if (error instanceof Error && error.message.includes('FILENAME_SECRET')) {
			return NextResponse.json(
				{
					success: false,
					error: 'Migration requires FILENAME_SECRET environment variable to be set',
				},
				{ status: 500 }
			);
		}

		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to migrate files',
			},
			{ status: 500 }
		);
	}
}

export const POST = withAuth(migrateHandler);
