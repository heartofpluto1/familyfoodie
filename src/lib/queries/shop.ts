import pool from '@/lib/db.js';
import { ShoppingListData, Ingredient, ListItem } from '@/types/shop.js';

export async function getIngredients(household_id: number) {
	const [rows] = await pool.execute(
		`
      SELECT 
        i.id as ingredientId,
        i.name,
        i.cost,
        i.stockcode,
        sc.name as supermarketCategory,
        pc.name as pantryCategory
      FROM ingredients i
      LEFT JOIN category_supermarket sc ON i.supermarketCategory_id = sc.id
      LEFT JOIN category_pantry pc ON i.pantryCategory_id = pc.id
      WHERE i.household_id = ? OR i.public = 1
      ORDER BY name
    `,
		[household_id]
	);
	return rows as Ingredient[];
}

export async function getSupermarketCategories() {
	const [rows] = await pool.execute(`
		SELECT id, name 
		FROM category_supermarket 
		ORDER BY name
	`);
	return rows as { id: number; name: string }[];
}

export async function getPantryCategories() {
	const [rows] = await pool.execute(`
		SELECT id, name 
		FROM category_pantry 
		ORDER BY name
	`);
	return rows as { id: number; name: string }[];
}

interface GroupedItem {
	[key: string]: unknown;
	ids: number[];
	quantity: number;
	sort: number;
	purchased?: boolean;
	name: string;
}

// Helper function to group and aggregate shopping list items
function groupShoppingListItems(items: Record<string, unknown>[]): ListItem[] {
	const grouped: Record<string, GroupedItem> = {};

	items.forEach(item => {
		// Create a key for grouping: ingredientId + quantityMeasure
		// If no ingredientId, use the name to avoid grouping manually added items
		const key = item.ingredientId ? `${item.ingredientId}-${item.quantityMeasure || 'none'}` : `manual-${item.name}-${item.id}`;

		if (!grouped[key]) {
			// First item in this group - initialize with array of IDs
			grouped[key] = {
				...item,
				ids: [item.id as number], // Store array of IDs instead of single ID
				quantity: parseFloat((item.quantity as string) || '0'),
				sort: item.sort as number,
				name: item.name as string,
			} as GroupedItem;
		} else {
			// Add to existing group
			grouped[key].ids.push(item.id as number);
			grouped[key].quantity += parseFloat((item.quantity as string) || '0');

			// If any item in the group is purchased, mark the group as purchased
			if (item.purchased) {
				grouped[key].purchased = true;
			}

			// Use the lowest sort value in the group
			if ((item.sort as number) < grouped[key].sort) {
				grouped[key].sort = item.sort as number;
			}
		}
	});

	// Convert back to array and format quantities
	return Object.values(grouped).map(item => ({
		...item,
		id: item.ids.length === 1 ? item.ids[0] : item.ids[0], // For backward compatibility, use first ID as main ID
		ids: item.ids, // Include the full array of IDs
		quantity: item.quantity ? item.quantity.toString() : undefined,
		ingredient: item.name, // For backward compatibility
		fresh: item.fresh, // Preserve fresh property from database
	})) as ListItem[];
}

export async function getShoppingList(week: string, year: string, household_id: number) {
	// Get fresh ingredients from shopping list with household scope
	// Now using denormalized data - no need to join with recipe_ingredients
	const [freshRows] = await pool.execute(
		`
        SELECT
            sl.id,
            sl.name,
            sl.cost,
            sl.stockcode,
            sl.purchased,
            sl.sort,
            sl.quantity,
            sl.quantity4,
            sl.measurement as quantityMeasure,
            sl.fresh,
            sl.household_id,
            sl.recipe_id,
            -- Get ingredient details if we still have the reference
            i.id as ingredientId,
            sc.name as supermarketCategory,
            pc.name as pantryCategory
        FROM shopping_lists sl
        LEFT JOIN ingredients i ON sl.name = i.name AND (i.household_id = sl.household_id OR i.public = 1)
        LEFT JOIN category_supermarket sc ON i.supermarketCategory_id = sc.id
        LEFT JOIN category_pantry pc ON i.pantryCategory_id = pc.id
        WHERE sl.week = ? AND sl.year = ? AND sl.household_id = ? AND sl.fresh = 1
        ORDER BY sl.sort, sl.id;
      `,
		[week, year, household_id]
	);

	// Get pantry ingredients from shopping list with household scope
	// Now using denormalized data - no need to join with recipe_ingredients
	const [pantryRows] = await pool.execute(
		`
        SELECT
            sl.id,
            sl.name,
            sl.cost,
            sl.stockcode,
            sl.purchased,
            sl.sort,
            sl.quantity,
            sl.quantity4,
            sl.measurement as quantityMeasure,
            sl.fresh,
            sl.household_id,
            sl.recipe_id,
            -- Get ingredient details if we still have the reference
            i.id as ingredientId,
            sc.name as supermarketCategory,
            pc.name as pantryCategory
        FROM shopping_lists sl
        LEFT JOIN ingredients i ON sl.name = i.name AND (i.household_id = sl.household_id OR i.public = 1)
        LEFT JOIN category_supermarket sc ON i.supermarketCategory_id = sc.id
        LEFT JOIN category_pantry pc ON i.pantryCategory_id = pc.id
        WHERE sl.week = ? AND sl.year = ? AND sl.household_id = ? AND sl.fresh = 0
        ORDER BY sl.sort, sl.id;
    `,
		[week, year, household_id]
	);

	// Group and aggregate items
	return {
		fresh: groupShoppingListItems(freshRows as Record<string, unknown>[]),
		pantry: groupShoppingListItems(pantryRows as Record<string, unknown>[]),
	} as ShoppingListData;
}
