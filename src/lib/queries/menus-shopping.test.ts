/* eslint-disable @typescript-eslint/no-explicit-any */
import { resetShoppingListFromRecipesHousehold } from './menus';
import pool from '@/lib/db.js';

// Mock the database pool
jest.mock('@/lib/db.js');
const mockPool = pool as jest.Mocked<typeof pool>;

// Mock connection object
const mockConnection = {
	beginTransaction: jest.fn(),
	execute: jest.fn(),
	commit: jest.fn(),
	rollback: jest.fn(),
	release: jest.fn(),
};

describe('Household-Scoped Shopping List Reset', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockPool.getConnection.mockResolvedValue(mockConnection as any);
	});

	describe('resetShoppingListFromRecipesHousehold', () => {
		it('should reset shopping list for specific household', async () => {
			const mockIngredients = [
				{
					recipeIngredient_id: 1,
					ingredient_id: 101,
					quantity: '2',
					quantity4: '4',
					quantityMeasure_id: 1,
					ingredient_name: 'Tomatoes',
					pantryCategory_id: 1,
					supermarketCategory_id: 1,
					fresh: 1,
					cost: 2.5,
					stockcode: 'T001',
					measure_name: 'cups',
				},
				{
					recipeIngredient_id: 2,
					ingredient_id: 102,
					quantity: '1',
					quantity4: '2',
					quantityMeasure_id: 2,
					ingredient_name: 'Olive Oil',
					pantryCategory_id: 2,
					supermarketCategory_id: 2,
					fresh: 0,
					cost: 5.99,
					stockcode: 'OO001',
					measure_name: 'tbsp',
				},
			];

			mockConnection.execute
				.mockResolvedValueOnce(undefined) // DELETE query
				.mockResolvedValueOnce([mockIngredients, []]) // SELECT query for ingredients
				.mockResolvedValueOnce(undefined); // INSERT query

			await resetShoppingListFromRecipesHousehold(32, 2024, 1);

			// Verify transaction handling
			expect(mockConnection.beginTransaction).toHaveBeenCalled();
			expect(mockConnection.commit).toHaveBeenCalled();
			expect(mockConnection.release).toHaveBeenCalled();

			// Verify DELETE includes household_id
			expect(mockConnection.execute).toHaveBeenCalledWith('DELETE FROM shopping_lists WHERE week = ? AND year = ? AND household_id = ?', [32, 2024, 1]);

			// Verify SELECT includes household_id
			expect(mockConnection.execute).toHaveBeenCalledWith(
				expect.stringContaining('WHERE rw.week = ? AND rw.year = ? AND rw.household_id = ?'),
				[32, 2024, 1]
			);

			// Verify INSERT includes household_id
			expect(mockConnection.execute).toHaveBeenCalledWith(
				expect.stringContaining(
					'INSERT INTO shopping_lists (week, year, household_id, fresh, name, sort, cost, recipeIngredient_id, purchased, stockcode)'
				),
				expect.any(Array)
			);
		});

		it('should NOT group ingredients during insertion - grouping happens during READ', async () => {
			const mockDuplicateIngredients = [
				{
					recipeIngredient_id: 1,
					ingredient_id: 101,
					quantity: '1',
					quantity4: '2',
					quantityMeasure_id: 1,
					ingredient_name: 'Tomatoes',
					pantryCategory_id: 1,
					supermarketCategory_id: 1,
					fresh: 1,
					cost: 2.5,
					stockcode: 'T001',
					measure_name: 'cups',
				},
				{
					recipeIngredient_id: 2,
					ingredient_id: 101, // Same ingredient
					quantity: '2',
					quantity4: '4',
					quantityMeasure_id: 1, // Same measure
					ingredient_name: 'Tomatoes',
					pantryCategory_id: 1,
					supermarketCategory_id: 1,
					fresh: 1,
					cost: 2.5,
					stockcode: 'T001',
					measure_name: 'cups',
				},
			];

			mockConnection.execute
				.mockResolvedValueOnce(undefined) // DELETE
				.mockResolvedValueOnce([mockDuplicateIngredients, []]) // SELECT
				.mockResolvedValueOnce(undefined); // INSERT

			await resetShoppingListFromRecipesHousehold(32, 2024, 1);

			// Verify both ingredients are inserted separately (no grouping during INSERT)
			const insertCall = mockConnection.execute.mock.calls.find(call => call[0].includes('INSERT INTO shopping_lists'));

			expect(insertCall).toBeTruthy();
			const insertValues = insertCall![1];

			// Should have two separate entries (10 values per ingredient)
			expect(insertValues.length).toBe(20);
		});

		it('should handle empty ingredients list', async () => {
			mockConnection.execute
				.mockResolvedValueOnce(undefined) // DELETE
				.mockResolvedValueOnce([[], []]); // SELECT returns empty

			await resetShoppingListFromRecipesHousehold(32, 2024, 1);

			// Verify transaction still completes
			expect(mockConnection.beginTransaction).toHaveBeenCalled();
			expect(mockConnection.commit).toHaveBeenCalled();
			expect(mockConnection.release).toHaveBeenCalled();

			// Should not attempt INSERT with empty ingredients
			const insertCalls = mockConnection.execute.mock.calls.filter(call => call[0].includes('INSERT INTO shopping_lists'));
			expect(insertCalls).toHaveLength(0);
		});

		it('should rollback on error', async () => {
			const error = new Error('Database error');
			mockConnection.execute
				.mockResolvedValueOnce(undefined) // DELETE succeeds
				.mockRejectedValueOnce(error); // SELECT fails

			await expect(resetShoppingListFromRecipesHousehold(32, 2024, 1)).rejects.toThrow('Database error');

			expect(mockConnection.beginTransaction).toHaveBeenCalled();
			expect(mockConnection.rollback).toHaveBeenCalled();
			expect(mockConnection.release).toHaveBeenCalled();
			expect(mockConnection.commit).not.toHaveBeenCalled();
		});

		it('should order ingredients by category for consistent shopping list', async () => {
			mockConnection.execute
				.mockResolvedValueOnce(undefined) // DELETE
				.mockResolvedValueOnce([[], []]); // SELECT

			await resetShoppingListFromRecipesHousehold(32, 2024, 1);

			// Verify ordering is applied
			expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY'), [32, 2024, 1]);

			expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('WHEN i.fresh = 1 THEN i.supermarketCategory_id'), [32, 2024, 1]);
		});

		it('should preserve cost and stockcode from ingredients table', async () => {
			const mockIngredient = {
				recipeIngredient_id: 1,
				ingredient_id: 101,
				quantity: '2',
				quantity4: '4',
				quantityMeasure_id: 1,
				ingredient_name: 'Premium Tomatoes',
				pantryCategory_id: 1,
				supermarketCategory_id: 1,
				fresh: 1,
				cost: 4.99,
				stockcode: 'PREM001',
				measure_name: 'cups',
			};

			mockConnection.execute
				.mockResolvedValueOnce(undefined) // DELETE
				.mockResolvedValueOnce([[mockIngredient], []]) // SELECT
				.mockResolvedValueOnce(undefined); // INSERT

			await resetShoppingListFromRecipesHousehold(32, 2024, 1);

			const insertCall = mockConnection.execute.mock.calls.find(call => call[0].includes('INSERT INTO shopping_lists'));

			const insertValues = insertCall![1];

			// Verify cost and stockcode are preserved
			expect(insertValues).toContain(4.99); // cost
			expect(insertValues).toContain('PREM001'); // stockcode
			expect(insertValues).toContain('Premium Tomatoes'); // name
		});

		it('should include household_id in queries for data isolation', async () => {
			mockConnection.execute
				.mockResolvedValueOnce(undefined) // DELETE
				.mockResolvedValueOnce([[], []]); // SELECT

			await resetShoppingListFromRecipesHousehold(32, 2024, 5);

			// Verify all queries use the correct household_id
			expect(mockConnection.execute).toHaveBeenCalledWith('DELETE FROM shopping_lists WHERE week = ? AND year = ? AND household_id = ?', [32, 2024, 5]);

			expect(mockConnection.execute).toHaveBeenCalledWith(
				expect.stringContaining('WHERE rw.week = ? AND rw.year = ? AND rw.household_id = ?'),
				[32, 2024, 5]
			);
		});
	});
});
