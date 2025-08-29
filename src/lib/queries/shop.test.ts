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
					quantity4: '4',
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
					quantity4: '2',
					quantityMeasure: 'tbsp',
					ingredientId: 102,
					supermarketCategory: 'Oils & Vinegars',
					pantryCategory: 'Pantry Staples',
					fresh: 0,
					household_id: 1,
				},
			];

			mockPool.execute
				.mockResolvedValueOnce([mockFreshIngredients as RowDataPacket[], []]) // Fresh ingredients call
				.mockResolvedValueOnce([mockPantryIngredients as RowDataPacket[], []]); // Pantry ingredients call

			const result = await getShoppingList('32', '2024', 1);

			expect(result).toEqual({
				fresh: mockFreshIngredients,
				pantry: mockPantryIngredients,
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

		it('should include all necessary ingredient information', async () => {
			const mockIngredient = {
				id: 1,
				name: 'Complex Ingredient',
				cost: 3.99,
				stockcode: 'CI001',
				purchased: true,
				sort: 5,
				quantity: '1.5',
				quantity4: '3',
				quantityMeasure: 'cups',
				ingredientId: 103,
				supermarketCategory: 'Test Category',
				pantryCategory: 'Test Pantry',
				fresh: 1,
				household_id: 2,
			};

			mockPool.execute
				.mockResolvedValueOnce([[mockIngredient] as RowDataPacket[], []]) // Fresh ingredients
				.mockResolvedValueOnce([[] as RowDataPacket[], []]); // Pantry ingredients

			const result = await getShoppingList('32', '2024', 2);

			expect(result.fresh[0]).toEqual(mockIngredient);
			expect(result.fresh[0]).toHaveProperty('household_id', 2);
			expect(result.fresh[0]).toHaveProperty('quantityMeasure');
			expect(result.fresh[0]).toHaveProperty('supermarketCategory');
			expect(result.fresh[0]).toHaveProperty('pantryCategory');
		});
	});
});
