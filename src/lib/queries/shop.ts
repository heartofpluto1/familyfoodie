import pool from '@/lib/db.js';
import { ShoppingListData, Ingredient } from '@/types/shop.js';

export async function getIngredients() {
	const [rows] = await pool.execute(`
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
      WHERE public = 1
      ORDER BY name
    `);
	return rows as Ingredient[];
}

export async function getAllIngredients() {
	const [rows] = await pool.execute(`
		SELECT
			i.id,
			i.name,
			i.fresh,
			i.cost as price,
			i.stockcode,
			sc.name as supermarketCategory,
			pc.name as pantryCategory,
			COUNT(DISTINCT ri.recipe_id) as recipeCount
		FROM ingredients i
		LEFT JOIN category_supermarket sc ON i.supermarketCategory_id = sc.id
		LEFT JOIN category_pantry pc ON i.pantryCategory_id = pc.id
		LEFT JOIN recipe_ingredients ri ON i.id = ri.ingredient_id
		LEFT JOIN recipes r ON ri.recipe_id = r.id
		WHERE i.public = 1
		GROUP BY i.id, i.name, i.fresh, i.cost, i.stockcode, sc.name, pc.name
		ORDER BY sc.id, i.name;
	`);
	return rows as {
		id: number;
		name: string;
		fresh: boolean;
		price: number | null;
		stockcode: number | null;
		supermarketCategory: string | null;
		pantryCategory: string | null;
		recipeCount: number;
	}[];
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

export async function getShoppingList(week: string, year: string) {
	// Get fresh ingredients from shopping list
	const [freshRows] = await pool.execute(
		`
        SELECT
            sl.id,
            COALESCE(i.name, sl.name) as name,
            sl.cost,
            sl.stockcode,
            sl.purchased,
            sl.sort,
            ri.quantity,
            ri.quantity4,
            m.name as quantityMeasure,
            ri.ingredient_id as ingredientId,
            sc.name as supermarketCategory,
            pc.name as pantryCategory,
            sl.fresh
        FROM shopping_lists sl
        LEFT JOIN recipe_ingredients ri ON sl.recipeIngredient_id = ri.id
        LEFT JOIN ingredients i ON ri.ingredient_id = i.id
        LEFT JOIN measurements m ON ri.quantityMeasure_id = m.id
        LEFT JOIN category_supermarket sc ON sl.supermarketCategory_id = sc.id
        LEFT JOIN category_pantry pc ON i.pantryCategory_id = pc.id
        WHERE sl.week = ? AND sl.year = ? AND sl.fresh = 1        ORDER BY sl.sort, sl.id;
      `,
		[week, year]
	);

	// Get pantry ingredients from shopping list
	const [pantryRows] = await pool.execute(
		`
        SELECT
            sl.id,
            COALESCE(i.name, sl.name) as name,
            sl.cost,
            sl.stockcode,
            sl.purchased,
            sl.sort,
            ri.quantity,
            ri.quantity4,
            m.name as quantityMeasure,
            ri.ingredient_id as ingredientId,
            sc.name as supermarketCategory,
            pc.name as pantryCategory,
            sl.fresh
        FROM shopping_lists sl
        LEFT JOIN recipe_ingredients ri ON sl.recipeIngredient_id = ri.id
        LEFT JOIN ingredients i ON ri.ingredient_id = i.id
        LEFT JOIN measurements m ON ri.quantityMeasure_id = m.id
        LEFT JOIN category_supermarket sc ON sl.supermarketCategory_id = sc.id
        LEFT JOIN category_pantry pc ON i.pantryCategory_id = pc.id
        WHERE sl.week = ? AND sl.year = ? AND sl.fresh = 0        ORDER BY sl.sort, sl.id;
    `,
		[week, year]
	);

	return {
		fresh: freshRows,
		pantry: pantryRows,
	} as ShoppingListData;
}
