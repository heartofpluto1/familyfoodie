import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { withAuthHousehold, AuthenticatedRequest } from '@/lib/auth-middleware';
import { triggerCascadeCopyIfNeededForIngredient } from '@/lib/copy-on-write';

interface UpdateIngredientRequest {
	id: number;
	name: string;
	fresh: boolean;
	price: number | null;
	stockcode: number | null;
	supermarketCategoryId: number | null;
	pantryCategoryId: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function updateIngredientHandler(request: AuthenticatedRequest, context?: unknown) {
	try {
		const body: UpdateIngredientRequest = await request.json();
		const { id, name, fresh, price, stockcode, supermarketCategoryId, pantryCategoryId } = body;

		// Validate required fields
		if (!id || !name) {
			return NextResponse.json({ error: 'ID and name are required' }, { status: 400 });
		}

		// Trigger cascade copy if needed (copy-on-write for non-owned ingredients)
		const actualIngredientId = await triggerCascadeCopyIfNeededForIngredient(request.household_id, id);

		// Update the ingredient (using the potentially new ingredient ID after copy-on-write)
		await pool.execute(
			`UPDATE ingredients 
			 SET name = ?, fresh = ?, cost = ?, stockcode = ?, 
			     supermarketCategory_id = ?, pantryCategory_id = ?
			 WHERE id = ?`,
			[name, fresh, price, stockcode, supermarketCategoryId, pantryCategoryId, actualIngredientId]
		);

		return NextResponse.json({
			success: true,
			message: 'Ingredient updated successfully',
			...(actualIngredientId !== id && { newIngredientId: actualIngredientId, copied: true }),
		});
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update ingredient' }, { status: 500 });
	}
}

export const PUT = withAuthHousehold(updateIngredientHandler);
