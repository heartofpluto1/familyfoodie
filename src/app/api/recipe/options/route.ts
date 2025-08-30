import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { RowDataPacket } from 'mysql2';
import { requireAuth } from '@/lib/auth/helpers';
import { getMyIngredients } from '@/lib/queries/menus';

interface Season extends RowDataPacket {
	id: number;
	name: string;
}

interface PrimaryType extends RowDataPacket {
	id: number;
	name: string;
}

interface SecondaryType extends RowDataPacket {
	id: number;
	name: string;
}

interface Ingredient {
	id: number;
	name: string;
	pantryCategory_id: number;
	pantryCategory_name: string;
	household_id?: number;
}

interface Measure extends RowDataPacket {
	id: number;
	name: string;
}

interface Preparation extends RowDataPacket {
	id: number;
	name: string;
}

export async function GET(): Promise<NextResponse> {
	const auth = await requireAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	try {
		const household_id = auth.household_id;

		// Get all available options for dropdowns
		// Seasons, types, measures, and preparations are global (not household-specific)
		const [seasons] = await pool.execute<Season[]>('SELECT id, name FROM seasons ORDER BY name');
		const [primaryTypes] = await pool.execute<PrimaryType[]>('SELECT id, name FROM type_proteins ORDER BY name');
		const [secondaryTypes] = await pool.execute<SecondaryType[]>('SELECT id, name FROM type_carbs ORDER BY name');
		const [measures] = await pool.execute<Measure[]>('SELECT id, name FROM measurements ORDER BY name');
		const [preparations] = await pool.execute<Preparation[]>('SELECT id, name FROM preparations ORDER BY name');

		// Get ingredients with household boundaries using the existing function
		const householdIngredients = await getMyIngredients(household_id);

		// Transform ingredients to match the expected format
		const ingredients: Ingredient[] = householdIngredients.map(ingredient => ({
			id: ingredient.id,
			name: ingredient.name,
			pantryCategory_id: ingredient.pantryCategory_id,
			pantryCategory_name: ingredient.pantryCategory_name,
			household_id: ingredient.household_id,
		}));

		return NextResponse.json({
			seasons,
			primaryTypes,
			secondaryTypes,
			ingredients,
			measures,
			preparations,
		});
	} catch (error) {
		console.error('Error fetching recipe options:', error);
		return NextResponse.json({ error: 'Failed to fetch recipe options' }, { status: 500 });
	}
}
