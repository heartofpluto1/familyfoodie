import {
	copyRecipeForEdit,
	copyIngredientForEdit,
	cascadeCopyWithContext,
	cascadeCopyIngredientWithContext,
	cleanupOrphanedIngredients,
	cleanupOrphanedRecipeIngredients,
	performCompleteCleanupAfterRecipeDelete,
} from './copy-on-write';
import * as copyOperations from './queries/copy-operations';
import pool from './db.js';

// Mock the database pool and operations
jest.mock('./db.js');
jest.mock('./queries/copy-operations');

const mockPool = pool as jest.Mocked<typeof pool>;
const mockCopyOperations = copyOperations as jest.Mocked<typeof copyOperations>;

describe('Copy-on-Write Functions', () => {
	let mockConnection: jest.Mocked<PoolConnection>;

	beforeEach(() => {
		mockConnection = {
			getConnection: jest.fn(),
			beginTransaction: jest.fn(),
			commit: jest.fn(),
			rollback: jest.fn(),
			release: jest.fn(),
			execute: jest.fn(),
		};

		mockPool.getConnection.mockResolvedValue(mockConnection);
		jest.clearAllMocks();
	});

	describe('copyRecipeForEdit', () => {
		const mockRecipe = {
			id: 1,
			name: 'Test Recipe',
			prepTime: 30,
			cookTime: 45,
			description: 'Test description',
			duplicate: 0,
			season_id: 1,
			primaryType_id: 1,
			secondaryType_id: 1,
			public: 0,
			url_slug: 'test-recipe',
			image_filename: 'test.jpg',
			pdf_filename: 'test.pdf',
			household_id: 1,
			parent_id: null,
		};

		it('should return original recipe if already owned by household', async () => {
			mockCopyOperations.getRecipeById.mockResolvedValue(mockRecipe);

			const result = await copyRecipeForEdit(1, 1); // same household

			expect(result).toEqual({ copied: false, newId: 1 });
			expect(mockConnection.commit).toHaveBeenCalled();
			expect(mockConnection.release).toHaveBeenCalled();
		});

		it('should copy recipe if not owned by household', async () => {
			const foreignRecipe = { ...mockRecipe, household_id: 2 };
			mockCopyOperations.getRecipeById.mockResolvedValue(foreignRecipe);
			mockCopyOperations.copyRecipe.mockResolvedValue(10);

			const result = await copyRecipeForEdit(1, 1);

			expect(result).toEqual({ copied: true, newId: 10 });
			expect(mockCopyOperations.copyRecipe).toHaveBeenCalledWith(mockConnection, foreignRecipe, 1);
			expect(mockCopyOperations.copyRecipeIngredients).toHaveBeenCalledWith(mockConnection, 1, 10);
			expect(mockCopyOperations.updateJunctionTableForRecipe).toHaveBeenCalledWith(mockConnection, 1, 10, 1);
			expect(mockConnection.commit).toHaveBeenCalled();
		});

		it('should handle recipe not found', async () => {
			mockCopyOperations.getRecipeById.mockResolvedValue(null);

			await expect(copyRecipeForEdit(999, 1)).rejects.toThrow('Recipe with ID 999 not found');
			expect(mockConnection.rollback).toHaveBeenCalled();
			expect(mockConnection.release).toHaveBeenCalled();
		});

		it('should rollback on database error', async () => {
			mockCopyOperations.getRecipeById.mockRejectedValue(new Error('Database error'));

			await expect(copyRecipeForEdit(1, 1)).rejects.toThrow('Database error');
			expect(mockConnection.rollback).toHaveBeenCalled();
			expect(mockConnection.release).toHaveBeenCalled();
		});
	});

	describe('copyIngredientForEdit', () => {
		const mockIngredient = {
			id: 1,
			name: 'Test Ingredient',
			fresh: 1,
			supermarketCategory_id: 1,
			cost: 2.5,
			stockcode: 'TEST001',
			public: 0,
			pantryCategory_id: 1,
			household_id: 1,
			parent_id: null,
		};

		it('should return original ingredient if already owned by household', async () => {
			mockCopyOperations.getIngredientById.mockResolvedValue(mockIngredient);

			const result = await copyIngredientForEdit(1, 1);

			expect(result).toEqual({ copied: false, newId: 1 });
			expect(mockConnection.commit).toHaveBeenCalled();
		});

		it('should copy ingredient if not owned by household', async () => {
			const foreignIngredient = { ...mockIngredient, household_id: 2 };
			mockCopyOperations.getIngredientById.mockResolvedValue(foreignIngredient);
			mockCopyOperations.copyIngredient.mockResolvedValue(20);

			const result = await copyIngredientForEdit(1, 1);

			expect(result).toEqual({ copied: true, newId: 20 });
			expect(mockCopyOperations.copyIngredient).toHaveBeenCalledWith(mockConnection, foreignIngredient, 1);
			expect(mockCopyOperations.updateRecipeIngredientsForHousehold).toHaveBeenCalledWith(mockConnection, 1, 20, 1);
			expect(mockConnection.commit).toHaveBeenCalled();
		});

		it('should handle ingredient not found', async () => {
			mockCopyOperations.getIngredientById.mockResolvedValue(null);

			await expect(copyIngredientForEdit(999, 1)).rejects.toThrow('Ingredient with ID 999 not found');
			expect(mockConnection.rollback).toHaveBeenCalled();
		});
	});

	describe('cascadeCopyWithContext', () => {
		const mockCollection = {
			id: 1,
			title: 'Test Collection',
			subtitle: 'Test subtitle',
			filename: 'test.jpg',
			filename_dark: 'test-dark.jpg',
			household_id: 2,
			parent_id: null,
			public: 1,
			url_slug: 'test-collection',
		};

		const mockRecipe = {
			id: 1,
			name: 'Test Recipe',
			prepTime: 30,
			cookTime: 45,
			description: 'Test description',
			duplicate: 0,
			season_id: 1,
			primaryType_id: 1,
			secondaryType_id: 1,
			public: 0,
			url_slug: 'test-recipe',
			image_filename: null,
			pdf_filename: null,
			household_id: 2,
			parent_id: null,
		};

		it('should copy both collection and recipe if neither owned by household', async () => {
			mockCopyOperations.getCollectionById.mockResolvedValue(mockCollection);
			mockCopyOperations.getRecipeById.mockResolvedValue(mockRecipe);
			mockCopyOperations.copyCollection.mockResolvedValue(100);
			mockCopyOperations.copyRecipe.mockResolvedValue(200);

			const result = await cascadeCopyWithContext(1, 1, 1);

			expect(result.newCollectionId).toBe(100);
			expect(result.newRecipeId).toBe(200);
			expect(result.actionsTaken).toEqual(['collection_copied', 'unsubscribed_from_original', 'recipe_copied']);

			expect(mockCopyOperations.copyCollection).toHaveBeenCalledWith(mockConnection, mockCollection, 1);
			expect(mockCopyOperations.copyCollectionRecipes).toHaveBeenCalledWith(mockConnection, 1, 100);
			expect(mockCopyOperations.removeCollectionSubscription).toHaveBeenCalledWith(mockConnection, 1, 1);
			expect(mockCopyOperations.copyRecipe).toHaveBeenCalledWith(mockConnection, mockRecipe, 1);
		});

		it('should copy only recipe if collection already owned', async () => {
			const ownedCollection = { ...mockCollection, household_id: 1 };
			mockCopyOperations.getCollectionById.mockResolvedValue(ownedCollection);
			mockCopyOperations.getRecipeById.mockResolvedValue(mockRecipe);
			mockCopyOperations.copyRecipe.mockResolvedValue(200);

			const result = await cascadeCopyWithContext(1, 1, 1);

			expect(result.newCollectionId).toBe(1);
			expect(result.newRecipeId).toBe(200);
			expect(result.actionsTaken).toEqual(['recipe_copied']);

			expect(mockCopyOperations.copyCollection).not.toHaveBeenCalled();
			expect(mockCopyOperations.copyRecipe).toHaveBeenCalledWith(mockConnection, mockRecipe, 1);
		});

		it('should copy neither if both already owned', async () => {
			const ownedCollection = { ...mockCollection, household_id: 1 };
			const ownedRecipe = { ...mockRecipe, household_id: 1 };
			mockCopyOperations.getCollectionById.mockResolvedValue(ownedCollection);
			mockCopyOperations.getRecipeById.mockResolvedValue(ownedRecipe);

			const result = await cascadeCopyWithContext(1, 1, 1);

			expect(result.newCollectionId).toBe(1);
			expect(result.newRecipeId).toBe(1);
			expect(result.actionsTaken).toEqual([]);

			expect(mockCopyOperations.copyCollection).not.toHaveBeenCalled();
			expect(mockCopyOperations.copyRecipe).not.toHaveBeenCalled();
		});

		it('should handle collection not found', async () => {
			mockCopyOperations.getCollectionById.mockResolvedValue(null);

			await expect(cascadeCopyWithContext(1, 999, 1)).rejects.toThrow('Collection with ID 999 not found');
			expect(mockConnection.rollback).toHaveBeenCalled();
		});
	});

	describe('cascadeCopyIngredientWithContext', () => {
		const mockIngredient = {
			id: 1,
			name: 'Test Ingredient',
			fresh: 1,
			supermarketCategory_id: 1,
			cost: 2.5,
			stockcode: 'TEST001',
			public: 0,
			pantryCategory_id: 1,
			household_id: 2,
			parent_id: null,
		};

		it('should copy collection, recipe, and ingredient when none owned', async () => {
			// Mock the cascade copy results
			mockCopyOperations.getCollectionById.mockResolvedValue({
				id: 1,
				title: 'Test Collection',
				subtitle: null,
				filename: null,
				filename_dark: null,
				household_id: 2,
				parent_id: null,
				public: 1,
				url_slug: 'test-collection',
			});

			mockCopyOperations.getRecipeById.mockResolvedValue({
				id: 1,
				name: 'Test Recipe',
				prepTime: 30,
				cookTime: 45,
				description: null,
				duplicate: 0,
				season_id: 1,
				primaryType_id: 1,
				secondaryType_id: 1,
				public: 0,
				url_slug: 'test-recipe',
				image_filename: null,
				pdf_filename: null,
				household_id: 2,
				parent_id: null,
			});

			mockCopyOperations.getIngredientById.mockResolvedValue(mockIngredient);
			mockCopyOperations.copyCollection.mockResolvedValue(100);
			mockCopyOperations.copyRecipe.mockResolvedValue(200);
			mockCopyOperations.copyIngredient.mockResolvedValue(300);

			const result = await cascadeCopyIngredientWithContext(1, 1, 1, 1);

			expect(result.newCollectionId).toBe(100);
			expect(result.newRecipeId).toBe(200);
			expect(result.newIngredientId).toBe(300);
			expect(result.actionsTaken).toEqual(['collection_copied', 'unsubscribed_from_original', 'recipe_copied', 'ingredient_copied']);

			expect(mockCopyOperations.copyIngredient).toHaveBeenCalledWith(mockConnection, mockIngredient, 1);
			expect(mockCopyOperations.updateRecipeIngredientsForHousehold).toHaveBeenCalledWith(mockConnection, 1, 300, 1);
		});

		it('should handle ingredient not found', async () => {
			mockCopyOperations.getIngredientById.mockResolvedValue(null);

			await expect(cascadeCopyIngredientWithContext(1, 1, 1, 999)).rejects.toThrow('Ingredient with ID 999 not found');
			expect(mockConnection.rollback).toHaveBeenCalled();
		});
	});

	describe('cleanupOrphanedIngredients', () => {
		it('should clean up orphaned ingredients successfully', async () => {
			mockCopyOperations.deleteOrphanedIngredients.mockResolvedValue([5, 6, 7]);

			const result = await cleanupOrphanedIngredients(1, 10);

			expect(result.deletedIngredientIds).toEqual([5, 6, 7]);
			expect(mockCopyOperations.deleteOrphanedIngredients).toHaveBeenCalledWith(mockConnection, 1, 10);
			expect(mockConnection.commit).toHaveBeenCalled();
		});

		it('should handle cleanup errors', async () => {
			mockCopyOperations.deleteOrphanedIngredients.mockRejectedValue(new Error('Cleanup error'));

			await expect(cleanupOrphanedIngredients(1, 10)).rejects.toThrow('Cleanup error');
			expect(mockConnection.rollback).toHaveBeenCalled();
		});
	});

	describe('cleanupOrphanedRecipeIngredients', () => {
		it('should clean up recipe ingredients successfully', async () => {
			mockCopyOperations.deleteRecipeIngredients.mockResolvedValue(5);

			const result = await cleanupOrphanedRecipeIngredients(10);

			expect(result.deletedCount).toBe(5);
			expect(mockCopyOperations.deleteRecipeIngredients).toHaveBeenCalledWith(mockConnection, 10);
			expect(mockConnection.commit).toHaveBeenCalled();
		});
	});

	describe('performCompleteCleanupAfterRecipeDelete', () => {
		it('should perform complete cleanup successfully', async () => {
			mockCopyOperations.deleteRecipeIngredients.mockResolvedValue(3);
			mockCopyOperations.deleteOrphanedIngredients.mockResolvedValue([8, 9]);

			const result = await performCompleteCleanupAfterRecipeDelete(10, 1);

			expect(result.deletedRecipeIngredients).toBe(3);
			expect(result.deletedOrphanedIngredients).toEqual([8, 9]);
			expect(mockCopyOperations.deleteRecipeIngredients).toHaveBeenCalledWith(mockConnection, 10);
			expect(mockCopyOperations.deleteOrphanedIngredients).toHaveBeenCalledWith(mockConnection, 1, 10);
			expect(mockConnection.commit).toHaveBeenCalled();
		});

		it('should rollback on error during complete cleanup', async () => {
			mockCopyOperations.deleteRecipeIngredients.mockResolvedValue(3);
			mockCopyOperations.deleteOrphanedIngredients.mockRejectedValue(new Error('Cleanup error'));

			await expect(performCompleteCleanupAfterRecipeDelete(10, 1)).rejects.toThrow('Cleanup error');
			expect(mockConnection.rollback).toHaveBeenCalled();
		});
	});

	describe('Transaction Management', () => {
		it('should handle transaction lifecycle correctly', async () => {
			mockCopyOperations.getRecipeById.mockResolvedValue({
				id: 1,
				name: 'Test Recipe',
				prepTime: null,
				cookTime: null,
				description: null,
				duplicate: 0,
				season_id: null,
				primaryType_id: null,
				secondaryType_id: null,
				public: 0,
				url_slug: 'test',
				image_filename: null,
				pdf_filename: null,
				household_id: 1,
				parent_id: null,
			});

			await copyRecipeForEdit(1, 1);

			expect(mockPool.getConnection).toHaveBeenCalled();
			expect(mockConnection.beginTransaction).toHaveBeenCalled();
			expect(mockConnection.commit).toHaveBeenCalled();
			expect(mockConnection.release).toHaveBeenCalled();
		});

		it('should handle rollback correctly on error', async () => {
			mockCopyOperations.getRecipeById.mockRejectedValue(new Error('Test error'));

			await expect(copyRecipeForEdit(1, 1)).rejects.toThrow('Test error');

			expect(mockConnection.beginTransaction).toHaveBeenCalled();
			expect(mockConnection.rollback).toHaveBeenCalled();
			expect(mockConnection.release).toHaveBeenCalled();
			expect(mockConnection.commit).not.toHaveBeenCalled();
		});
	});

	describe('Edge Cases', () => {
		it('should handle null/undefined values gracefully', async () => {
			const recipeWithNulls = {
				id: 1,
				name: 'Test Recipe',
				prepTime: null,
				cookTime: null,
				description: null,
				duplicate: 0,
				season_id: null,
				primaryType_id: null,
				secondaryType_id: null,
				public: 0,
				url_slug: 'test',
				image_filename: null,
				pdf_filename: null,
				household_id: 2,
				parent_id: null,
			};

			mockCopyOperations.getRecipeById.mockResolvedValue(recipeWithNulls);
			mockCopyOperations.copyRecipe.mockResolvedValue(10);

			const result = await copyRecipeForEdit(1, 1);

			expect(result).toEqual({ copied: true, newId: 10 });
			expect(mockCopyOperations.copyRecipe).toHaveBeenCalledWith(mockConnection, recipeWithNulls, 1);
		});
	});
});
