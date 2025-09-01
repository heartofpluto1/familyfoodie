import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import pool from '@/lib/db';
import { deleteFile } from '@/lib/storage';

export async function DELETE(request: NextRequest): Promise<NextResponse> {
	const session = await getServerSession(authOptions);
	if (!session || !session.user?.is_admin) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { type, id, filename } = await request.json();

		switch (type) {
			case 'collection-file':
				// Delete collection file - extract name and extension
				const collectionParts = filename.split('.');
				const collectionExt = collectionParts.pop() || '';
				const collectionName = collectionParts.join('.');

				const collectionDeleted = await deleteFile(collectionName, collectionExt, 'collections');
				if (!collectionDeleted) {
					return NextResponse.json({ error: 'Failed to delete collection file' }, { status: 500 });
				}
				return NextResponse.json({ success: true, message: 'Collection file deleted' });

			case 'recipe-image':
			case 'recipe-pdf':
				// Delete recipe file - extract name and extension
				const recipeParts = filename.split('.');
				const recipeExt = recipeParts.pop() || '';
				const recipeName = recipeParts.join('.');

				const recipeDeleted = await deleteFile(recipeName, recipeExt);
				if (!recipeDeleted) {
					return NextResponse.json({ error: 'Failed to delete recipe file' }, { status: 500 });
				}
				return NextResponse.json({ success: true, message: `Recipe ${type === 'recipe-image' ? 'image' : 'PDF'} deleted` });

			case 'collection':
				// Delete empty collection from database
				await pool.execute('DELETE FROM collections WHERE id = ? AND NOT EXISTS (SELECT 1 FROM collection_recipes WHERE collection_id = ?)', [id, id]);
				return NextResponse.json({ success: true, message: 'Collection deleted' });

			case 'ingredient':
				// Delete orphaned ingredient from database
				await pool.execute('DELETE FROM ingredients WHERE id = ? AND NOT EXISTS (SELECT 1 FROM recipe_ingredients WHERE ingredient_id = ?)', [id, id]);
				return NextResponse.json({ success: true, message: 'Ingredient deleted' });

			case 'recipe':
				// Delete orphaned recipe from database
				await pool.execute(
					'DELETE FROM recipes WHERE id = ? AND NOT EXISTS (SELECT 1 FROM collection_recipes WHERE recipe_id = ?) AND NOT EXISTS (SELECT 1 FROM plans WHERE recipe_id = ?)',
					[id, id, id]
				);
				return NextResponse.json({ success: true, message: 'Recipe deleted' });

			default:
				return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
		}
	} catch (error) {
		console.error('Error deleting orphaned item:', error);
		return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
	}
}
