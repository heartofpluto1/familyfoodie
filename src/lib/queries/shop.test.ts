import { getShoppingList } from './shop';
import pool from '@/lib/db.js';
import { RowDataPacket } from 'mysql2';

// Mock the database pool
jest.mock('@/lib/db.js');
const mockPool = pool as jest.Mocked<typeof pool>;

describe('Household-Scoped Shopping List Functions', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('getShoppingList', () => {
		it('should return shopping list for specific household', async () => {
			const mockFreshIngredients = [
				{
					id: 1,
					name: 'Fresh Tomatoes',
					cost: 2.5,
					stockcode: 'FT001',
					purchased: false,
					sort: 1,
					quantity: '2',
					quantityMeasure: 'cups',
					ingredientId: 101,
					supermarketCategory: 'Fresh Produce',
					pantryCategory: 'Vegetables',
					fresh: 1,
					household_id: 1,
				},
			];

			const mockPantryIngredients = [
				{
					id: 2,
					name: 'Olive Oil',
					cost: 5.99,
					stockcode: 'OO001',
					purchased: false,
					sort: 1,
					quantity: '1',
					quantityMeasure: 'tbsp',
					ingredientId: 102,
					supermarketCategory: 'Oils & Vinegars',
					pantryCategory: 'Pantry Staples',
					fresh: 0,
					household_id: 1,
				},
			];

			// Expected results after grouping
			const expectedFresh = [
				{
					id: 1,
					ids: [1],
					name: 'Fresh Tomatoes',
					cost: 2.5,
					stockcode: 'FT001',
					purchased: false,
					sort: 1,
					quantity: '2',
					quantityMeasure: 'cups',
					ingredientId: 101,
					supermarketCategory: 'Fresh Produce',
					pantryCategory: 'Vegetables',
					fresh: 1,
					household_id: 1,
					ingredient: 'Fresh Tomatoes',
				},
			];

			const expectedPantry = [
				{
					id: 2,
					ids: [2],
					name: 'Olive Oil',
					cost: 5.99,
					stockcode: 'OO001',
					purchased: false,
					sort: 1,
					quantity: '1',
					quantityMeasure: 'tbsp',
					ingredientId: 102,
					supermarketCategory: 'Oils & Vinegars',
					pantryCategory: 'Pantry Staples',
					fresh: 0,
					household_id: 1,
					ingredient: 'Olive Oil',
				},
			];

			mockPool.execute
				.mockResolvedValueOnce([mockFreshIngredients as RowDataPacket[], []]) // Fresh ingredients call
				.mockResolvedValueOnce([mockPantryIngredients as RowDataPacket[], []]); // Pantry ingredients call

			const result = await getShoppingList('32', '2024', 1);

			expect(result).toEqual({
				fresh: expectedFresh,
				pantry: expectedPantry,
			});

			// Verify fresh ingredients query includes household_id
			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE sl.week = ? AND sl.year = ? AND sl.household_id = ? AND sl.fresh = 1'), [
				'32',
				'2024',
				1,
			]);

			// Verify pantry ingredients query includes household_id
			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE sl.week = ? AND sl.year = ? AND sl.household_id = ? AND sl.fresh = 0'), [
				'32',
				'2024',
				1,
			]);
		});

		it('should return empty lists when no shopping items found', async () => {
			mockPool.execute
				.mockResolvedValueOnce([[] as RowDataPacket[], []]) // Fresh ingredients call
				.mockResolvedValueOnce([[] as RowDataPacket[], []]); // Pantry ingredients call

			const result = await getShoppingList('99', '2030', 1);

			expect(result).toEqual({
				fresh: [],
				pantry: [],
			});
		});

		it('should include household_id in select fields', async () => {
			mockPool.execute
				.mockResolvedValueOnce([[] as RowDataPacket[], []]) // Fresh ingredients call
				.mockResolvedValueOnce([[] as RowDataPacket[], []]); // Pantry ingredients call

			await getShoppingList('32', '2024', 1);

			// Verify household_id is selected in the query
			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('sl.household_id'), ['32', '2024', 1]);
		});

		it('should order by sort and id for consistent results', async () => {
			mockPool.execute
				.mockResolvedValueOnce([[] as RowDataPacket[], []]) // Fresh ingredients call
				.mockResolvedValueOnce([[] as RowDataPacket[], []]); // Pantry ingredients call

			await getShoppingList('32', '2024', 1);

			// Verify ordering is consistent
			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY sl.sort, sl.id'), ['32', '2024', 1]);
		});

		it('should handle database errors gracefully', async () => {
			mockPool.execute.mockRejectedValueOnce(new Error('Database connection failed'));

			await expect(getShoppingList('32', '2024', 1)).rejects.toThrow('Database connection failed');
		});

		it('should group identical ingredients with same measurement', async () => {
			const mockFreshIngredients = [
				{
					id: 1,
					name: 'Bacon',
					cost: 3.99,
					stockcode: 'B001',
					purchased: false,
					sort: 1,
					quantity: '1',
					quantityMeasure: 'packet',
					ingredientId: 101,
					supermarketCategory: 'Meat',
					pantryCategory: null,
					fresh: 1,
					household_id: 1,
				},
				{
					id: 2,
					name: 'Bacon',
					cost: 3.99,
					stockcode: 'B001',
					purchased: false,
					sort: 2,
					quantity: '0.5',
					quantityMeasure: 'packet',
					ingredientId: 101,
					supermarketCategory: 'Meat',
					pantryCategory: null,
					fresh: 1,
					household_id: 1,
				},
			];

			const expectedFresh = [
				{
					id: 1,
					ids: [1, 2],
					name: 'Bacon',
					cost: 3.99,
					stockcode: 'B001',
					purchased: false,
					sort: 1,
					quantity: '1.5',
					quantityMeasure: 'packet',
					ingredientId: 101,
					supermarketCategory: 'Meat',
					pantryCategory: null,
					fresh: 1,
					household_id: 1,
					ingredient: 'Bacon',
				},
			];

			mockPool.execute
				.mockResolvedValueOnce([mockFreshIngredients as RowDataPacket[], []]) // Fresh ingredients call
				.mockResolvedValueOnce([[] as RowDataPacket[], []]); // Pantry ingredients call

			const result = await getShoppingList('32', '2024', 1);

			expect(result.fresh).toEqual(expectedFresh);
			expect(result.fresh[0].ids).toHaveLength(2);
			expect(result.fresh[0].quantity).toBe('1.5');
		});

		it('should NOT group identical ingredients with different measurements', async () => {
			const mockFreshIngredients = [
				{
					id: 1,
					name: 'Spinach',
					cost: 2.99,
					stockcode: 'S001',
					purchased: false,
					sort: 1,
					quantity: '2',
					quantityMeasure: 'cups',
					ingredientId: 102,
					supermarketCategory: 'Vegetables',
					pantryCategory: null,
					fresh: 1,
					household_id: 1,
				},
				{
					id: 2,
					name: 'Spinach',
					cost: 2.99,
					stockcode: 'S001',
					purchased: false,
					sort: 2,
					quantity: '1',
					quantityMeasure: 'bag',
					ingredientId: 102,
					supermarketCategory: 'Vegetables',
					pantryCategory: null,
					fresh: 1,
					household_id: 1,
				},
			];

			mockPool.execute
				.mockResolvedValueOnce([mockFreshIngredients as RowDataPacket[], []]) // Fresh ingredients call
				.mockResolvedValueOnce([[] as RowDataPacket[], []]); // Pantry ingredients call

			const result = await getShoppingList('32', '2024', 1);

			// Should have 2 separate items
			expect(result.fresh).toHaveLength(2);
			expect(result.fresh[0].quantityMeasure).toBe('cups');
			expect(result.fresh[0].quantity).toBe('2');
			expect(result.fresh[1].quantityMeasure).toBe('bag');
			expect(result.fresh[1].quantity).toBe('1');
		});

		it('should include all necessary ingredient information', async () => {
			const mockIngredient = {
				id: 1,
				name: 'Complex Ingredient',
				cost: 3.99,
				stockcode: 'CI001',
				purchased: true,
				sort: 5,
				quantity: '1.5',
				quantityMeasure: 'cups',
				ingredientId: 103,
				supermarketCategory: 'Test Category',
				pantryCategory: 'Test Pantry',
				fresh: 1,
				household_id: 2,
			};

			const expectedIngredient = {
				id: 1,
				ids: [1],
				name: 'Complex Ingredient',
				cost: 3.99,
				stockcode: 'CI001',
				purchased: true,
				sort: 5,
				quantity: '1.5',
				quantityMeasure: 'cups',
				ingredientId: 103,
				supermarketCategory: 'Test Category',
				pantryCategory: 'Test Pantry',
				fresh: 1,
				household_id: 2,
				ingredient: 'Complex Ingredient',
			};

			mockPool.execute
				.mockResolvedValueOnce([[mockIngredient] as RowDataPacket[], []]) // Fresh ingredients
				.mockResolvedValueOnce([[] as RowDataPacket[], []]); // Pantry ingredients

			const result = await getShoppingList('32', '2024', 2);

			expect(result.fresh[0]).toEqual(expectedIngredient);
			expect(result.fresh[0]).toHaveProperty('household_id', 2);
			expect(result.fresh[0]).toHaveProperty('quantityMeasure');
			expect(result.fresh[0]).toHaveProperty('supermarketCategory');
			expect(result.fresh[0]).toHaveProperty('pantryCategory');
			expect(result.fresh[0]).toHaveProperty('ids');
			expect(result.fresh[0]).toHaveProperty('ingredient');
		});
	});
});
