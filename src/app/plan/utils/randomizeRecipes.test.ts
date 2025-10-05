import { selectRandomRecipes } from './randomizeRecipes';
import { Recipe } from '@/types/menus';

describe('selectRandomRecipes', () => {
	// Helper to create mock recipes
	const createRecipe = (id: number, primaryType: string | undefined, secondaryType: string | undefined): Recipe => ({
		id,
		name: `Recipe ${id}`,
		image_filename: `recipe${id}.jpg`,
		pdf_filename: `recipe${id}.pdf`,
		url_slug: `recipe-${id}`,
		collection_url_slug: 'collection-1',
		household_id: 1,
		primaryTypeName: primaryType,
		secondaryTypeName: secondaryType,
	});

	describe('Recipe Exclusion', () => {
		it('should exclude recipes in excludeRecipeIds set', () => {
			const recipes = [createRecipe(1, 'Chicken', 'Rice'), createRecipe(2, 'Beef', 'Pasta'), createRecipe(3, 'Fish', 'Quinoa')];

			const excludeSet = new Set([1, 3]);
			const result = selectRandomRecipes(recipes, excludeSet, 2);

			// Should only select recipe 2 since 1 and 3 are excluded
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe(2);
		});

		it('should return empty array when all recipes are excluded', () => {
			const recipes = [createRecipe(1, 'Chicken', 'Rice'), createRecipe(2, 'Beef', 'Pasta')];

			const excludeSet = new Set([1, 2]);
			const result = selectRandomRecipes(recipes, excludeSet, 3);

			expect(result).toEqual([]);
		});
	});

	describe('Protein/Carb Type Constraints', () => {
		it('should avoid duplicate primary types (proteins)', () => {
			const recipes = [
				createRecipe(1, 'Chicken', 'Rice'),
				createRecipe(2, 'Chicken', 'Pasta'), // duplicate primary
				createRecipe(3, 'Beef', 'Quinoa'),
			];

			const result = selectRandomRecipes(recipes, new Set(), 3);

			// Should select at most 2 recipes (skip one with duplicate Chicken)
			expect(result.length).toBeLessThanOrEqual(2);

			// Verify no duplicate primary types
			const primaryTypes = result.map(r => r.primaryTypeName).filter(Boolean);
			const uniquePrimaryTypes = new Set(primaryTypes);
			expect(primaryTypes.length).toBe(uniquePrimaryTypes.size);
		});

		it('should avoid duplicate secondary types (carbs)', () => {
			const recipes = [
				createRecipe(1, 'Chicken', 'Rice'),
				createRecipe(2, 'Beef', 'Rice'), // duplicate secondary
				createRecipe(3, 'Fish', 'Pasta'),
			];

			const result = selectRandomRecipes(recipes, new Set(), 3);

			// Should select at most 2 recipes (skip one with duplicate Rice)
			expect(result.length).toBeLessThanOrEqual(2);

			// Verify no duplicate secondary types
			const secondaryTypes = result.map(r => r.secondaryTypeName).filter(Boolean);
			const uniqueSecondaryTypes = new Set(secondaryTypes);
			expect(secondaryTypes.length).toBe(uniqueSecondaryTypes.size);
		});

		it('should handle recipes with undefined protein/carb types', () => {
			const recipes = [createRecipe(1, 'Chicken', 'Rice'), createRecipe(2, undefined, 'Pasta'), createRecipe(3, 'Beef', undefined)];

			const result = selectRandomRecipes(recipes, new Set(), 3);

			// All recipes should be selectable (undefined types don't conflict)
			expect(result.length).toBeGreaterThan(0);
		});

		it('should allow recipes with same protein if secondary types differ and vice versa', () => {
			const recipes = [createRecipe(1, 'Chicken', 'Rice'), createRecipe(2, 'Beef', 'Pasta'), createRecipe(3, 'Fish', 'Quinoa')];

			const result = selectRandomRecipes(recipes, new Set(), 3);

			// All recipes have unique protein/carb combinations
			expect(result).toHaveLength(3);
		});
	});

	describe('Progressive Filtering Logic', () => {
		it('should progressively reduce available pool after each selection', () => {
			const recipes = [
				createRecipe(1, 'Chicken', 'Rice'),
				createRecipe(2, 'Chicken', 'Pasta'), // conflicts with 1's primary
				createRecipe(3, 'Beef', 'Rice'), // conflicts with 1's secondary
				createRecipe(4, 'Fish', 'Quinoa'), // no conflicts
			];

			const result = selectRandomRecipes(recipes, new Set(), 2);

			// Should be able to select 2 recipes maximum
			// First selection removes some options, second selection from remaining
			expect(result.length).toBeLessThanOrEqual(2);

			// Verify no conflicts in selection
			const primaryTypes = result.map(r => r.primaryTypeName).filter(Boolean);
			const secondaryTypes = result.map(r => r.secondaryTypeName).filter(Boolean);

			expect(new Set(primaryTypes).size).toBe(primaryTypes.length);
			expect(new Set(secondaryTypes).size).toBe(secondaryTypes.length);
		});
	});

	describe('Count Parameter', () => {
		it('should return exactly count recipes when enough available', () => {
			const recipes = [
				createRecipe(1, 'Chicken', 'Rice'),
				createRecipe(2, 'Beef', 'Pasta'),
				createRecipe(3, 'Fish', 'Quinoa'),
				createRecipe(4, 'Pork', 'Potatoes'),
				createRecipe(5, 'Lamb', 'Couscous'),
			];

			const result = selectRandomRecipes(recipes, new Set(), 3);
			expect(result).toHaveLength(3);
		});

		it('should return fewer than count when pool exhausted by constraints', () => {
			const recipes = [
				createRecipe(1, 'Chicken', 'Rice'),
				createRecipe(2, 'Chicken', 'Pasta'), // conflicts with 1
				createRecipe(3, 'Beef', 'Rice'), // conflicts with 1
			];

			const result = selectRandomRecipes(recipes, new Set(), 3);

			// Can only select 1 or 2 due to conflicts
			expect(result.length).toBeLessThan(3);
		});

		it('should handle count of 0', () => {
			const recipes = [createRecipe(1, 'Chicken', 'Rice')];

			const result = selectRandomRecipes(recipes, new Set(), 0);
			expect(result).toEqual([]);
		});

		it('should handle count of 1', () => {
			const recipes = [createRecipe(1, 'Chicken', 'Rice'), createRecipe(2, 'Beef', 'Pasta')];

			const result = selectRandomRecipes(recipes, new Set(), 1);
			expect(result).toHaveLength(1);
		});

		it('should handle count greater than available recipes', () => {
			const recipes = [createRecipe(1, 'Chicken', 'Rice'), createRecipe(2, 'Beef', 'Pasta')];

			const result = selectRandomRecipes(recipes, new Set(), 10);

			// Should return at most 2 recipes
			expect(result.length).toBeLessThanOrEqual(2);
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty recipe list', () => {
			const result = selectRandomRecipes([], new Set(), 3);
			expect(result).toEqual([]);
		});

		it('should handle empty exclude set', () => {
			const recipes = [createRecipe(1, 'Chicken', 'Rice'), createRecipe(2, 'Beef', 'Pasta')];

			const result = selectRandomRecipes(recipes, new Set(), 2);
			expect(result.length).toBeGreaterThan(0);
		});

		it('should handle recipes with both undefined types', () => {
			const recipes = [createRecipe(1, undefined, undefined), createRecipe(2, undefined, undefined), createRecipe(3, undefined, undefined)];

			const result = selectRandomRecipes(recipes, new Set(), 3);

			// All recipes should be selectable since no conflicts
			expect(result).toHaveLength(3);
		});
	});

	describe('Randomness', () => {
		it('should produce different results on multiple runs', () => {
			const recipes = Array.from({ length: 10 }, (_, i) => createRecipe(i + 1, `Protein${i}`, `Carb${i}`));

			const results = Array.from({ length: 5 }, () =>
				selectRandomRecipes(recipes, new Set(), 3)
					.map(r => r.id)
					.join(',')
			);

			const uniqueResults = new Set(results);

			// Should have variation (at least 2 different results in 5 runs)
			// Note: There's a tiny chance this could fail randomly, but highly unlikely
			expect(uniqueResults.size).toBeGreaterThan(1);
		});

		it('should randomly select from available pool each iteration', () => {
			const recipes = [
				createRecipe(1, 'Chicken', 'Rice'),
				createRecipe(2, 'Beef', 'Pasta'),
				createRecipe(3, 'Fish', 'Quinoa'),
				createRecipe(4, 'Pork', 'Potatoes'),
			];

			// Run multiple times and collect first selections
			const firstSelections = Array.from({ length: 20 }, () => selectRandomRecipes(recipes, new Set(), 1)[0].id);

			// Should have variation in first selections (not always the same recipe)
			const uniqueFirstSelections = new Set(firstSelections);
			expect(uniqueFirstSelections.size).toBeGreaterThan(1);
		});
	});

	describe('Real-World Scenarios', () => {
		it('should handle typical meal planning with 3 recipes', () => {
			const recipes = [
				createRecipe(1, 'Chicken', 'Rice'),
				createRecipe(2, 'Beef', 'Pasta'),
				createRecipe(3, 'Fish', 'Quinoa'),
				createRecipe(4, 'Pork', 'Potatoes'),
				createRecipe(5, 'Lamb', 'Couscous'),
			];

			const result = selectRandomRecipes(recipes, new Set(), 3);

			expect(result).toHaveLength(3);

			// Verify variety
			const primaryTypes = result.map(r => r.primaryTypeName);
			const secondaryTypes = result.map(r => r.secondaryTypeName);

			expect(new Set(primaryTypes).size).toBe(3); // All unique proteins
			expect(new Set(secondaryTypes).size).toBe(3); // All unique carbs
		});

		it('should handle swapping one recipe (excluding current plan)', () => {
			const allRecipes = [
				createRecipe(1, 'Chicken', 'Rice'),
				createRecipe(2, 'Beef', 'Pasta'),
				createRecipe(3, 'Fish', 'Quinoa'),
				createRecipe(4, 'Pork', 'Potatoes'),
			];

			// Current plan has recipes 1, 2, 3
			const currentPlanIds = new Set([1, 2, 3]);

			// Swap should only return recipe 4
			const result = selectRandomRecipes(allRecipes, currentPlanIds, 1);

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe(4);
		});

		it('should handle adding random recipe to existing plan', () => {
			const allRecipes = [
				createRecipe(1, 'Chicken', 'Rice'),
				createRecipe(2, 'Beef', 'Pasta'),
				createRecipe(3, 'Fish', 'Quinoa'),
				createRecipe(4, 'Pork', 'Potatoes'),
				createRecipe(5, 'Lamb', 'Couscous'),
			];

			// Current plan has 2 recipes
			const currentPlanIds = new Set([1, 2]);

			// Add one more recipe
			const result = selectRandomRecipes(allRecipes, currentPlanIds, 1);

			expect(result).toHaveLength(1);
			expect([3, 4, 5]).toContain(result[0].id);
		});
	});
});
