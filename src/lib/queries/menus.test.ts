import { getRecipesInCollection, getMyRecipes, getAllRecipesWithDetailsHousehold, getRecipeDetailsHousehold, getMyIngredients } from './menus';
import pool from '@/lib/db.js';
import { RowDataPacket } from 'mysql2';

// Mock the database pool
jest.mock('@/lib/db.js');
const mockPool = pool as jest.Mocked<typeof pool>;

describe('Household-Aware Recipe Queries', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('getRecipesInCollection', () => {
		it('should return recipes with household precedence', async () => {
			const mockRecipes = [
				{
					id: 1,
					name: 'Customized Recipe',
					household_id: 1,
					status: 'customized',
					collection_household_id: 2,
					current_collection_slug: 'test-collection',
					current_collection_id: 10,
					user_owns_recipe: 1,
					user_owns_collection: 0,
					added_at: new Date(),
					display_order: 1,
				},
				{
					id: 2,
					name: 'Original Recipe',
					household_id: 2,
					status: 'original',
					collection_household_id: 2,
					current_collection_slug: 'test-collection',
					current_collection_id: 10,
					user_owns_recipe: 0,
					user_owns_collection: 0,
					added_at: new Date(),
					display_order: 2,
				},
			];

			mockPool.execute.mockResolvedValueOnce([mockRecipes as RowDataPacket[], []]);

			const result = await getRecipesInCollection(10, 1);

			expect(result).toHaveLength(2);
			expect((result[0] as (typeof result)[0] & { access_context: { user_owns_recipe: boolean } }).access_context.user_owns_recipe).toBe(true);
			expect((result[1] as (typeof result)[1] & { access_context: { user_owns_recipe: boolean } }).access_context.user_owns_recipe).toBe(false);
			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE cr.collection_id = ? AND r.archived = 0'), [1, 10, 1, 1, 10, 1, 1, 1]);
		});

		it('should prioritize household versions over originals', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getRecipesInCollection(10, 1);

			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('AND NOT EXISTS ('), [1, 10, 1, 1, 10, 1, 1, 1]);
		});

		it('should order by display_order and added_at', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getRecipesInCollection(10, 1);

			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY cr.display_order ASC, cr.added_at ASC'), [1, 10, 1, 1, 10, 1, 1, 1]);
		});
	});

	describe('getMyRecipes', () => {
		it('should return owned and subscribed recipes', async () => {
			const mockRecipes = [
				{
					id: 1,
					name: 'My Recipe',
					household_id: 1,
					access_type: 'owned',
					can_edit: 1,
					collection_url_slug: 'my-collection',
				},
				{
					id: 2,
					name: 'Subscribed Recipe',
					household_id: 2,
					access_type: 'subscribed',
					can_edit: 0,
					collection_url_slug: 'subscribed-collection',
				},
			];

			mockPool.execute.mockResolvedValueOnce([mockRecipes as RowDataPacket[], []]);

			const result = await getMyRecipes(1);

			expect(result).toEqual(mockRecipes);
			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('r.household_id = ? OR  -- Owned recipes'), [1, 1, 1, 1, 1, 1, 1]);
		});

		it('should prioritize owned recipes in ordering', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getMyRecipes(1);

			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY access_type ASC, r.name ASC'), [1, 1, 1, 1, 1, 1, 1]);
		});

		it('should exclude household copies of other recipes', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getMyRecipes(1);

			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('AND NOT EXISTS ('), [1, 1, 1, 1, 1, 1, 1]);
		});
	});

	describe('getAllRecipesWithDetailsHousehold', () => {
		it('should return recipes with household precedence and details', async () => {
			const mockRecipes = [
				{
					id: 1,
					name: 'My Recipe',
					household_id: 1,
					status: 'customized',
					collections: 'Collection 1, Collection 2',
					can_edit: 1,
					seasonName: 'Summer',
					ingredients: 'tomato, basil, olive oil',
				},
			];

			mockPool.execute.mockResolvedValueOnce([mockRecipes as RowDataPacket[], []]);

			const result = await getAllRecipesWithDetailsHousehold(1);

			expect(result).toHaveLength(1);
			expect(result[0].ingredients).toEqual(['tomato', 'basil', 'olive oil']);
			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY status ASC, r.name ASC'), [1, 1, 1, 1, 1, 1]);
		});

		it('should filter by collection when provided', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getAllRecipesWithDetailsHousehold(1, 10);

			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('AND cr.collection_id = ?'), [1, 1, 1, 1, 1, 1, 10]);
		});

		it('should include public and subscribed collections', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getAllRecipesWithDetailsHousehold(1);

			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('c.public = 1 OR        -- Recipes in public collections'), [1, 1, 1, 1, 1, 1]);
		});
	});

	describe('getRecipeDetailsHousehold', () => {
		it('should return recipe details with household context', async () => {
			const mockRecipeRows = [
				{
					id: 1,
					name: 'Test Recipe',
					household_id: 1,
					access_type: 'owned',
					can_edit: 1,
					collections: 'Test Collection',
					collection_id: 10,
					collection_title: 'Test Collection',
					collection_url_slug: 'test-collection',
					seasonName: 'Summer',
					primaryTypeName: 'Chicken',
					secondaryTypeName: 'Pasta',
					image_filename: 'recipe.jpg',
					pdf_filename: 'recipe.pdf',
					description: 'A test recipe',
					prepTime: 30,
					cookTime: 45,
					url_slug: 'test-recipe',
					ingredient_id: 101,
					quantity: '2',
					quantity4: '4',
					ingredient_table_id: 201,
					ingredient_name: 'Tomato',
					pantry_category_id: 301,
					pantry_category_name: 'Fresh',
					preperation_name: 'Diced',
					measure_id: 401,
					measure_name: 'cups',
				},
			];

			mockPool.execute.mockResolvedValueOnce([mockRecipeRows as RowDataPacket[], []]);

			const result = await getRecipeDetailsHousehold('1', 1);

			expect(result).not.toBeNull();
			expect(result!.name).toBe('Test Recipe');
			expect(result!.ingredients).toHaveLength(1);
			expect(result!.ingredients[0].ingredient.name).toBe('Tomato');
			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE r.id = ? AND r.archived = 0'), [1, 1, 1, '1', 1]);
		});

		it('should return null for non-existent or inaccessible recipe', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			const result = await getRecipeDetailsHousehold('999', 1);

			expect(result).toBeNull();
		});

		it('should validate access permissions', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getRecipeDetailsHousehold('1', 1);

			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('r.household_id = ? OR  -- User owns recipe'), [1, 1, 1, '1', 1]);
		});
	});

	describe('getMyIngredients', () => {
		it('should return owned and accessible ingredients', async () => {
			const mockIngredients = [
				{
					id: 1,
					name: 'My Ingredient',
					household_id: 1,
					access_type: 'owned',
					can_edit: 1,
				},
				{
					id: 2,
					name: 'Spencer Essential',
					household_id: 1, // Spencer's essentials
					access_type: 'accessible',
					can_edit: 0,
				},
			];

			mockPool.execute.mockResolvedValueOnce([mockIngredients as RowDataPacket[], []]);

			const result = await getMyIngredients(1);

			expect(result).toEqual(mockIngredients);
			expect(mockPool.execute).toHaveBeenCalledWith(
				expect.stringContaining("c.id = 1 OR           -- Always include Spencer's essentials"),
				[1, 1, 1, 1, 1, 1]
			);
		});

		it('should prioritize owned ingredients', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getMyIngredients(1);

			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY access_type ASC, i.name ASC'), [1, 1, 1, 1, 1, 1]);
		});

		it('should exclude household copies of other ingredients', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getMyIngredients(1);

			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('AND NOT EXISTS ('), [1, 1, 1, 1, 1, 1]);
		});
	});
});
