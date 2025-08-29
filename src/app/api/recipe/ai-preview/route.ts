import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import pool from '@/lib/db.js';
import { RowDataPacket } from 'mysql2';
import OpenAI from 'openai';

interface StructuredIngredient {
	name: string;
	quantity_2_servings: string;
	quantity_4_servings: string;
	unit?: string;
	supermarketCategory?: string; // AI recommendation for where to find in supermarket
	pantryCategory?: string; // AI recommendation for where to store at home
	existing_ingredient_id?: number; // If ingredient exists in database
	fresh?: boolean; // For new ingredients
	pantryCategory_id?: number; // For new and existing ingredients
	pantryCategory_name?: string; // For existing ingredients
	supermarketCategory_id?: number; // For new ingredients
}

interface ExistingIngredient extends RowDataPacket {
	id: number;
	name: string;
	fresh: number;
	pantryCategory_id: number;
	supermarketCategory_id: number;
	household_id: number;
	pantryCategory_name: string;
}

interface PantryCategory extends RowDataPacket {
	id: number;
	name: string;
}

interface SupermarketCategory extends RowDataPacket {
	id: number;
	name: string;
}

interface ExtractedRecipe {
	title: string;
	description: string;
	prepTime?: number;
	cookTime?: number;
	servings?: number;
	season?: string;
	seasonReason?: string;
	primaryType?: string;
	secondaryType?: string;
	hasHeroImage?: boolean;
	imageLocation?: {
		pageIndex: number;
		x: number;
		y: number;
		width: number;
		height: number;
	};
	ingredients: {
		name: string;
		quantity_2_servings: string;
		quantity_4_servings: string;
		unit?: string;
		supermarketCategory?: string;
		pantryCategory?: string;
	}[];
	instructions?: string[];
	cuisine?: string;
	difficulty?: string;
}

