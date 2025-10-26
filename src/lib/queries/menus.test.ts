import {
	getRecipesInCollection,
	getMyRecipes,
	getAllRecipesWithDetailsHousehold,
	getRecipeDetailsHousehold,
	getMyIngredients,
	getCurrentWeekRecipes,
	getAllPlannedWeeks,
	getCurrentAndPlannedWeeks,
	getRecipeWeeks,
	getNextWeekRecipes,
	deleteWeekRecipes,
	saveWeekRecipes,
} from './menus';
import pool from '@/lib/db.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Mock the database pool
jest.mock('@/lib/db.js');
const mockPool = pool as jest.Mocked<typeof pool> & {
	getConnection: jest.Mock;
};

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
			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY r.name ASC'), [1, 1]);
		});

		it('should filter by collection when provided', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getAllRecipesWithDetailsHousehold(1, 10);

			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('AND cr.collection_id = ?'), [1, 1, 10]);
		});

		it('should include public and subscribed collections', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getAllRecipesWithDetailsHousehold(1);

			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('c.public = 1 AND cs.household_id IS NOT NULL'), [1, 1]);
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

			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY access_type ASC, sc.id, i.name ASC'), [1, 1, 1, 1, 1, 1]);
		});

		it('should exclude household copies of other ingredients', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getMyIngredients(1);

			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('AND NOT EXISTS ('), [1, 1, 1, 1, 1, 1]);
		});
	});

	describe('Planning Functions with Household Isolation', () => {
		describe('getCurrentWeekRecipes', () => {
			it('should return current week recipes filtered by household_id', async () => {
				const mockRecipes = [
					{
						id: 1,
						name: 'Current Week Recipe',
						household_id: 1,
						image_filename: 'recipe1.jpg',
						pdf_filename: 'recipe1.pdf',
						url_slug: 'current-recipe',
						collection_url_slug: 'collection-slug',
					},
				];

				mockPool.execute.mockResolvedValueOnce([mockRecipes as RowDataPacket[], []]);

				const result = await getCurrentWeekRecipes(1);

				expect(result).toEqual(mockRecipes);
				expect(mockPool.execute).toHaveBeenCalledWith(
					expect.stringContaining('WHERE rw.week = ? AND rw.year = ? AND rw.household_id = ?'),
					expect.arrayContaining([expect.any(Number), expect.any(Number), 1])
				);
			});

			it('should only return recipes from the specified household', async () => {
				mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

				await getCurrentWeekRecipes(2);

				expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('AND rw.household_id = ?'), expect.arrayContaining([2]));
			});
		});

		describe('getNextWeekRecipes', () => {
			it('should return next week recipes filtered by household_id', async () => {
				const mockRecipes = [
					{
						id: 2,
						name: 'Next Week Recipe',
						household_id: 1,
						url_slug: 'next-recipe',
						collection_url_slug: 'collection-slug',
					},
				];

				mockPool.execute.mockResolvedValueOnce([mockRecipes as RowDataPacket[], []]);

				const result = await getNextWeekRecipes(1);

				expect(result).toEqual(mockRecipes);
				expect(mockPool.execute).toHaveBeenCalledWith(
					expect.stringContaining('WHERE rw.week = ? AND rw.year = ? AND rw.household_id = ?'),
					expect.arrayContaining([expect.any(Number), expect.any(Number), 1])
				);
			});

			it('should isolate next week recipes by household', async () => {
				mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

				await getNextWeekRecipes(3);

				expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('AND rw.household_id = ?'), expect.arrayContaining([3]));
			});
		});

		describe('getAllPlannedWeeks', () => {
			it('should return planned weeks filtered by household_id', async () => {
				const mockWeeks = [
					{ week: 45, year: 2024 },
					{ week: 46, year: 2024 },
				];
				const mockRecipes = [
					{
						id: 1,
						name: 'Planned Recipe',
						url_slug: 'planned-recipe',
						collection_url_slug: 'collection-slug',
					},
				];

				// First call for weeks list
				mockPool.execute.mockResolvedValueOnce([mockWeeks as RowDataPacket[], []]);
				// Subsequent calls for recipes in each week
				mockPool.execute.mockResolvedValue([mockRecipes as RowDataPacket[], []]);

				const result = await getAllPlannedWeeks(1);

				expect(result).toHaveLength(2);
				expect(result[0]).toMatchObject({ week: 45, year: 2024, recipes: mockRecipes });

				// Check first call includes household_id filter
				expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE rw.household_id = ?'), expect.arrayContaining([1]));

				// Check recipe queries include household_id filter
				expect(mockPool.execute).toHaveBeenCalledWith(
					expect.stringContaining('WHERE rw.week = ? AND rw.year = ? AND rw.household_id = ?'),
					expect.arrayContaining([45, 2024, 1])
				);
			});

			it('should only return weeks for the specified household', async () => {
				mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

				await getAllPlannedWeeks(2);

				expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE rw.household_id = ?'), expect.arrayContaining([2]));
			});
		});

		describe('getCurrentAndPlannedWeeks', () => {
			it('should combine current and planned weeks for household', async () => {
				const currentWeekRecipes = [{ id: 1, name: 'Current Recipe' }];

				// Mock getCurrentWeekRecipes call
				mockPool.execute.mockResolvedValueOnce([currentWeekRecipes as RowDataPacket[], []]);
				// Mock getAllPlannedWeeks calls
				mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]); // planned weeks query

				const result = await getCurrentAndPlannedWeeks(1);

				expect(result).toHaveLength(1); // Current week only since no planned weeks
				expect(result[0].recipes).toEqual(currentWeekRecipes);
			});

			it('should pass household_id to both getCurrentWeekRecipes and getAllPlannedWeeks', async () => {
				// Mock current week recipes
				mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);
				// Mock planned weeks
				mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

				await getCurrentAndPlannedWeeks(2);

				// Should call both functions with household_id = 2
				expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('AND rw.household_id = ?'), expect.arrayContaining([2]));
			});
		});

		describe('getRecipeWeeks', () => {
			it('should return recipe weeks filtered by household_id', async () => {
				const mockPlannedMeals = [
					{
						id: 1,
						week: 44,
						year: 2024,
						recipe_id: 1,
						recipe_name: 'Test Recipe',
						image_filename: 'test.jpg',
						pdf_filename: 'test.pdf',
						url_slug: 'test-recipe',
						collection_url_slug: 'test-collection',
					},
				];

				mockPool.execute.mockResolvedValueOnce([mockPlannedMeals as RowDataPacket[], []]);

				const result = await getRecipeWeeks(1, 6);

				expect(result.data).toBeDefined();
				expect(result.stats).toBeDefined();
				expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE \n        plans.household_id = ? AND'), expect.arrayContaining([1]));
			});

			it('should filter by household_id and date range', async () => {
				mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

				await getRecipeWeeks(3, 3);

				expect(mockPool.execute).toHaveBeenCalledWith(
					expect.stringContaining('plans.household_id = ?'),
					expect.arrayContaining([3, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number)])
				);
			});

			it('should use default months parameter when not provided', async () => {
				mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

				await getRecipeWeeks(1);

				// Should still include household_id filter with default 6 months
				expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('plans.household_id = ?'), expect.arrayContaining([1]));
			});
		});

		describe('deleteWeekRecipes', () => {
			it('should delete week recipes only for specified household', async () => {
				mockPool.execute.mockResolvedValueOnce([{ affectedRows: 2 } as ResultSetHeader, []]);

				await deleteWeekRecipes(45, 2024, 1);

				expect(mockPool.execute).toHaveBeenCalledWith('DELETE FROM plans WHERE week = ? AND year = ? AND household_id = ?', [45, 2024, 1]);
			});

			it('should isolate deletions by household_id', async () => {
				mockPool.execute.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader, []]);

				await deleteWeekRecipes(46, 2024, 3);

				expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('AND household_id = ?'), [46, 2024, 3]);
			});

			it('should not delete plans from other households', async () => {
				mockPool.execute.mockResolvedValueOnce([{ affectedRows: 0 } as ResultSetHeader, []]);

				await deleteWeekRecipes(47, 2024, 2);

				// Verify the household filter is included
				expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('household_id = ?'), expect.arrayContaining([2]));
			});
		});

		describe('saveWeekRecipes', () => {
			let mockConnection: {
				beginTransaction: jest.Mock;
				execute: jest.Mock;
				commit: jest.Mock;
				rollback: jest.Mock;
				release: jest.Mock;
			};

			beforeEach(() => {
				mockConnection = {
					beginTransaction: jest.fn().mockResolvedValue(undefined),
					execute: jest
						.fn()
						.mockResolvedValueOnce([{ affectedRows: 1 } as ResultSetHeader, []]) // DELETE
						.mockResolvedValueOnce([
							[
								{ id: 1, shop_qty: 2 },
								{ id: 2, shop_qty: 2 },
								{ id: 3, shop_qty: 2 },
								{ id: 4, shop_qty: 2 },
								{ id: 5, shop_qty: 2 },
							],
							[],
						]) // SELECT recipes with shop_qty
						.mockResolvedValue([{ affectedRows: 1 } as ResultSetHeader, []]), // INSERT
					commit: jest.fn().mockResolvedValue(undefined),
					rollback: jest.fn().mockResolvedValue(undefined),
					release: jest.fn().mockResolvedValue(undefined),
				};
				mockPool.getConnection.mockResolvedValue(mockConnection);
			});

			it('should delete existing plans only for specified household', async () => {
				await saveWeekRecipes(45, 2024, [{ id: 1 }, { id: 2 }, { id: 3 }], 1);

				expect(mockConnection.execute).toHaveBeenCalledWith('DELETE FROM plans WHERE week = ? AND year = ? AND household_id = ?', [45, 2024, 1]);
			});

			it('should insert new plans with household_id', async () => {
				await saveWeekRecipes(46, 2024, [{ id: 4 }, { id: 5 }], 2);

				// Should delete with household filter
				expect(mockConnection.execute).toHaveBeenCalledWith(
					expect.stringContaining('DELETE FROM plans WHERE week = ? AND year = ? AND household_id = ?'),
					[46, 2024, 2]
				);

				// Should insert with household_id and shop_qty included
				expect(mockConnection.execute).toHaveBeenCalledWith(
					expect.stringContaining('INSERT INTO plans (week, year, recipe_id, household_id, shop_qty) VALUES'),
					[46, 2024, 4, 2, 2, 46, 2024, 5, 2, 2]
				);
			});

			it('should isolate save operations by household_id', async () => {
				await saveWeekRecipes(47, 2024, [{ id: 6 }], 3);

				// Verify household isolation in both DELETE and INSERT
				expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('household_id = ?'), expect.arrayContaining([3]));
				expect(mockConnection.execute).toHaveBeenCalledWith(
					expect.stringContaining('household_id, shop_qty) VALUES'),
					expect.arrayContaining([47, 2024, 6, 3, 2])
				);
			});

			it('should handle empty recipe list with household isolation', async () => {
				await saveWeekRecipes(48, 2024, [], 1);

				// Should still delete with household filter
				expect(mockConnection.execute).toHaveBeenCalledWith('DELETE FROM plans WHERE week = ? AND year = ? AND household_id = ?', [48, 2024, 1]);

				// Should not call INSERT for empty array
				expect(mockConnection.execute).toHaveBeenCalledTimes(1);
			});
		});
	});
});
