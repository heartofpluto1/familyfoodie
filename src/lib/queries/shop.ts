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
      FROM menus_ingredient i
      LEFT JOIN menus_supermarketcategory sc ON i.supermarketCategory_id = sc.id
      LEFT JOIN menus_pantrycategory pc ON i.pantryCategory_id = pc.id
      WHERE public = 1
      ORDER BY name
    `);
	return rows as Ingredient[];
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
        FROM menus_shoppinglist sl
        LEFT JOIN menus_recipeingredient ri ON sl.recipeIngredient_id = ri.id
        LEFT JOIN menus_ingredient i ON ri.ingredient_id = i.id
        LEFT JOIN menus_measure m ON ri.quantityMeasure_id = m.id
        LEFT JOIN menus_supermarketcategory sc ON sl.supermarketCategory_id = sc.id
        LEFT JOIN menus_pantrycategory pc ON i.pantryCategory_id = pc.id
        WHERE sl.week = ? AND sl.year = ? AND sl.fresh = 1 AND sl.account_id = 1
        ORDER BY sl.sort, sl.id;
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
        FROM menus_shoppinglist sl
        LEFT JOIN menus_recipeingredient ri ON sl.recipeIngredient_id = ri.id
        LEFT JOIN menus_ingredient i ON ri.ingredient_id = i.id
        LEFT JOIN menus_measure m ON ri.quantityMeasure_id = m.id
        LEFT JOIN menus_supermarketcategory sc ON sl.supermarketCategory_id = sc.id
        LEFT JOIN menus_pantrycategory pc ON i.pantryCategory_id = pc.id
        WHERE sl.week = ? AND sl.year = ? AND sl.fresh = 0 AND sl.account_id = 1
        ORDER BY sl.sort, sl.id;
    `,
		[week, year]
	);

	return {
		fresh: freshRows,
		pantry: pantryRows,
	} as ShoppingListData;
}
