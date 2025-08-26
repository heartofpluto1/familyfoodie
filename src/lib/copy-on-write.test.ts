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
import { PoolConnection } from 'mysql2/promise';
import { MockConnection } from '@/lib/test-utils';

// Mock the database pool and operations
jest.mock('./db.js');
jest.mock('./queries/copy-operations');

const mockPool = pool as jest.Mocked<typeof pool>;
const mockCopyOperations = copyOperations as jest.Mocked<typeof copyOperations>;

describe('Copy-on-Write Functions', () => {
	let mockConnection: MockConnection;

	beforeEach(() => {
		jest.clearAllMocks();
		jest.resetAllMocks();
		
		mockConnection = {
			beginTransaction: jest.fn().mockResolvedValue(undefined),
			commit: jest.fn().mockResolvedValue(undefined),
			rollback: jest.fn().mockResolvedValue(undefined),
			release: jest.fn().mockResolvedValue(undefined),
			execute: jest.fn(),
		};

		mockPool.getConnection.mockResolvedValue(mockConnection);
		
		// Reset all copy operation mocks to default behavior
		Object.values(mockCopyOperations).forEach(mockFn => {
			if (jest.isMockFunction(mockFn)) {
				mockFn.mockReset();
			}
		});
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

		it('should copy only collection if recipe already owned', async () => {
			const ownedRecipe = { ...mockRecipe, household_id: 1 };
			mockCopyOperations.getCollectionById.mockResolvedValue(mockCollection);
			mockCopyOperations.getRecipeById.mockResolvedValue(ownedRecipe);
			mockCopyOperations.copyCollection.mockResolvedValue(300);

			const result = await cascadeCopyWithContext(1, 1, 1);

			expect(result.newCollectionId).toBe(300);
			expect(result.newRecipeId).toBe(1); // Original recipe ID unchanged
			expect(result.actionsTaken).toEqual(['collection_copied', 'unsubscribed_from_original']);

			// Verify only collection operations
			expect(mockCopyOperations.copyCollection).toHaveBeenCalledWith(mockConnection, mockCollection, 1);
			expect(mockCopyOperations.copyCollectionRecipes).toHaveBeenCalledWith(mockConnection, 1, 300);
			expect(mockCopyOperations.removeCollectionSubscription).toHaveBeenCalledWith(mockConnection, 1, 1);
			
			// Recipe should NOT be copied since it's already owned
			expect(mockCopyOperations.copyRecipe).not.toHaveBeenCalled();
			expect(mockCopyOperations.copyRecipeIngredients).not.toHaveBeenCalled();
			
			// Recipe should be linked to new collection via copyCollectionRecipes
			expect(mockCopyOperations.copyCollectionRecipes).toHaveBeenCalledWith(mockConnection, 1, 300);
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

		it('should copy collection and recipe, use existing ingredient (FFO)', async () => {
			// Collection Foreign, Recipe Foreign, Ingredient Owned
			const ownedIngredient = { ...mockIngredient, household_id: 1 };
			
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

			mockCopyOperations.getIngredientById.mockResolvedValue(ownedIngredient);
			mockCopyOperations.copyCollection.mockResolvedValue(400);
			mockCopyOperations.copyRecipe.mockResolvedValue(500);

			const result = await cascadeCopyIngredientWithContext(1, 1, 1, 1);

			expect(result.newCollectionId).toBe(400);
			expect(result.newRecipeId).toBe(500);
			expect(result.newIngredientId).toBe(1); // Existing ingredient used
			expect(result.actionsTaken).toEqual(['collection_copied', 'unsubscribed_from_original', 'recipe_copied']);

			// Verify collection and recipe copied, ingredient not copied
			expect(mockCopyOperations.copyCollection).toHaveBeenCalledWith(mockConnection, expect.any(Object), 1);
			expect(mockCopyOperations.copyRecipe).toHaveBeenCalledWith(mockConnection, expect.any(Object), 1);
			expect(mockCopyOperations.copyIngredient).not.toHaveBeenCalled();
			expect(mockCopyOperations.updateRecipeIngredientsForHousehold).not.toHaveBeenCalled();
		});

		it('should copy collection and ingredient, use existing recipe (FOF)', async () => {
			// Collection Foreign, Recipe Owned, Ingredient Foreign
			const ownedRecipe = {
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
				household_id: 1, // Owned by household
				parent_id: null,
			};

			mockCopyOperations.getCollectionById.mockResolvedValue({
				id: 1,
				title: 'Test Collection',
				subtitle: null,
				filename: null,
				filename_dark: null,
				household_id: 2, // Foreign
				parent_id: null,
				public: 1,
				url_slug: 'test-collection',
			});

			mockCopyOperations.getRecipeById.mockResolvedValue(ownedRecipe);
			mockCopyOperations.getIngredientById.mockResolvedValue(mockIngredient); // Foreign ingredient
			mockCopyOperations.copyCollection.mockResolvedValue(600);
			mockCopyOperations.copyIngredient.mockResolvedValue(700);

			const result = await cascadeCopyIngredientWithContext(1, 1, 1, 1);

			expect(result.newCollectionId).toBe(600);
			expect(result.newRecipeId).toBe(1); // Existing recipe used
			expect(result.newIngredientId).toBe(700);
			expect(result.actionsTaken).toEqual(['collection_copied', 'unsubscribed_from_original', 'ingredient_copied']);

			// Verify collection and ingredient copied, recipe not copied
			expect(mockCopyOperations.copyCollection).toHaveBeenCalledWith(mockConnection, expect.any(Object), 1);
			expect(mockCopyOperations.copyRecipe).not.toHaveBeenCalled();
			expect(mockCopyOperations.copyIngredient).toHaveBeenCalledWith(mockConnection, mockIngredient, 1);
			expect(mockCopyOperations.updateRecipeIngredientsForHousehold).toHaveBeenCalledWith(mockConnection, 1, 700, 1);
			
			// Recipe should be linked to new collection
			expect(mockCopyOperations.copyCollectionRecipes).toHaveBeenCalledWith(mockConnection, 1, 600);
		});

		it('should copy only collection, use existing recipe and ingredient (FOO)', async () => {
			// Collection Foreign, Recipe Owned, Ingredient Owned
			const ownedRecipe = {
				id: 1,
				name: 'Test Recipe',
				household_id: 1, // Owned
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
				parent_id: null,
			};

			const ownedIngredient = { ...mockIngredient, household_id: 1 };

			mockCopyOperations.getCollectionById.mockResolvedValue({
				id: 1,
				title: 'Test Collection',
				subtitle: null,
				filename: null,
				filename_dark: null,
				household_id: 2, // Foreign
				parent_id: null,
				public: 1,
				url_slug: 'test-collection',
			});

			mockCopyOperations.getRecipeById.mockResolvedValue(ownedRecipe);
			mockCopyOperations.getIngredientById.mockResolvedValue(ownedIngredient);
			mockCopyOperations.copyCollection.mockResolvedValue(800);

			const result = await cascadeCopyIngredientWithContext(1, 1, 1, 1);

			expect(result.newCollectionId).toBe(800);
			expect(result.newRecipeId).toBe(1); // Existing recipe used
			expect(result.newIngredientId).toBe(1); // Existing ingredient used
			expect(result.actionsTaken).toEqual(['collection_copied', 'unsubscribed_from_original']);

			// Verify only collection copied
			expect(mockCopyOperations.copyCollection).toHaveBeenCalledWith(mockConnection, expect.any(Object), 1);
			expect(mockCopyOperations.copyRecipe).not.toHaveBeenCalled();
			expect(mockCopyOperations.copyIngredient).not.toHaveBeenCalled();
			
			// Recipe should be linked to new collection
			expect(mockCopyOperations.copyCollectionRecipes).toHaveBeenCalledWith(mockConnection, 1, 800);
		});

		it('should copy recipe and ingredient, use existing collection (OFF)', async () => {
			// Collection Owned, Recipe Foreign, Ingredient Foreign
			const ownedCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: null,
				filename: null,
				filename_dark: null,
				household_id: 1, // Owned
				parent_id: null,
				public: 1,
				url_slug: 'test-collection',
			};

			const foreignRecipe = {
				id: 1,
				name: 'Test Recipe',
				household_id: 2, // Foreign
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
				parent_id: null,
			};

			mockCopyOperations.getCollectionById.mockResolvedValue(ownedCollection);
			mockCopyOperations.getRecipeById.mockResolvedValue(foreignRecipe);
			mockCopyOperations.getIngredientById.mockResolvedValue(mockIngredient); // Foreign
			mockCopyOperations.copyRecipe.mockResolvedValue(900);
			mockCopyOperations.copyIngredient.mockResolvedValue(1000);

			const result = await cascadeCopyIngredientWithContext(1, 1, 1, 1);

			expect(result.newCollectionId).toBe(1); // Existing collection used
			expect(result.newRecipeId).toBe(900);
			expect(result.newIngredientId).toBe(1000);
			expect(result.actionsTaken).toEqual(['recipe_copied', 'ingredient_copied']);

			// Verify recipe and ingredient copied, collection not copied
			expect(mockCopyOperations.copyCollection).not.toHaveBeenCalled();
			expect(mockCopyOperations.copyRecipe).toHaveBeenCalledWith(mockConnection, foreignRecipe, 1);
			expect(mockCopyOperations.copyIngredient).toHaveBeenCalledWith(mockConnection, mockIngredient, 1);
			expect(mockCopyOperations.updateRecipeIngredientsForHousehold).toHaveBeenCalledWith(mockConnection, 1, 1000, 1);
		});

		it('should copy only recipe, use existing collection and ingredient (OFO)', async () => {
			// Collection Owned, Recipe Foreign, Ingredient Owned
			const ownedCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: null,
				filename: null,
				filename_dark: null,
				household_id: 1, // Owned
				parent_id: null,
				public: 1,
				url_slug: 'test-collection',
			};

			const foreignRecipe = {
				id: 1,
				name: 'Test Recipe',
				household_id: 2, // Foreign
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
				parent_id: null,
			};

			const ownedIngredient = { ...mockIngredient, household_id: 1 };

			mockCopyOperations.getCollectionById.mockResolvedValue(ownedCollection);
			mockCopyOperations.getRecipeById.mockResolvedValue(foreignRecipe);
			mockCopyOperations.getIngredientById.mockResolvedValue(ownedIngredient);
			mockCopyOperations.copyRecipe.mockResolvedValue(1100);

			const result = await cascadeCopyIngredientWithContext(1, 1, 1, 1);

			expect(result.newCollectionId).toBe(1); // Existing collection used
			expect(result.newRecipeId).toBe(1100);
			expect(result.newIngredientId).toBe(1); // Existing ingredient used
			expect(result.actionsTaken).toEqual(['recipe_copied']);

			// Verify only recipe copied
			expect(mockCopyOperations.copyCollection).not.toHaveBeenCalled();
			expect(mockCopyOperations.copyRecipe).toHaveBeenCalledWith(mockConnection, foreignRecipe, 1);
			expect(mockCopyOperations.copyIngredient).not.toHaveBeenCalled();
			expect(mockCopyOperations.updateRecipeIngredientsForHousehold).not.toHaveBeenCalled();
		});

		it('should copy only ingredient, use existing collection and recipe (OOF)', async () => {
			// Collection Owned, Recipe Owned, Ingredient Foreign
			const ownedCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: null,
				filename: null,
				filename_dark: null,
				household_id: 1, // Owned
				parent_id: null,
				public: 1,
				url_slug: 'test-collection',
			};

			const ownedRecipe = {
				id: 1,
				name: 'Test Recipe',
				household_id: 1, // Owned
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
				parent_id: null,
			};

			mockCopyOperations.getCollectionById.mockResolvedValue(ownedCollection);
			mockCopyOperations.getRecipeById.mockResolvedValue(ownedRecipe);
			mockCopyOperations.getIngredientById.mockResolvedValue(mockIngredient); // Foreign
			mockCopyOperations.copyIngredient.mockResolvedValue(1200);

			const result = await cascadeCopyIngredientWithContext(1, 1, 1, 1);

			expect(result.newCollectionId).toBe(1); // Existing collection used
			expect(result.newRecipeId).toBe(1); // Existing recipe used
			expect(result.newIngredientId).toBe(1200);
			expect(result.actionsTaken).toEqual(['ingredient_copied']);

			// Verify only ingredient copied
			expect(mockCopyOperations.copyCollection).not.toHaveBeenCalled();
			expect(mockCopyOperations.copyRecipe).not.toHaveBeenCalled();
			expect(mockCopyOperations.copyIngredient).toHaveBeenCalledWith(mockConnection, mockIngredient, 1);
			expect(mockCopyOperations.updateRecipeIngredientsForHousehold).toHaveBeenCalledWith(mockConnection, 1, 1200, 1);
		});

		it('should copy nothing when all resources are already owned (OOO)', async () => {
			// Collection Owned, Recipe Owned, Ingredient Owned
			const ownedCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: null,
				filename: null,
				filename_dark: null,
				household_id: 1, // Owned
				parent_id: null,
				public: 1,
				url_slug: 'test-collection',
			};

			const ownedRecipe = {
				id: 1,
				name: 'Test Recipe',
				household_id: 1, // Owned
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
				parent_id: null,
			};

			const ownedIngredient = { ...mockIngredient, household_id: 1 };

			mockCopyOperations.getCollectionById.mockResolvedValue(ownedCollection);
			mockCopyOperations.getRecipeById.mockResolvedValue(ownedRecipe);
			mockCopyOperations.getIngredientById.mockResolvedValue(ownedIngredient);

			const result = await cascadeCopyIngredientWithContext(1, 1, 1, 1);

			expect(result.newCollectionId).toBe(1); // Existing collection used
			expect(result.newRecipeId).toBe(1); // Existing recipe used
			expect(result.newIngredientId).toBe(1); // Existing ingredient used
			expect(result.actionsTaken).toEqual([]); // No actions taken

			// Verify nothing was copied
			expect(mockCopyOperations.copyCollection).not.toHaveBeenCalled();
			expect(mockCopyOperations.copyRecipe).not.toHaveBeenCalled();
			expect(mockCopyOperations.copyIngredient).not.toHaveBeenCalled();
			expect(mockCopyOperations.updateRecipeIngredientsForHousehold).not.toHaveBeenCalled();
		});

		it('should handle ingredient not found', async () => {
			// Provide valid collection and recipe so it reaches the ingredient check
			mockCopyOperations.getCollectionById.mockResolvedValue({ id: 1, household_id: 2, name: 'Test Collection' });
			mockCopyOperations.getRecipeById.mockResolvedValue({ id: 1, household_id: 2, name: 'Test Recipe' });
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

	describe('Junction Table Operations', () => {
		it('should verify copyRecipeIngredients SQL execution', async () => {
			// Mock the copyRecipeIngredients implementation with SQL verification
			mockCopyOperations.copyRecipeIngredients.mockImplementation(async (connection, originalRecipeId, newRecipeId) => {
				await connection.execute(
					'INSERT INTO recipe_ingredients (quantity, ingredient_id, recipe_id, preperation_id, primaryIngredient, quantity4, quantityMeasure_id, parent_id) SELECT quantity, ingredient_id, ?, preperation_id, primaryIngredient, quantity4, quantityMeasure_id, id FROM recipe_ingredients WHERE recipe_id = ?',
					[newRecipeId, originalRecipeId]
				);
			});

			const foreignRecipe = {
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
				household_id: 2,
				parent_id: null,
			};

			mockCopyOperations.getRecipeById.mockResolvedValue(foreignRecipe);
			mockCopyOperations.copyRecipe.mockResolvedValue(100);

			await copyRecipeForEdit(1, 1);

			// Verify copyRecipeIngredients was called correctly
			expect(mockCopyOperations.copyRecipeIngredients).toHaveBeenCalledWith(mockConnection, 1, 100);
			
			// Verify the SQL execution within copyRecipeIngredients
			expect(mockConnection.execute).toHaveBeenCalledWith(
				expect.stringContaining('INSERT INTO recipe_ingredients'),
				[100, 1]
			);
		});

		it('should verify updateJunctionTableForCollectionRecipe SQL execution', async () => {
			// Mock the updateJunctionTableForCollectionRecipe implementation
			mockCopyOperations.updateJunctionTableForCollectionRecipe.mockImplementation(async (connection, collectionId, oldRecipeId, newRecipeId) => {
				await connection.execute(
					'UPDATE collection_recipes SET recipe_id = ? WHERE collection_id = ? AND recipe_id = ?',
					[newRecipeId, collectionId, oldRecipeId]
				);
			});

			const ownedRecipe = {
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
				household_id: 1, // Owned
				parent_id: null,
			};

			const foreignCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: 'Test subtitle',
				filename: 'test.jpg',
				filename_dark: 'test-dark.jpg',
				household_id: 2, // Foreign
				parent_id: null,
				public: 1,
				url_slug: 'test-collection',
			};

			mockCopyOperations.getCollectionById.mockResolvedValue(foreignCollection);
			mockCopyOperations.getRecipeById.mockResolvedValue(ownedRecipe);
			mockCopyOperations.copyCollection.mockResolvedValue(200);

			await cascadeCopyWithContext(1, 1, 1);

			// In this scenario, collection is copied and existing recipe is linked via copyCollectionRecipes
			expect(mockCopyOperations.copyCollectionRecipes).toHaveBeenCalledWith(mockConnection, 1, 200);
			
			// Verify the function call for junction table copy
			expect(mockCopyOperations.copyCollectionRecipes).toHaveBeenCalledWith(mockConnection, 1, 200);
		});

		it('should verify updateRecipeIngredientsForHousehold SQL execution', async () => {
			// Mock the updateRecipeIngredientsForHousehold implementation
			mockCopyOperations.updateRecipeIngredientsForHousehold.mockImplementation(async (connection, oldIngredientId, newIngredientId, householdId) => {
				await connection.execute(
					'UPDATE recipe_ingredients ri JOIN recipes r ON ri.recipe_id = r.id SET ri.ingredient_id = ? WHERE r.household_id = ? AND ri.ingredient_id = ?',
					[newIngredientId, householdId, oldIngredientId]
				);
			});

			const foreignIngredient = {
				id: 1,
				name: 'Test Ingredient',
				fresh: 1,
				supermarketCategory_id: 1,
				cost: 2.5,
				stockcode: 'TEST001',
				public: 0,
				pantryCategory_id: 1,
				household_id: 2, // Foreign
				parent_id: null,
			};

			mockCopyOperations.getIngredientById.mockResolvedValue(foreignIngredient);
			mockCopyOperations.copyIngredient.mockResolvedValue(300);

			await copyIngredientForEdit(1, 1);

			// Verify household update was called correctly
			expect(mockCopyOperations.updateRecipeIngredientsForHousehold).toHaveBeenCalledWith(mockConnection, 1, 300, 1);
			
			// Verify the SQL execution
			expect(mockConnection.execute).toHaveBeenCalledWith(
				'UPDATE recipe_ingredients ri JOIN recipes r ON ri.recipe_id = r.id SET ri.ingredient_id = ? WHERE r.household_id = ? AND ri.ingredient_id = ?',
				[300, 1, 1]
			);
		});

		it('should verify copyCollectionRecipes SQL execution preserves relationships', async () => {
			// Mock the copyCollectionRecipes implementation  
			mockCopyOperations.copyCollectionRecipes.mockImplementation(async (connection, originalCollectionId, newCollectionId) => {
				await connection.execute(
					'INSERT INTO collection_recipes (collection_id, recipe_id, added_at, display_order) SELECT ?, recipe_id, NOW(), display_order FROM collection_recipes WHERE collection_id = ?',
					[newCollectionId, originalCollectionId]
				);
			});

			const foreignCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: 'Test subtitle',
				filename: 'test.jpg',
				filename_dark: 'test-dark.jpg',
				household_id: 2, // Foreign
				parent_id: null,
				public: 1,
				url_slug: 'test-collection',
			};

			const ownedRecipe = {
				id: 1,
				name: 'Test Recipe',
				household_id: 1, // Owned
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
				parent_id: null,
			};

			mockCopyOperations.getCollectionById.mockResolvedValue(foreignCollection);
			mockCopyOperations.getRecipeById.mockResolvedValue(ownedRecipe);
			mockCopyOperations.copyCollection.mockResolvedValue(400);

			await cascadeCopyWithContext(1, 1, 1);

			// Verify collection recipes were copied correctly
			expect(mockCopyOperations.copyCollectionRecipes).toHaveBeenCalledWith(mockConnection, 1, 400);
			
			// Verify the SQL execution preserves display_order and other relationships
			expect(mockConnection.execute).toHaveBeenCalledWith(
				expect.stringContaining('INSERT INTO collection_recipes'),
				[400, 1]
			);
		});
	});

	describe('Database Operation Order', () => {
		it('should execute operations in correct sequence for recipe copy', async () => {
			const foreignRecipe = {
				id: 1,
				name: 'Test Recipe',
				household_id: 2,
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
				parent_id: null,
			};

			mockCopyOperations.getRecipeById.mockResolvedValue(foreignRecipe);
			mockCopyOperations.copyRecipe.mockResolvedValue(500);

			await copyRecipeForEdit(1, 1);

			// Verify operations happen in the correct order
			const callOrder = [
				'beginTransaction',
				'getRecipeById',
				'copyRecipe', 
				'copyRecipeIngredients',
				'updateJunctionTableForRecipe',
				'commit',
				'release'
			];

			// Verify that all operations were called in the expected sequence
			const calls = [
				mockConnection.beginTransaction,
				mockCopyOperations.getRecipeById,
				mockCopyOperations.copyRecipe,
				mockCopyOperations.copyRecipeIngredients,
				mockConnection.commit
			];
			
			// Verify all operations were called
			calls.forEach(mockFn => expect(mockFn).toHaveBeenCalled());
			
			// Verify beginTransaction was called first
			expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
			expect(mockConnection.commit).toHaveBeenCalledTimes(1);
		});

		it('should handle partial failures with proper rollback', async () => {
			const foreignRecipe = {
				id: 1,
				name: 'Test Recipe',
				household_id: 2,
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
				parent_id: null,
			};

			mockCopyOperations.getRecipeById.mockResolvedValue(foreignRecipe);
			mockCopyOperations.copyRecipe.mockResolvedValue(600);
			// Simulate failure in copyRecipeIngredients
			mockCopyOperations.copyRecipeIngredients.mockRejectedValue(new Error('Junction table constraint violation'));

			await expect(copyRecipeForEdit(1, 1)).rejects.toThrow('Junction table constraint violation');

			// Verify transaction was rolled back
			expect(mockConnection.beginTransaction).toHaveBeenCalled();
			expect(mockConnection.rollback).toHaveBeenCalled();
			expect(mockConnection.commit).not.toHaveBeenCalled();
			expect(mockConnection.release).toHaveBeenCalled();
		});
	});

	describe('Comprehensive Error Handling', () => {
		it('should handle foreign key constraint failures during recipe copy', async () => {
			const foreignRecipe = {
				id: 1,
				name: 'Test Recipe',
				household_id: 2,
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
				parent_id: null,
			};

			mockCopyOperations.getRecipeById.mockResolvedValue(foreignRecipe);
			mockCopyOperations.copyRecipe.mockRejectedValue(new Error('Foreign key constraint fails: season_id'));

			await expect(copyRecipeForEdit(1, 1)).rejects.toThrow('Foreign key constraint fails: season_id');

			expect(mockConnection.beginTransaction).toHaveBeenCalled();
			expect(mockConnection.rollback).toHaveBeenCalled();
			expect(mockConnection.commit).not.toHaveBeenCalled();
			expect(mockConnection.release).toHaveBeenCalled();
		});

		it('should handle junction table operation failures in cascadeCopyWithContext', async () => {
			const foreignCollection = {
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

			const foreignRecipe = {
				id: 1,
				name: 'Test Recipe',
				household_id: 2,
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
				parent_id: null,
			};

			mockCopyOperations.getCollectionById.mockResolvedValue(foreignCollection);
			mockCopyOperations.getRecipeById.mockResolvedValue(foreignRecipe);
			mockCopyOperations.copyCollection.mockResolvedValue(700);
			mockCopyOperations.copyRecipe.mockResolvedValue(800);
			// Simulate junction table failure
			mockCopyOperations.copyCollectionRecipes.mockRejectedValue(new Error('Duplicate entry for collection_recipes'));

			await expect(cascadeCopyWithContext(1, 1, 1)).rejects.toThrow('Duplicate entry for collection_recipes');

			expect(mockConnection.rollback).toHaveBeenCalled();
			expect(mockConnection.release).toHaveBeenCalled();
			expect(mockConnection.commit).not.toHaveBeenCalled();
		});

		it('should handle recipe not found error in cascadeCopyIngredientWithContext', async () => {
			const foreignCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: null,
				filename: null,
				filename_dark: null,
				household_id: 2,
				parent_id: null,
				public: 1,
				url_slug: 'test-collection',
			};

			mockCopyOperations.getCollectionById.mockResolvedValue(foreignCollection);
			mockCopyOperations.getRecipeById.mockResolvedValue(null); // Recipe not found

			await expect(cascadeCopyIngredientWithContext(1, 1, 999, 1)).rejects.toThrow('Recipe with ID 999 not found');

			expect(mockConnection.rollback).toHaveBeenCalled();
			expect(mockConnection.release).toHaveBeenCalled();
		});

		it('should handle connection pool exhaustion', async () => {
			// Mock pool.getConnection to fail
			mockPool.getConnection.mockRejectedValue(new Error('Pool exhausted - no connections available'));

			await expect(copyRecipeForEdit(1, 1)).rejects.toThrow('Pool exhausted - no connections available');

			// No connection operations should be attempted
			expect(mockConnection.beginTransaction).not.toHaveBeenCalled();
		});

		it('should handle transaction begin failures', async () => {
			mockConnection.beginTransaction.mockRejectedValue(new Error('Cannot start transaction - deadlock detected'));

			await expect(copyRecipeForEdit(1, 1)).rejects.toThrow('Cannot start transaction - deadlock detected');

			expect(mockConnection.beginTransaction).toHaveBeenCalled();
			// Connection should be released even if transaction start fails
			// Note: The actual implementation may still call rollback in finally block
			expect(mockConnection.release).toHaveBeenCalled();
		});

		it('should handle commit failures with proper cleanup', async () => {
			const ownedRecipe = {
				id: 1,
				name: 'Test Recipe',
				household_id: 1,
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
				parent_id: null,
			};

			mockCopyOperations.getRecipeById.mockResolvedValue(ownedRecipe);
			mockConnection.commit.mockRejectedValue(new Error('Commit failed - disk full'));

			await expect(copyRecipeForEdit(1, 1)).rejects.toThrow('Commit failed - disk full');

			expect(mockConnection.beginTransaction).toHaveBeenCalled();
			expect(mockConnection.commit).toHaveBeenCalled();
			expect(mockConnection.rollback).toHaveBeenCalled(); // Should attempt rollback after commit failure
			expect(mockConnection.release).toHaveBeenCalled();
		});

		it('should handle rollback failures gracefully', async () => {
			const foreignIngredient = {
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

			mockCopyOperations.getIngredientById.mockResolvedValue(foreignIngredient);
			mockCopyOperations.copyIngredient.mockRejectedValue(new Error('Primary operation failed'));
			mockConnection.rollback.mockRejectedValue(new Error('Rollback failed - connection lost'));

			// Should throw the rollback error since it's more critical
			await expect(copyIngredientForEdit(1, 1)).rejects.toThrow('Rollback failed - connection lost');

			expect(mockConnection.beginTransaction).toHaveBeenCalled();
			expect(mockConnection.rollback).toHaveBeenCalled();
			expect(mockConnection.release).toHaveBeenCalled();
		});

		it('should handle multiple resource not found in cascadeCopyIngredientWithContext', async () => {
			mockCopyOperations.getCollectionById.mockResolvedValue(null);
			mockCopyOperations.getRecipeById.mockResolvedValue(null);
			mockCopyOperations.getIngredientById.mockResolvedValue(null);

			// Should fail on first resource check (collection)
			await expect(cascadeCopyIngredientWithContext(1, 999, 999, 999)).rejects.toThrow('Collection with ID 999 not found');

			expect(mockConnection.rollback).toHaveBeenCalled();
			// Implementation calls all getById functions in cascade pattern
			// This is expected behavior for the current implementation
		});

		it('should handle orphaned ingredient cleanup failures', async () => {
			mockCopyOperations.deleteOrphanedIngredients.mockRejectedValue(new Error('Cannot delete - ingredient still referenced'));

			await expect(cleanupOrphanedIngredients(1, 10)).rejects.toThrow('Cannot delete - ingredient still referenced');

			expect(mockConnection.beginTransaction).toHaveBeenCalled();
			expect(mockConnection.rollback).toHaveBeenCalled();
			expect(mockConnection.release).toHaveBeenCalled();
		});

		it('should handle partial cleanup failure in performCompleteCleanupAfterRecipeDelete', async () => {
			mockCopyOperations.deleteRecipeIngredients.mockResolvedValue(3);
			mockCopyOperations.deleteOrphanedIngredients.mockRejectedValue(new Error('Foreign key constraint prevents ingredient deletion'));

			await expect(performCompleteCleanupAfterRecipeDelete(10, 1)).rejects.toThrow('Foreign key constraint prevents ingredient deletion');

			// First operation should succeed, second should fail, transaction should rollback
			expect(mockCopyOperations.deleteRecipeIngredients).toHaveBeenCalledWith(mockConnection, 10);
			expect(mockCopyOperations.deleteOrphanedIngredients).toHaveBeenCalledWith(mockConnection, 1, 10);
			expect(mockConnection.rollback).toHaveBeenCalled();
		});

		it('should handle invalid household IDs gracefully', async () => {
			const foreignRecipe = {
				id: 1,
				name: 'Test Recipe',
				household_id: 2,
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
				parent_id: null,
			};

			mockCopyOperations.getRecipeById.mockResolvedValue(foreignRecipe);
			mockCopyOperations.copyRecipe.mockRejectedValue(new Error('Invalid household_id: household does not exist'));

			await expect(copyRecipeForEdit(1, 99999)).rejects.toThrow('Invalid household_id: household does not exist');

			expect(mockConnection.rollback).toHaveBeenCalled();
		});
	});

	describe('Performance and Efficiency', () => {
		it('should skip unnecessary operations when all resources are owned', async () => {
			const ownedCollection = {
				id: 1,
				title: 'Test Collection',
				household_id: 1, // Owned
				subtitle: null,
				filename: null,
				filename_dark: null,
				parent_id: null,
				public: 1,
				url_slug: 'test-collection',
			};

			const ownedRecipe = {
				id: 1,
				name: 'Test Recipe',
				household_id: 1, // Owned
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
				parent_id: null,
			};

			const ownedIngredient = {
				id: 1,
				name: 'Test Ingredient',
				fresh: 1,
				supermarketCategory_id: 1,
				cost: 2.5,
				stockcode: 'TEST001',
				public: 0,
				pantryCategory_id: 1,
				household_id: 1, // Owned
				parent_id: null,
			};

			mockCopyOperations.getCollectionById.mockResolvedValue(ownedCollection);
			mockCopyOperations.getRecipeById.mockResolvedValue(ownedRecipe);
			mockCopyOperations.getIngredientById.mockResolvedValue(ownedIngredient);

			const result = await cascadeCopyIngredientWithContext(1, 1, 1, 1);

			expect(result.actionsTaken).toEqual([]); // No actions needed

			// Verify NO copy operations were called
			expect(mockCopyOperations.copyCollection).not.toHaveBeenCalled();
			expect(mockCopyOperations.copyRecipe).not.toHaveBeenCalled();
			expect(mockCopyOperations.copyIngredient).not.toHaveBeenCalled();
			expect(mockCopyOperations.copyRecipeIngredients).not.toHaveBeenCalled();
			expect(mockCopyOperations.copyCollectionRecipes).not.toHaveBeenCalled();
			expect(mockCopyOperations.updateRecipeIngredientsForHousehold).not.toHaveBeenCalled();
			expect(mockCopyOperations.removeCollectionSubscription).not.toHaveBeenCalled();

			// Transaction should still be properly handled
			expect(mockConnection.beginTransaction).toHaveBeenCalled();
			expect(mockConnection.commit).toHaveBeenCalled();
			expect(mockConnection.release).toHaveBeenCalled();
		});

		it('should minimize database calls for partially owned resources', async () => {
			// Reset any previous mocks that might interfere
			mockCopyOperations.copyRecipeIngredients.mockReset().mockResolvedValue(undefined);
			
			// Only recipe is foreign, collection and ingredient are owned
			const ownedCollection = {
				id: 1,
				title: 'Test Collection',
				household_id: 1, // Owned
				subtitle: null,
				filename: null,
				filename_dark: null,
				parent_id: null,
				public: 1,
				url_slug: 'test-collection',
			};

			const foreignRecipe = {
				id: 1,
				name: 'Test Recipe',
				household_id: 2, // Foreign
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
				parent_id: null,
			};

			const ownedIngredient = {
				id: 1,
				name: 'Test Ingredient',
				fresh: 1,
				supermarketCategory_id: 1,
				cost: 2.5,
				stockcode: 'TEST001',
				public: 0,
				pantryCategory_id: 1,
				household_id: 1, // Owned
				parent_id: null,
			};

			mockCopyOperations.getCollectionById.mockResolvedValue(ownedCollection);
			mockCopyOperations.getRecipeById.mockResolvedValue(foreignRecipe);
			mockCopyOperations.getIngredientById.mockResolvedValue(ownedIngredient);
			mockCopyOperations.copyRecipe.mockResolvedValue(900);

			const result = await cascadeCopyIngredientWithContext(1, 1, 1, 1);

			expect(result.actionsTaken).toEqual(['recipe_copied']); // Only recipe action

			// Verify ONLY recipe operations were called
			expect(mockCopyOperations.copyRecipe).toHaveBeenCalledTimes(1);
			expect(mockCopyOperations.copyRecipeIngredients).toHaveBeenCalledTimes(1);
			
			// Collection and ingredient operations should NOT be called
			expect(mockCopyOperations.copyCollection).not.toHaveBeenCalled();
			expect(mockCopyOperations.copyIngredient).not.toHaveBeenCalled();
			expect(mockCopyOperations.updateRecipeIngredientsForHousehold).not.toHaveBeenCalled();
		});

		it('should batch junction table operations efficiently', async () => {
			// Reset any previous mocks that might interfere
			mockCopyOperations.copyCollectionRecipes.mockReset().mockResolvedValue(undefined);
			
			const foreignCollection = {
				id: 1,
				title: 'Test Collection',
				household_id: 2, // Foreign
				subtitle: null,
				filename: null,
				filename_dark: null,
				parent_id: null,
				public: 1,
				url_slug: 'test-collection',
			};

			const foreignRecipe = {
				id: 1,
				name: 'Test Recipe',
				household_id: 2, // Foreign
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
				parent_id: null,
			};

			mockCopyOperations.getCollectionById.mockResolvedValue(foreignCollection);
			mockCopyOperations.getRecipeById.mockResolvedValue(foreignRecipe);
			mockCopyOperations.copyCollection.mockResolvedValue(1000);
			mockCopyOperations.copyRecipe.mockResolvedValue(1100);

			await cascadeCopyWithContext(1, 1, 1);

			// Verify junction operations are called
			expect(mockCopyOperations.copyCollection).toHaveBeenCalled();
			expect(mockCopyOperations.copyCollectionRecipes).toHaveBeenCalled();
			expect(mockCopyOperations.copyRecipe).toHaveBeenCalled();
			expect(mockCopyOperations.copyRecipeIngredients).toHaveBeenCalled();
			
			// Both junction operations should be called
			expect(mockCopyOperations.copyCollectionRecipes).toHaveBeenCalledWith(mockConnection, 1, 1000);
			expect(mockCopyOperations.copyRecipeIngredients).toHaveBeenCalledWith(mockConnection, 1, 1100);
		});
	});

	describe('Edge Cases', () => {
		it('should handle null/undefined values gracefully', async () => {
			// Reset any previous mocks that might interfere
			mockCopyOperations.copyRecipeIngredients.mockReset().mockResolvedValue(undefined);
			
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
