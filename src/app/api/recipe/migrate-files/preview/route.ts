import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { RowDataPacket } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';
import { generateSecureFilename } from '@/lib/utils/secureFilename.server';
import { getStorageMode } from '@/lib/storage';

interface RecipeRow extends RowDataPacket {
	id: number;
	name: string;
	filename: string;
}

interface PreviewResult {
	recipeId: number;
	recipeName: string;
	currentFilename: string;
	newFilename: string;
	needsMigration: boolean;
}

async function previewHandler() {
	try {
		console.log(`Migration preview - Storage mode: ${getStorageMode()}`);

		// Get all recipes that have filenames
		const [recipeRows] = await pool.execute<RecipeRow[]>(
			'SELECT id, name, filename FROM menus_recipe WHERE filename IS NOT NULL AND filename != "" ORDER BY name'
		);

		console.log(`Found ${recipeRows.length} recipes with filenames`);

		const previewResults: PreviewResult[] = [];
		let needsMigrationCount = 0;
		let alreadyMigratedCount = 0;

		for (const recipe of recipeRows) {
			try {
				const correctFilename = generateSecureFilename(recipe.id, recipe.name);
				const needsMigration = recipe.filename !== correctFilename;

				if (needsMigration) {
					needsMigrationCount++;
				} else {
					alreadyMigratedCount++;
				}

				previewResults.push({
					recipeId: recipe.id,
					recipeName: recipe.name,
					currentFilename: recipe.filename,
					newFilename: correctFilename,
					needsMigration,
				});
			} catch (error) {
				console.error(`Error checking recipe ${recipe.id}:`, error);
				// Still add to results but mark as needing migration
				previewResults.push({
					recipeId: recipe.id,
					recipeName: recipe.name,
					currentFilename: recipe.filename,
					newFilename: 'error-generating-filename',
					needsMigration: true,
				});
				needsMigrationCount++;
			}
		}

		const summary = {
			totalRecipes: recipeRows.length,
			needsMigration: needsMigrationCount,
			alreadyMigrated: alreadyMigratedCount,
			storageMode: getStorageMode(),
		};

		console.log('Migration preview:', summary);

		return NextResponse.json({
			success: true,
			summary,
			results: previewResults,
		});
	} catch (error) {
		console.error('Error during migration preview:', error);

		// Check if it's a FILENAME_SECRET error
		if (error instanceof Error && error.message.includes('FILENAME_SECRET')) {
			return NextResponse.json(
				{
					success: false,
					error: 'Preview requires FILENAME_SECRET environment variable to be set',
				},
				{ status: 500 }
			);
		}

		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to preview migration',
			},
			{ status: 500 }
		);
	}
}

export const GET = withAuth(previewHandler);
