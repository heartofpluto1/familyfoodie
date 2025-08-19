import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
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

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY
	? new OpenAI({
			apiKey: process.env.OPENAI_API_KEY,
		})
	: null;

async function previewHandler(request: NextRequest) {
	try {
		if (!openai) {
			return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
		}

		const formData = await request.formData();

		// Extract all image files from form data
		const imageFiles: Blob[] = [];
		for (const [key, value] of formData.entries()) {
			if (key.startsWith('image') && value instanceof Blob) {
				imageFiles.push(value);
			}
		}

		if (imageFiles.length === 0) {
			return NextResponse.json({ error: 'At least one image file is required' }, { status: 400 });
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
			throw new Error('No content received from OpenAI');
		}

		// Clean the content to extract JSON (remove markdown code blocks if present)
		let cleanContent = content.trim();
		if (cleanContent.startsWith('```json')) {
			cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
		} else if (cleanContent.startsWith('```')) {
			cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
		}

		const recipe = JSON.parse(cleanContent) as ExtractedRecipe;
		console.log(recipe);

		// Check ingredients against database and get their categories
		const [existingIngredients] = await pool.execute<ExistingIngredient[]>(`
			SELECT 
				i.id, 
				i.name, 
				i.fresh, 
				i.pantryCategory_id, 
				i.supermarketCategory_id,
				pc.name as pantryCategory_name
			FROM menus_ingredient i 
			LEFT JOIN menus_pantrycategory pc ON i.pantryCategory_id = pc.id 
			ORDER BY i.name
		`);

		// Get categories for new ingredients
		const [pantryCategories] = await pool.execute<PantryCategory[]>('SELECT id, name FROM menus_pantrycategory ORDER BY name');

		const [supermarketCategories] = await pool.execute<SupermarketCategory[]>('SELECT id, name FROM menus_supermarketcategory ORDER BY name');

		// Process ingredients to check which exist and which are new
		const processedIngredients: StructuredIngredient[] = recipe.ingredients.map(ingredient => {
			// Try to find matching ingredient (case-insensitive, exact match only)
			const matchingIngredient = existingIngredients.find(existing => {
				const existingName = existing.name.toLowerCase().trim();
				const ingredientName = ingredient.name.toLowerCase().trim();

				// Only exact match
				return existingName === ingredientName;
			});

			if (matchingIngredient) {
				// Existing ingredient - include pantryCategory information
				return {
					...ingredient,
					name: matchingIngredient.name, // Use the existing ingredient's name for consistency
					existing_ingredient_id: matchingIngredient.id,
					pantryCategory_id: matchingIngredient.pantryCategory_id,
					pantryCategory_name: matchingIngredient.pantryCategory_name,
					fresh: matchingIngredient.fresh === 1,
				};
			} else {
				// New ingredient - find category IDs based on AI recommendations
				const matchingSupermarketCategory = supermarketCategories.find(cat => cat.name.toLowerCase() === ingredient.supermarketCategory?.toLowerCase());

				const matchingPantryCategory = pantryCategories.find(cat => cat.name.toLowerCase() === ingredient.pantryCategory?.toLowerCase());

				return {
					...ingredient,
					// Set defaults - user will need to specify these in the preview
					fresh: true, // Default to fresh
					pantryCategory_id: matchingPantryCategory?.id || pantryCategories[0]?.id || 1, // Use AI recommendation or default
					supermarketCategory_id: matchingSupermarketCategory?.id || supermarketCategories[0]?.id || 1, // Use AI recommendation or default
				};
			}
		});

		// Sort ingredients by pantryCategory_id first, then by name
		const sortedIngredients = processedIngredients.sort((a, b) => {
			// First sort by pantryCategory_id
			const categoryA = a.pantryCategory_id || 0;
			const categoryB = b.pantryCategory_id || 0;
			if (categoryA !== categoryB) {
				return categoryA - categoryB;
			}
			// Then sort by name
			return a.name.localeCompare(b.name);
		});

		return NextResponse.json({
			success: true,
			recipe: {
				...recipe,
				serves: recipe.servings,
				ingredients: sortedIngredients,
			},
			categories: {
				pantryCategories,
				supermarketCategories,
			},
		});
	} catch (error) {
		console.error('Error parsing recipe with AI:', error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : 'Failed to parse recipe',
			},
			{ status: 500 }
		);
	}
}

export const POST = withAuth(previewHandler);
