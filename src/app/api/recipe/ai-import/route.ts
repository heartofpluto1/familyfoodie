import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';
import OpenAI from 'openai';
import { generateVersionedFilename } from '@/lib/utils/secureFilename';
import { uploadFile, getStorageMode } from '@/lib/storage';
import { generateSlugFromTitle } from '@/lib/utils/urlHelpers';

interface Ingredients {
	name: string;
	quantity_2_servings: string;
	quantity_4_servings: string;
	unit?: string;
	existing_ingredient_id?: number; // If ingredient exists in database
	fresh?: boolean; // For new ingredients
	pantryCategory_id?: number; // For new ingredients
	supermarketCategory_id?: number; // For new ingredients
	measureId?: number; // For new ingredients
}

interface ExtractedRecipe {
	title: string;
	description: string;
	prepTime?: number;
	cookTime?: number;
	servings?: number;
	ingredients: Ingredients[];
	instructions: string[];
	cuisine?: string;
	difficulty?: string;
	seasonId?: number; // For form data
	primaryTypeId?: number; // For form data
	secondaryTypeId?: number; // For form data
	collectionId?: number; // For form data
}

interface IngredientRow extends RowDataPacket {
	id: number;
	name: string;
}

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY
	? new OpenAI({
			apiKey: process.env.OPENAI_API_KEY,
		})
	: null;

// Helper function to parse recipe data using OpenAI
const parseRecipeWithAI = async (pdfFile: File): Promise<ExtractedRecipe> => {
	if (!openai) {
		throw new Error('OpenAI API key not configured');
	}

	// Convert PDF to base64 for OpenAI
	const bytes = await pdfFile.arrayBuffer();
	const buffer = Buffer.from(bytes);
	const base64 = buffer.toString('base64');

	try {
		const completion = await openai.chat.completions.create({
			model: 'gpt-4o',
			messages: [
				{
					role: 'system',
					content:
						'You are a recipe extraction expert. Extract recipe information from PDFs and return valid JSON only, no additional text or markdown formatting.',
				},
				{
					role: 'user',
					content: [
						{
							type: 'text',
							text: `Please analyze this PDF and extract a complete recipe in the specified JSON format.

Please extract and structure the recipe data as follows:
1. Find the main recipe title
2. Find the recipe description. If you can't find one, create a brief description (3-4 sentences) summarizing the dish
3. Estimate realistic prep and cook times in minutes
4. Determine number of servings
5. Extract all ingredients with quantities scaled for both 2 servings and 4 servings
6. Identify the cuisine type
7. Assess difficulty level (Easy/Medium/Hard)

IMPORTANT: Return only valid JSON with this exact structure:
{
  "title": "Recipe Title",
  "description": "Brief description of the dish",
  "prepTime": 20,
  "cookTime": 30,
  "servings": 4,
  "ingredients": [
    {"name": "flour", "quantity_2_servings": "1", "quantity_4_servings": "2", "unit": "cup"},
    {"name": "eggs", "quantity_2_servings": "2", "quantity_4_servings": "4", "unit": "item"},
    {"name": "salt", "quantity_2_servings": "0.5", "quantity_4_servings": "1", "unit": "tsp"}
  ],
  "cuisine": "Italian",
  "difficulty": "Medium"
}

CRITICAL INSTRUCTIONS for ingredients:
1. Scale quantities appropriately for 2 servings and 4 servings
2. For whole items (eggs, apples, onions, etc.), use unit "item"
3. For measured quantities, separate the number from the unit
4. Convert fractions to decimals (e.g., "1/2" → "0.5")
5. The "name" field must contain ONLY the core ingredient name in lowercase
6. Remove ALL quantities, numbers, descriptors, adjectives, and preparation methods from names

Examples:
- "2 large eggs" for 4 servings → {"name": "eggs", "quantity_2_servings": "1", "quantity_4_servings": "2", "unit": "item"}
- "1 cup flour" for 2 servings → {"name": "flour", "quantity_2_servings": "1", "quantity_4_servings": "2", "unit": "cup"}
- "3 cloves garlic" for 4 servings → {"name": "garlic", "quantity_2_servings": "1.5", "quantity_4_servings": "3", "unit": "clove"}`,
						},
						{
							type: 'image_url',
							image_url: {
								url: `data:application/pdf;base64,${base64}`,
							},
						},
					],
				},
			],
			temperature: 0.3,
			max_tokens: 2000,
		});

		const content = completion.choices[0]?.message?.content;
		if (!content) {
			throw new Error('OPENAI_NO_RESPONSE: No content received from OpenAI');
		}

		try {
			const recipe = JSON.parse(content) as ExtractedRecipe;
			return recipe;
		} catch (parseError) {
			throw new Error('OPENAI_INVALID_JSON: Failed to parse OpenAI response as JSON');
		}
	} catch (error) {
		console.error('Error parsing recipe with AI:', error);
		// Re-throw specific errors as-is, wrap others
		if (error instanceof Error && (error.message.includes('OPENAI_NO_RESPONSE') || error.message.includes('OPENAI_INVALID_JSON'))) {
			throw error;
		}
		throw new Error('OPENAI_EXTRACTION_ERROR: Failed to parse recipe data');
	}
};