async function previewHandler(request: AuthenticatedRequest) {
	try {
		// Initialize OpenAI client at runtime to allow for testing
		if (!process.env.OPENAI_API_KEY) {
			return NextResponse.json(
				{
					success: false,
					error: 'OpenAI API key not configured',
					code: 'OPENAI_NOT_CONFIGURED',
				},
				{ status: 500 }
			);
		}

		let openai: OpenAI;
		try {
			openai = new OpenAI({
				apiKey: process.env.OPENAI_API_KEY,
			});
		} catch (error) {
			return NextResponse.json(
				{
					success: false,
					error: error instanceof Error ? error.message : 'Failed to initialize OpenAI client',
					code: 'OPENAI_INITIALIZATION_ERROR',
				},
				{ status: 500 }
			);
		}

		let formData: FormData;
		try {
			formData = await request.formData();
		} catch {
			return NextResponse.json(
				{
					success: false,
					error: 'Failed to parse form data',
					code: 'INVALID_FORM_DATA',
				},
				{ status: 400 }
			);
		}

		// Extract all image files from form data
		const imageFiles: Blob[] = [];
		for (const [key, value] of formData.entries()) {
			if (key.startsWith('image') && value instanceof Blob) {
				imageFiles.push(value);
			}
		}

		if (imageFiles.length === 0) {
			return NextResponse.json(
				{
					success: false,
					error: 'At least one image file is required',
					code: 'MISSING_IMAGE_FILES',
				},
				{ status: 400 }
			);
		}

		// Convert images to base64 for OpenAI
		const imageContents = await Promise.all(
			imageFiles.map(async blob => {
				const bytes = await blob.arrayBuffer();
				const buffer = Buffer.from(bytes);
				const base64 = buffer.toString('base64');
				return {
					type: 'image_url' as const,
					image_url: {
						url: `data:${blob.type || 'image/jpeg'};base64,${base64}`,
					},
				};
			})
		);

		// Use OpenAI to extract recipe from images
		const completion = await openai.chat.completions.create({
			model: 'gpt-4o',
			messages: [
				{
					role: 'system',
					content:
						'You are a recipe extraction expert. Extract recipe information from images and return valid JSON only, no additional text or markdown formatting.',
				},
				{
					role: 'user',
					content: [
						{
							type: 'text',
							text: `Please analyze these images and extract a complete recipe in the specified JSON format.

Please extract and structure the recipe data as follows:
1. Find the main recipe title
2. Find the recipe description. If you can't find one, create a brief description (3-4 sentences) summarizing the dish
3. Find the preparation time and cooking time in the recipe. If it doesn't exist, estimate realistic prep and cook times in minutes
4. Find the number of servings. If it doesn't exist, determine number of servings
5. IMPORTANT SERVING SIZE LOGIC: 
   - If the recipe makes individual items (biscuits, cookies, muffins, rolls, etc.), treat the recipe as serving 4 people regardless of how many items it makes
   - If the recipe serves people (like a casserole, soup, pasta dish), use the actual serving count
   - This ensures consistent scaling for ingredient quantities
6. Extract all ingredients with quantities and measurements
7. For each ingredient, determine where in the supermarket it would typically be found and assign ONE of these supermarketCategory values:
   - "bakery": bread, rolls, pastries, cakes
   - "center aisles": dry goods, canned goods, spices, flour, sugar, pasta, rice, oils, vinegars, sauces
   - "dairy": milk, butter, cheese, yogurt, eggs, cream
   - "deli": sliced meats, specialty cheeses, prepared foods
   - "fresh fruit & vege": fresh fruits, fresh vegetables (not herbs)
   - "fresh herbs": fresh basil, parsley, cilantro, mint, etc.
   - "meat": fresh meat, poultry, fish, seafood
   - "nuts & root vege": nuts, onions, garlic, potatoes, carrots, ginger
   - "other": anything that doesn't fit the above categories
8. For each ingredient, determine where it would typically be stored at home and assign ONE of these pantryCategory values:
   - "breezeway cupboard": non-perishable items that don't need climate control
   - "freezer": frozen goods, items that need freezing for long-term storage
   - "fridge": fresh items that need refrigeration, dairy, leftovers
   - "garden": fresh herbs that can be grown, items from garden
   - "kitchen cupboard": spices, oils, dry goods used frequently in cooking
   - "pantry": dry goods, canned goods, non-perishables for long-term storage
   - "other": anything that doesn't fit the above categories
9. If the recipe lists "Apple" please identify what colour apple it is, eg. "Green Apple" or "Red Apple" and update the ingredient name accordingly
10. Analyze the ingredients for seasonality and recommend the best season to serve this dish (Spring, Summer, Autumn, Winter). Consider seasonal produce, comfort food aspects, and traditional serving times. If no clear seasonal preference exists, leave this null. Also provide a brief 1-2 sentence explanation of why you chose this season.
11. Analyze the ingredients to determine the primary protein source and classify the dish. Return EXACTLY one of these values: "Beef", "Chicken", "Duck", "Fish, Seafood", "Lamb", "Pork, Bacon, Ham", "Vegetarian". Base this on where most of the protein comes from in the dish.
12. Analyze the ingredients to determine the primary carbohydrate source and classify the dish. Return EXACTLY one of these values: "Bread", "CouscousQuinoaBarley", "Fries, Chips", "Pasta, Noodles", "Pastry", "Pizza", "Potato", "Rice", "Salad", "Soup", "Sweet Potato", "Taco". Base this on where most of the carbohydrates come from in the dish. If no clear carbohydrate source exists, leave this null.
13. If there is a hero/main image of the finished dish visible in the document, analyze it carefully and provide precise extraction coordinates:
   - Identify which page/image contains the hero image (use 0-based indexing)
   - Determine the optimal crop area that captures the full dish with elegant framing
   - Calculate coordinates for a 3:2.2 aspect ratio (width:height) crop
   - Ensure the crop does not include any white space around the image
   - Ensure the crop does not include text around the edges of the image
   - Provide pixel coordinates as: top-left x, top-left y, width, height in "imageLocation"
   - Set "hasHeroImage" to true if you found an image
   - If no hero image is visible, set "hasHeroImage" to false

IMPORTANT: Return only valid JSON with this exact structure:
{
  "title": "Recipe Title",
  "description": "Brief description of the dish highlighting key flavors and appeal",
  "prepTime": 20,
  "cookTime": 30,
  "serves": 4,
  "season": "Summer",
  "seasonReason": "Features fresh tomatoes and basil which are at their peak in summer months.",
  "primaryType": "Chicken",
  "secondaryType": "Pasta, Noodles",
  "hasHeroImage": true,
  "imageLocation": {
    "pageIndex": 0,
    "x": 0,
    "y": 20,
    "width": 600,
    "height": 400,
  },
  "ingredients": [
    {"name": "Flour", "quantity_2_servings": "1", "quantity_4_servings": "2", "unit": "cup", "supermarketCategory": "center aisles", "pantryCategory": "pantry"},
    {"name": "Eggs", "quantity_2_servings": "2", "quantity_4_servings": "4", "unit": "item", "supermarketCategory": "dairy", "pantryCategory": "fridge"},
    {"name": "Salt", "quantity_2_servings": "1", "quantity_4_servings": "2", "unit": "tsp", "supermarketCategory": "center aisles", "pantryCategory": "kitchen cupboard"}
  ]
}

CRITICAL INSTRUCTIONS for ingredients:
1. For whole items (eggs, apples, onions, etc.), use quantity as-is and set unit to "item"
2. For measured quantities, separate the number from the unit (e.g., "1 cup flour" → quantity: "1", unit: "cup")
3. For fractional amounts, convert to decimals (e.g., "1/2 cup" → quantity: "0.5", unit: "cup")
4. Units should be: cup, tsp, tbsp, oz, lb, kg, g, ml, l, item, clove, slice, etc.
5. CRITICAL SCALING LOGIC:
   - For recipes making individual items (biscuits, cookies, muffins, etc.): Use the recipe's original quantities for quantity_4_servings, then scale down by half for quantity_2_servings
   - For recipes serving people: Scale the original quantities appropriately for 2 and 4 people
   - Never create weird fractions like 0.33 or 0.166 - round to practical cooking amounts
   - If scaling results in very small amounts (less than 0.25), use 0.25 as minimum
6. CRITICAL: The "name" field must contain ONLY the core ingredient name - remove ALL quantities, numbers, descriptors, adjectives, and preparation methods
7. Strip words like: large, small, medium, fresh, chopped, diced, minced, whole, etc.
8. Convert all measurements to one of these: bag, block, bunch, cube, cup, gram, item, kg, litre, milliliter, packet, rasher, sachet, tbs, tin, tsb, tub

Examples:
- "2 large eggs" → {"name": "Eggs", "quantity_2_servings": "1", "quantity_4_servings": "2", "unit": "item"}
- "1 head broccoli" → {"name": "Broccoli", "quantity_2_servings": "0.5", "quantity_4_servings": "1", "unit": "item"}
- "1.5 cups all-purpose flour" → {"name": "Flour", "quantity_2_servings": "0.75", "quantity_4_servings": "1.5", "unit": "cup"}
- "3 cloves fresh garlic, minced" → {"name": "Garlic", "quantity_2_servings": "1.5", "quantity_4_servings": "3", "unit": "clove"}
- "1/4 tsp kosher salt" → {"name": "Salt", "quantity_2_servings": "0.12", "quantity_4_servings": "0.25", "unit": "tsp"}
- "2 medium zucchini, diced" → {"name": "Zucchini", "quantity_2_servings": "1", "quantity_4_servings": "2", "unit": "item"}
- "1 bunch fresh parsley" → {"name": "Parsley", "quantity_2_servings": "0.5", "quantity_4_servings": "1", "unit": "item"}
- "500g pork mince" → {"name": "Pork Mince", "quantity_2_servings": "250", "quantity_4_servings": "500", "unit": "gram"}
- "1 cup panko breadcrumbs" → {"name": "Breadcrumbs", "quantity_2_servings": "0.5", "quantity_4_servings": "1", "unit": "cup"}
- "1 cup parmesan cheese" → {"name": "Parmesan", "quantity_2_servings": "0.5", "quantity_4_servings": "1", "unit": "cup"}

If the images don't contain a clear recipe, create the best recipe you can based on any food-related content found.`,
						},
						...imageContents,
					],
				},
			],
			temperature: 0.3,
			max_tokens: 2000,
		});

		const content = completion.choices[0]?.message?.content;

		if (!content) {
			return NextResponse.json(
				{
					success: false,
					error: 'No content received from OpenAI',
					code: 'OPENAI_NO_CONTENT',
				},
				{ status: 500 }
			);
		}

		// Clean the content to extract JSON (remove markdown code blocks if present)
		let cleanContent = content.trim();
		if (cleanContent.startsWith('```json')) {
			cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
		} else if (cleanContent.startsWith('```')) {
			cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
		}

		let recipe: ExtractedRecipe;
		try {
			recipe = JSON.parse(cleanContent) as ExtractedRecipe;
		} catch (error) {
			return NextResponse.json(
				{
					success: false,
					error: error instanceof Error ? error.message : 'Failed to parse recipe data from OpenAI',
					code: 'INVALID_JSON_RESPONSE',
				},
				{ status: 500 }
			);
		}

		// Get household-scoped ingredients: household-owned + Spencer's essentials + subscribed ingredients
		// Remove duplicates by name - prefer household-owned versions over external sources
		const [existingIngredients] = await pool.execute<ExistingIngredient[]>(
			`
			SELECT 
				i.id, 
				i.name, 
				i.fresh, 
				i.pantryCategory_id, 
				i.supermarketCategory_id,
				i.household_id,
				pc.name as pantryCategory_name
			FROM ingredients i
			LEFT JOIN category_pantry pc ON i.pantryCategory_id = pc.id
			WHERE (
				i.household_id = ? OR  -- 1. Include household's own ingredients
				(
					-- 2. Include subscribed collection ingredients (not household-owned, not duplicating household names)
					i.id IN (
						SELECT DISTINCT ri.ingredient_id
						FROM recipe_ingredients ri
						JOIN recipes r ON ri.recipe_id = r.id
						JOIN collection_recipes cr ON r.id = cr.recipe_id
						JOIN collection_subscriptions cs ON cr.collection_id = cs.collection_id
						WHERE cs.household_id = ?
					)
					AND i.household_id != ?
					AND NOT EXISTS (
						SELECT 1 FROM ingredients i2 
						WHERE i2.household_id = ? 
						AND LOWER(i2.name) = LOWER(i.name)
					)
				) OR (
					-- 3. Include Spencer's essentials (not household-owned, not duplicating household or subscribed names)
					i.id IN (
						SELECT DISTINCT ri.ingredient_id
						FROM recipe_ingredients ri
						JOIN recipes r ON ri.recipe_id = r.id
						JOIN collection_recipes cr ON r.id = cr.recipe_id
						WHERE cr.collection_id = 1
					)
					AND i.household_id != ?
					AND NOT EXISTS (
						SELECT 1 FROM ingredients i2 
						WHERE i2.household_id = ? 
						AND LOWER(i2.name) = LOWER(i.name)
					)
					AND NOT EXISTS (
						SELECT 1 FROM ingredients i3
						JOIN recipe_ingredients ri3 ON i3.id = ri3.ingredient_id
						JOIN recipes r3 ON ri3.recipe_id = r3.id
						JOIN collection_recipes cr3 ON r3.id = cr3.recipe_id
						JOIN collection_subscriptions cs3 ON cr3.collection_id = cs3.collection_id
						WHERE cs3.household_id = ? AND LOWER(i3.name) = LOWER(i.name)
					)
				)
			)
		`,
			[
				request.household_id,
				request.household_id,
				request.household_id,
				request.household_id,
				request.household_id,
				request.household_id,
				request.household_id,
			]
		);

		// Get categories for new ingredients
		const [pantryCategories] = await pool.execute<PantryCategory[]>('SELECT id, name FROM category_pantry ORDER BY name');

		const [supermarketCategories] = await pool.execute<SupermarketCategory[]>('SELECT id, name FROM category_supermarket ORDER BY name');

		// Use AI to match ingredient names with existing ingredients
		const ingredientNames = recipe.ingredients.map(ing => ing.name);
		const existingIngredientNames = existingIngredients.map(ing => ing.name);

		let aiMatchedIngredients: { original: string; matched: string | null }[] = [];

		if (ingredientNames.length > 0 && existingIngredientNames.length > 0) {
			try {
				const matchingCompletion = await openai.chat.completions.create({
					model: 'gpt-4o',
					messages: [
						{
							role: 'system',
							content:
								'You are an ingredient matching expert. Match ingredient names to the closest existing ingredient from a database list, or return null if no good match exists.',
						},
						{
							role: 'user',
							content: `I have a list of ingredients extracted from a recipe and need to match them with existing ingredients in my database.

For each ingredient in the recipe, find the best matching ingredient from the existing database list. If there's a close match (similar ingredient, just different wording), use it. If there's no good match, return null for that ingredient.

Recipe ingredients to match:
${ingredientNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

Existing database ingredients:
${existingIngredientNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

Return a JSON array with this exact structure:
[
  {"original": "Chicken Breast", "matched": "Chicken Breast Fillet"},
  {"original": "Fresh Basil", "matched": "Basil"},
  {"original": "Exotic Spice", "matched": null}
]

Rules:
- Only match if the ingredients are essentially the same thing (e.g., "Red Apple" matches "Apple", "Chicken Breast" matches "Chicken Breast Fillet")
- Don't match if they're different ingredients entirely (e.g., don't match "Beef" with "Chicken")
- Case and minor wording differences are okay to match
- If unsure, return null - it's better to create a new ingredient than to match incorrectly
- Return only the JSON array, no additional text`,
						},
					],
					temperature: 0.1,
					max_tokens: 1000,
				});

				const matchingContent = matchingCompletion.choices[0]?.message?.content;
				if (matchingContent) {
					let cleanMatchingContent = matchingContent.trim();
					if (cleanMatchingContent.startsWith('```json')) {
						cleanMatchingContent = cleanMatchingContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
					} else if (cleanMatchingContent.startsWith('```')) {
						cleanMatchingContent = cleanMatchingContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
					}
					aiMatchedIngredients = JSON.parse(cleanMatchingContent);
				}
			} catch (error) {
				console.warn('AI ingredient matching failed, falling back to exact matching:', error);
				// Fall back to empty matches - will use exact matching logic below
			}
		}

		// Process ingredients using AI matching results
		const processedIngredients: StructuredIngredient[] = recipe.ingredients.map(ingredient => {
			// First check if AI found a match
			const aiMatch = aiMatchedIngredients.find(match => match.original === ingredient.name);
			const targetName = aiMatch?.matched || ingredient.name;

			// Try to find the target ingredient in the database
			const matchingIngredient = existingIngredients.find(existing => {
				const existingName = existing.name.toLowerCase().trim();
				const targetIngredientName = targetName.toLowerCase().trim();
				return existingName === targetIngredientName;
			});

			if (matchingIngredient) {
				// Existing ingredient found - use complete data from database
				return {
					...ingredient,
					name: matchingIngredient.name, // Use the database ingredient's name for consistency
					existing_ingredient_id: matchingIngredient.id,
					pantryCategory_id: matchingIngredient.pantryCategory_id,
					pantryCategory_name: matchingIngredient.pantryCategory_name,
					supermarketCategory_id: matchingIngredient.supermarketCategory_id,
					fresh: matchingIngredient.fresh === 1,
				};
			} else {
				// New ingredient - find category IDs based on AI recommendations
				const matchingSupermarketCategory = supermarketCategories.find(cat => cat.name.toLowerCase() === ingredient.supermarketCategory?.toLowerCase());

				const matchingPantryCategory = pantryCategories.find(cat => cat.name.toLowerCase() === ingredient.pantryCategory?.toLowerCase());

				return {
					...ingredient,
					// Use original ingredient name if AI matching didn't work
					name: ingredient.name,
					// Set defaults - user will need to specify these in the preview
					fresh: true, // Default to fresh
					pantryCategory_id: matchingPantryCategory?.id || pantryCategories[0]?.id || 1, // Use AI recommendation or default
					supermarketCategory_id: matchingSupermarketCategory?.id || supermarketCategories[0]?.id || 1, // Use AI recommendation or default
				};
			}
		});

		// Keep ingredients in original recipe order for easier verification
		return NextResponse.json({
			success: true,
			recipe: {
				...recipe,
				serves: recipe.servings,
				ingredients: processedIngredients,
			},
			categories: {
				pantryCategories,
				supermarketCategories,
			},
		});
	} catch (error) {
		console.error('Error parsing recipe with AI:', error);

		// Handle different types of errors with appropriate codes
		if (error instanceof Error) {
			// Check for specific error types
			if (error.message.includes('OpenAI') || error.message.includes('chat.completions')) {
				return NextResponse.json(
					{
						success: false,
						error: error.message,
						code: 'OPENAI_API_ERROR',
					},
					{ status: 500 }
				);
			}

			// Database errors
			if (error.message.includes('execute') || error.message.includes('Database') || error.message.includes('connection')) {
				return NextResponse.json(
					{
						success: false,
						error: error.message,
						code: 'DATABASE_ERROR',
					},
					{ status: 500 }
				);
			}

			// Generic error with message
			return NextResponse.json(
				{
					success: false,
					error: error.message,
					code: 'INTERNAL_SERVER_ERROR',
				},
				{ status: 500 }
			);
		} else {
			// Non-Error objects
			return NextResponse.json(
				{
					success: false,
					error: 'Failed to parse recipe',
					code: 'INTERNAL_SERVER_ERROR',
				},
				{ status: 500 }
			);
		}
	}
}

export const POST = withAuth(previewHandler);
