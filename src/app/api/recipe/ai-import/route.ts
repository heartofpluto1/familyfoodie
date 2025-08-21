import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';
import OpenAI from 'openai';
import { generateSecureFilename } from '@/lib/utils/secureFilename.server';
import { uploadFile, getStorageMode } from '@/lib/storage';

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
			throw new Error('No content received from OpenAI');
		}

		const recipe = JSON.parse(content) as ExtractedRecipe;
		return recipe;
	} catch (error) {
		console.error('Error parsing recipe with AI:', error);
		throw new Error('Failed to parse recipe data');
	}
};

async function importHandler(request: NextRequest) {
	try {
		const formData = await request.formData();
		const pdfFile = formData.get('pdfFile') as File;
		const heroImageFile = formData.get('heroImage') as File | null;
		const structuredRecipeData = formData.get('structuredRecipe') as string | null;

		if (!pdfFile) {
			return NextResponse.json({ error: 'PDF file is required' }, { status: 400 });
		}

		let recipe: ExtractedRecipe;

		// Check if we have structured recipe data from the preview (edited by user)
		if (structuredRecipeData) {
			console.log(`Using structured recipe data from preview editing`);
			try {
				recipe = JSON.parse(structuredRecipeData);
			} catch (error) {
				console.error('Error parsing structured recipe data:', error);
				// Fallback to AI parsing
				recipe = await parseRecipeWithAI(pdfFile);
			}
		} else {
			// No structured data provided, use AI parsing
			console.log(`Processing PDF: ${pdfFile.name}`);
			recipe = await parseRecipeWithAI(pdfFile);
		}

		// Get a connection for transaction handling
		const connection = await pool.getConnection();

		try {
			await connection.beginTransaction();

			// Insert the recipe with temporary filename
			const [recipeResult] = await connection.execute<ResultSetHeader>(
				`INSERT INTO recipes (name, description, prepTime, cookTime, season_id, primaryType_id, secondaryType_id, collection_id, duplicate, filename, public) 
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1)`,
				[
					recipe.title,
					recipe.description,
					recipe.prepTime || null,
					recipe.cookTime || null,
					recipe.seasonId || null,
					recipe.primaryTypeId || null,
					recipe.secondaryTypeId || null,
					recipe.collectionId || null,
					`temp_${Date.now()}`,
				]
			);

			const recipeId = recipeResult.insertId;

			// Generate secure filename using recipe ID and name
			const secureFilename = generateSecureFilename(recipeId, recipe.title);

			// Update filename to use secure hash
			await connection.execute<ResultSetHeader>('UPDATE recipes SET filename = ? WHERE id = ?', [secureFilename, recipeId]);

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
					// Check if ingredient already exists in database by name (case-insensitive)
					const [existingRows] = await connection.execute<IngredientRow[]>('SELECT id FROM ingredients WHERE LOWER(name) = LOWER(?)', [ingredient.name]);

					if (existingRows.length > 0) {
						// Ingredient exists, use its ID
						ingredientId = existingRows[0].id;
					} else {
						// Create new ingredient with proper categories
						const fresh = ingredient.fresh !== undefined ? ingredient.fresh : true;
						const pantryCategory_id = ingredient.pantryCategory_id || 1; // Default to first category
						const supermarketCategory_id = ingredient.supermarketCategory_id || 1; // Default to first category

						const [insertResult] = await connection.execute<ResultSetHeader>(
							`INSERT INTO ingredients (name, fresh, pantryCategory_id, supermarketCategory_id, public) 
							 VALUES (?, ?, ?, ?, 1)`,
							[ingredient.name, fresh ? 1 : 0, pantryCategory_id, supermarketCategory_id]
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

			await connection.commit();

			// After successful database commit, handle file operations
			const filename = secureFilename;
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

			// Fetch collection information for URL generation
			let collectionInfo = null;
			if (recipe.collectionId) {
				const [collectionRows] = await connection.execute<RowDataPacket[]>('SELECT id, url_slug, title FROM collections WHERE id = ?', [
					recipe.collectionId,
				]);
				if (collectionRows.length > 0) {
					collectionInfo = collectionRows[0];
				}
			}

			return NextResponse.json({
				success: true,
				recipeId,
				recipeSlug: secureFilename,
				collectionSlug: collectionInfo?.url_slug || null,
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
			throw dbError;
		} finally {
			connection.release();
		}
	} catch (error) {
		console.error('Error importing recipe from PDF:', error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : 'Failed to import recipe from PDF',
			},
			{ status: 500 }
		);
	}
}

export const POST = withAuth(importHandler);
