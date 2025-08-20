import { NextResponse } from 'next/server';
import pool from '@/lib/db.js';
import { RowDataPacket } from 'mysql2';
import { withAuth } from '@/lib/auth-middleware';

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

interface Ingredient extends RowDataPacket {
	id: number;
	name: string;
	pantryCategory_id: number;
	pantryCategory_name: string;
}

interface Measure extends RowDataPacket {
	id: number;
	name: string;
}

interface Preparation extends RowDataPacket {
	id: number;
	name: string;
}

async function getHandler() {
	try {
		// Get all available options for dropdowns
		const [seasons] = await pool.execute<Season[]>('SELECT id, name FROM seasons ORDER BY name');
		const [primaryTypes] = await pool.execute<PrimaryType[]>('SELECT id, name FROM type_proteins ORDER BY name');
		const [secondaryTypes] = await pool.execute<SecondaryType[]>('SELECT id, name FROM type_carbs ORDER BY name');
		const [ingredients] = await pool.execute<Ingredient[]>(`
			SELECT 
				i.id, 
				i.name, 
				pc.id as pantryCategory_id, 
				pc.name as pantryCategory_name 
			FROM ingredients i 
			LEFT JOIN category_pantry pc ON i.pantryCategory_id = pc.id 
			ORDER BY i.name
		`);
		const [measures] = await pool.execute<Measure[]>('SELECT id, name FROM measurements ORDER BY name');
		const [preparations] = await pool.execute<Preparation[]>('SELECT id, name FROM preparations ORDER BY name');

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

export const GET = withAuth(getHandler);