async function importHandler(request: NextRequest) {
	try {
		const formData = await request.formData();
		const pdfFile = formData.get('pdfFile') as File;
		const heroImageFile = formData.get('heroImage') as File | null;
		const structuredRecipeData = formData.get('structuredRecipe') as string | null;

		// Early validation: PDF file is required
		if (!pdfFile) {
			return NextResponse.json({
				success: false,
				error: 'PDF file is required for recipe import',
				code: 'MISSING_PDF_FILE',
				details: 'A PDF file containing the recipe must be provided to extract recipe data.'
			}, { status: 400 });
		}

		let recipe: ExtractedRecipe;

		// Early validation: structured recipe data format if provided
		if (structuredRecipeData) {
			console.log(`Using structured recipe data from preview editing`);
			try {
				const parsedData = JSON.parse(structuredRecipeData);
				// Validate required fields
				if (!parsedData.title || !parsedData.ingredients || !parsedData.description) {
					throw new Error('Missing required fields');
				}
				recipe = parsedData;
			} catch (error) {
				console.error('Error parsing structured recipe data:', error);
				return NextResponse.json({
					success: false,
					error: 'Invalid structured recipe data provided',
					code: 'INVALID_RECIPE_DATA',
					details: 'Structured recipe data must be valid JSON with required fields: title, ingredients, description.'
				}, { status: 400 });
			}
		} else {
			// No structured data provided, use AI parsing
			console.log(`Processing PDF: ${pdfFile.name}`);
			try {
				recipe = await parseRecipeWithAI(pdfFile);
			} catch (error) {
				console.error('Error parsing recipe with AI:', error);
				if (error instanceof Error && error.message.includes('OPENAI_NO_RESPONSE')) {
					return NextResponse.json({
						success: false,
						error: 'No recipe data extracted from PDF',
						code: 'OPENAI_NO_RESPONSE',
						details: 'The AI service returned no recipe data. The PDF may not contain a recognizable recipe format.'
					}, { status: 500 });
				} else if (error instanceof Error && error.message.includes('OPENAI_INVALID_JSON')) {
					return NextResponse.json({
						success: false,
						error: 'Invalid recipe data format received',
						code: 'OPENAI_INVALID_JSON',
						details: 'The AI service returned malformed data. Please try again or contact support if the problem persists.'
					}, { status: 500 });
				} else {
					return NextResponse.json({
						success: false,
						error: 'Failed to extract recipe data from PDF',
						code: 'OPENAI_EXTRACTION_ERROR',
						details: 'Unable to process the PDF file. Please ensure the PDF contains a clear recipe and try again.'
					}, { status: 500 });
				}
			}
		}

		// Early validation: collection ID is required
		if (!recipe.collectionId) {
			return NextResponse.json({
				success: false,
				error: 'Collection ID is required for recipe import',
				code: 'MISSING_COLLECTION_ID',
				details: 'A collection must be specified to organize the imported recipe.'
			}, { status: 400 });
		}

		// Get a connection for transaction handling
		const connection = await pool.getConnection();

		// Early validation: verify collection exists and user has access
		try {
			const [collectionRows] = await connection.execute<RowDataPacket[]>(
				'SELECT id, url_slug, title, household_id FROM collections WHERE id = ? AND household_id = ?',
				[recipe.collectionId, (request as any).household_id]
			);

			if (collectionRows.length === 0) {
				connection.release();
				return NextResponse.json({
					success: false,
					error: `Collection with ID ${recipe.collectionId} not found in your household`,
					code: 'COLLECTION_NOT_FOUND',
					details: 'The specified collection does not exist or you do not have access to it.'
				}, { status: 400 });
			}

			const collectionInfo = collectionRows[0];
			if (!collectionInfo.url_slug) {
				connection.release();
				return NextResponse.json({
					success: false,
					error: `Collection "${collectionInfo.title}" is missing URL slug`,
					code: 'COLLECTION_INVALID',
					details: 'The collection configuration is incomplete. Please contact support.'
				}, { status: 400 });
			}
		} catch (validationError) {
			connection.release();
			throw validationError;
		}

		try {
			await connection.beginTransaction();

			// First, we need to insert with a placeholder URL slug to get the ID, then update with the real slug
			// This is necessary because the slug generation requires the recipe ID
			const placeholderSlug = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

			const [recipeResult] = await connection.execute<ResultSetHeader>(
				`INSERT INTO recipes (name, description, prepTime, cookTime, season_id, primaryType_id, secondaryType_id, url_slug, archived, public, household_id) 
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`,
				[
					recipe.title,
					recipe.description,
					recipe.prepTime || null,
					recipe.cookTime || null,
					recipe.seasonId || null,
					recipe.primaryTypeId || null,
					recipe.secondaryTypeId || null,
					placeholderSlug,
					(request as any).household_id
				]
			);

			const recipeId = recipeResult.insertId;

			// Generate URL slug in {id}-{slug} format for URL parsing
			const urlSlug = generateSlugFromTitle(recipeId, recipe.title);

			// Generate secure filenames (this will create new hash-based filenames)
			const imageFilename = generateVersionedFilename(null, 'jpg');
			const pdfFilename = generateVersionedFilename(null, 'pdf');

			await connection.execute<ResultSetHeader>('UPDATE recipes SET image_filename = ?, pdf_filename = ?, url_slug = ? WHERE id = ?', [
				imageFilename,
				pdfFilename,
				urlSlug,
				recipeId,
			]);

			// Recipe is now globally available to all users

			// Process and add ingredients
			let addedIngredientsCount = 0;
			let newIngredientsCount = 0;

			for (const ingredient of recipe.ingredients) {
				let ingredientId: number;

				// Check if this is an existing ingredient
				if (ingredient.existing_ingredient_id) {
					// Use existing ingredient
					ingredientId = ingredient.existing_ingredient_id;
				} else {
					// Check if ingredient already exists in user's household or is public
					const [existingRows] = await connection.execute<IngredientRow[]>(
						'SELECT id FROM ingredients WHERE LOWER(name) = LOWER(?) AND (household_id = ? OR public = 1)',
						[ingredient.name, (request as any).household_id]
					);

					if (existingRows.length > 0) {
						// Ingredient exists, use its ID
						ingredientId = existingRows[0].id;
					} else {
						// Create new ingredient with proper categories
						const fresh = ingredient.fresh !== undefined ? ingredient.fresh : true;
						const pantryCategory_id = ingredient.pantryCategory_id || 1; // Default to first category
						const supermarketCategory_id = ingredient.supermarketCategory_id || 1; // Default to first category

						const [insertResult] = await connection.execute<ResultSetHeader>(
							`INSERT INTO ingredients (name, fresh, pantryCategory_id, supermarketCategory_id, household_id, public) 
							 VALUES (?, ?, ?, ?, ?, ?)`,
							[ingredient.name, fresh ? 1 : 0, pantryCategory_id, supermarketCategory_id, (request as any).household_id, 0] // private by default
						);

						ingredientId = insertResult.insertId;
						newIngredientsCount++;
					}
				}

				// Add the ingredient to the recipe
				await connection.execute(
					`INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, quantity4, quantityMeasure_id, primaryIngredient)
					 VALUES (?, ?, ?, ?, ?, ?)`,
					[recipeId, ingredientId, ingredient.quantity_2_servings, ingredient.quantity_4_servings, ingredient.measureId || null, 0]
				);
				addedIngredientsCount++;
			}

			// Add recipe to collection if specified
			if (recipe.collectionId) {
				await connection.execute(`INSERT INTO collection_recipes (collection_id, recipe_id, added_at) VALUES (?, ?, NOW())`, [
					recipe.collectionId,
					recipeId,
				]);
			}

			await connection.commit();

			// After successful database commit, handle file operations
			// Extract base filename (without extension) for file upload
			const filename = imageFilename.includes('.') ? imageFilename.split('.')[0] : imageFilename;
			let pdfSaved = false;
			let heroImageSaved = false;
			const fileErrors: string[] = [];

			console.log(`Storage mode: ${getStorageMode()}`);
			console.log(`Saving files with filename: ${filename}`);

			// Save the original PDF
			if (pdfFile && pdfFile.size > 0) {
				try {
					const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
					const uploadResult = await uploadFile(pdfBuffer, filename, 'pdf', 'application/pdf');

					if (uploadResult.success) {
						pdfSaved = true;
						console.log(`PDF saved successfully: ${uploadResult.url}`);
					} else {
						throw new Error(uploadResult.error || 'Failed to save PDF');
					}
				} catch (error) {
					const errorMessage = `Failed to save PDF: ${error instanceof Error ? error.message : 'Unknown error'}`;
					console.error(errorMessage, error);
					fileErrors.push(errorMessage);
				}
			}

			// Save the hero image if provided
			if (heroImageFile && heroImageFile.size > 0) {
				try {
					const heroBuffer = Buffer.from(await heroImageFile.arrayBuffer());
					const uploadResult = await uploadFile(heroBuffer, filename, 'jpg', 'image/jpeg');

					if (uploadResult.success) {
						heroImageSaved = true;
						console.log(`Hero image saved successfully: ${uploadResult.url}`);
					} else {
						throw new Error(uploadResult.error || 'Failed to save hero image');
					}
				} catch (error) {
					const errorMessage = `Failed to save hero image: ${error instanceof Error ? error.message : 'Unknown error'}`;
					console.error(errorMessage, error);
					fileErrors.push(errorMessage);
				}
			}

			// If critical files failed to save, return an error response
			if (pdfFile && pdfFile.size > 0 && !pdfSaved) {
				return NextResponse.json(
					{
						success: false,
						error: 'Recipe created but PDF file upload failed. Please try uploading the PDF again.',
						recipeId,
						fileErrors,
					},
					{ status: 500 }
				);
			}

			// Build success message with file upload status
			let message = `Recipe imported successfully with ${addedIngredientsCount} ingredients (${newIngredientsCount} new, ${addedIngredientsCount - newIngredientsCount} existing)`;

			if (fileErrors.length > 0) {
				message += '. Warning: Some file uploads failed.';
			}

			// Get collection info for response (already validated earlier)
			const [collectionRows] = await connection.execute<RowDataPacket[]>(
				'SELECT id, url_slug, title, household_id FROM collections WHERE id = ? AND household_id = ?',
				[recipe.collectionId, (request as any).household_id]
			);
			const collectionInfo = collectionRows[0]; // Safe to access since validated earlier

			return NextResponse.json({
				success: true,
				recipeId,
				recipeSlug: urlSlug,
				collectionSlug: collectionInfo.url_slug,
				message,
				recipe: {
					title: recipe.title,
					description: recipe.description,
					prepTime: recipe.prepTime,
					cookTime: recipe.cookTime,
					servings: recipe.servings,
					cuisine: recipe.cuisine,
					difficulty: recipe.difficulty,
				},
				addedIngredients: addedIngredientsCount,
				newIngredients: newIngredientsCount,
				existingIngredients: addedIngredientsCount - newIngredientsCount,
				totalIngredients: recipe.ingredients.length,
				pdfSaved,
				heroImageSaved,
				fileErrors: fileErrors.length > 0 ? fileErrors : undefined,
			});
		} catch (dbError) {
			await connection.rollback();
			console.error('Database error during recipe import:', dbError);
			return NextResponse.json({
				success: false,
				error: 'Failed to save recipe to database',
				code: 'DATABASE_SAVE_ERROR',
				details: 'A database error occurred while saving the recipe. No changes were made.'
			}, { status: 500 });
		} finally {
			connection.release();
		}
	} catch (error) {
		console.error('Error importing recipe from PDF:', error);
		// If we reach here, it's likely a validation error that should have been caught earlier
		// or an unexpected system error
		return NextResponse.json({
			success: false,
			error: error instanceof Error ? error.message : 'Failed to import recipe from PDF',
			code: 'IMPORT_ERROR',
			details: 'An unexpected error occurred during recipe import.'
		}, { status: 500 });
	}
}

export const POST = withAuth(importHandler);
