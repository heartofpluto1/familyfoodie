import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { ResultSetHeader } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';

interface UpdateIngredientRequest {
	id: number;
	quantity: string;
	quantity4: string;
	measureId?: number;
}

interface AddIngredientRequest {
	recipeId: number;
	ingredientId: number;
	quantity: string;
	quantity4: string;
	measureId?: number;
	preparationId?: number;
}

async function putHandler(request: NextRequest) {
	try {
		const body: UpdateIngredientRequest = await request.json();
		const { id, quantity, quantity4, measureId } = body;

		// Validate required fields
		if (!id || !quantity || !quantity4) {
			return NextResponse.json({ error: 'Ingredient ID and quantities are required' }, { status: 400 });
		}

		// Update the recipe ingredient
		const [result] = await pool.execute<ResultSetHeader>(
			`UPDATE menus_recipeingredient 
			 SET quantity = ?, quantity4 = ?, quantityMeasure_id = ?
			 WHERE id = ?`,
			[quantity, quantity4, measureId || null, id]
		);

		if (result.affectedRows === 0) {
			return NextResponse.json({ error: 'Recipe ingredient not found' }, { status: 404 });
		}

		return NextResponse.json({ success: true, message: 'Ingredient updated successfully' });
	} catch (error) {
		console.error('Error updating recipe ingredient:', error);
		return NextResponse.json({ error: 'Failed to update recipe ingredient' }, { status: 500 });
	}
}

async function postHandler(request: NextRequest) {
	try {
		const body: AddIngredientRequest = await request.json();
		const { recipeId, ingredientId, quantity, quantity4, measureId, preparationId } = body;

		// Validate required fields
		if (!recipeId || !ingredientId || !quantity || !quantity4) {
			return NextResponse.json({ error: 'Recipe ID, ingredient ID, and quantities are required' }, { status: 400 });
		}

		// Add the new recipe ingredient
		const [result] = await pool.execute<ResultSetHeader>(
			`INSERT INTO menus_recipeingredient (recipe_id, ingredient_id, quantity, quantity4, quantityMeasure_id, preperation_id, primaryIngredient)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[recipeId, ingredientId, quantity, quantity4, measureId || null, preparationId || null, 0]
		);

		return NextResponse.json({
			success: true,
			message: 'Ingredient added successfully',
			id: result.insertId,
		});
	} catch (error) {
		console.error('Error adding recipe ingredient:', error);
		return NextResponse.json({ error: 'Failed to add recipe ingredient' }, { status: 500 });
	}
}

async function deleteHandler(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');

		if (!id) {
			return NextResponse.json({ error: 'Ingredient ID is required' }, { status: 400 });
		}

		// Delete the recipe ingredient
		const [result] = await pool.execute<ResultSetHeader>(`DELETE FROM menus_recipeingredient WHERE id = ?`, [parseInt(id)]);

		if (result.affectedRows === 0) {
			return NextResponse.json({ error: 'Recipe ingredient not found' }, { status: 404 });
		}

		return NextResponse.json({ success: true, message: 'Ingredient removed successfully' });
	} catch (error) {
		console.error('Error removing recipe ingredient:', error);
		return NextResponse.json({ error: 'Failed to remove recipe ingredient' }, { status: 500 });
	}
}

export const PUT = withAuth(putHandler);
export const POST = withAuth(postHandler);
export const DELETE = withAuth(deleteHandler);
