import {
	getRecipeById,
	getCollectionById,
	getIngredientById,
	copyRecipe,
	copyRecipeIngredients,
	copyCollection,
	copyCollectionRecipes,
	copyIngredient,
	updateJunctionTableForRecipe,
	updateJunctionTableForCollectionRecipe,
	updateRecipeIngredientsForHousehold,
	removeCollectionSubscription,
	deleteOrphanedIngredients,
	deleteRecipeIngredients,
} from './copy-operations';

describe('Copy Operations Database Queries', () => {
	let mockConnection: jest.Mocked<PoolConnection>;

	beforeEach(() => {
		mockConnection = {
			execute: jest.fn(),
		};
		jest.clearAllMocks();
	});

	describe('getRecipeById', () => {
		it('should return recipe when found', async () => {
			const mockRecipe = {
				id: 1,
				name: 'Test Recipe',
				prepTime: 30,
				cookTime: 45,
				description: 'Test description',
				archived: 0,
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

			mockConnection.execute.mockResolvedValue([[mockRecipe]]);

			const result = await getRecipeById(mockConnection, 1);

			expect(result).toEqual(mockRecipe);
			expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT id, name, prepTime'), [1]);
		});

		it('should return null when recipe not found', async () => {
			mockConnection.execute.mockResolvedValue([[]]);

			const result = await getRecipeById(mockConnection, 999);

			expect(result).toBeNull();
		});
	});

	describe('getCollectionById', () => {
		it('should return collection when found', async () => {
			const mockCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: 'Test subtitle',
				filename: 'test.jpg',
				filename_dark: 'test-dark.jpg',
				household_id: 1,
				parent_id: null,
				public: 1,
				url_slug: 'test-collection',
			};

			mockConnection.execute.mockResolvedValue([[mockCollection]]);

			const result = await getCollectionById(mockConnection, 1);

			expect(result).toEqual(mockCollection);
			expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT id, title, subtitle'), [1]);
		});

		it('should return null when collection not found', async () => {
			mockConnection.execute.mockResolvedValue([[]]);

			const result = await getCollectionById(mockConnection, 999);

			expect(result).toBeNull();
		});
	});

	describe('getIngredientById', () => {
		it('should return ingredient when found', async () => {
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

			mockConnection.execute.mockResolvedValue([[mockIngredient]]);

			const result = await getIngredientById(mockConnection, 1);

			expect(result).toEqual(mockIngredient);
			expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT id, name, fresh'), [1]);
		});

		it('should return null when ingredient not found', async () => {
			mockConnection.execute.mockResolvedValue([[]]);

			const result = await getIngredientById(mockConnection, 999);

			expect(result).toBeNull();
		});
	});

	describe('copyRecipe', () => {
		it('should copy recipe and return new ID', async () => {
			const mockRecipe = {
				id: 1,
				name: 'Test Recipe',
				prepTime: 30,
				cookTime: 45,
				description: 'Test description',
				archived: 0,
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

			mockConnection.execute.mockResolvedValue([{ insertId: 10 }]);

			const result = await copyRecipe(mockConnection, mockRecipe, 2);

			expect(result).toBe(10);
			expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO recipes'), [
				mockRecipe.name,
				mockRecipe.prepTime,
				mockRecipe.cookTime,
				mockRecipe.description,
				mockRecipe.archived,
				mockRecipe.season_id,
				mockRecipe.primaryType_id,
				mockRecipe.secondaryType_id,
				mockRecipe.public,
				mockRecipe.url_slug,
				mockRecipe.image_filename,
				mockRecipe.pdf_filename,
				2, // new household_id
				mockRecipe.id, // parent_id
			]);
		});
	});

	describe('copyRecipeIngredients', () => {
		it('should copy all recipe ingredients', async () => {
			mockConnection.execute.mockResolvedValue([{ affectedRows: 3 }]);

			await copyRecipeIngredients(mockConnection, 1, 10);

			expect(mockConnection.execute).toHaveBeenCalledWith(
				expect.stringContaining('INSERT INTO recipe_ingredients'),
				[10, 1] // new recipe id, original recipe id
			);
		});
	});

	describe('copyCollection', () => {
		it('should copy collection and return new ID', async () => {
			const mockCollection = {
				id: 1,
				title: 'Test Collection',
				subtitle: 'Test subtitle',
				filename: 'test.jpg',
				filename_dark: 'test-dark.jpg',
				household_id: 1,
				parent_id: null,
				public: 1,
				url_slug: 'test-collection',
			};

			mockConnection.execute.mockResolvedValue([{ insertId: 20 }]);

			const result = await copyCollection(mockConnection, mockCollection, 2);

			expect(result).toBe(20);
			expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO collections'), [
				`${mockCollection.title} (Copy)`,
				mockCollection.subtitle,
				mockCollection.filename,
				mockCollection.filename_dark,
				2, // new household_id
				mockCollection.id, // parent_id
				0, // private by default
				mockCollection.url_slug,
			]);
		});
	});

	describe('copyCollectionRecipes', () => {
		it('should copy all collection recipes', async () => {
			mockConnection.execute.mockResolvedValue([{ affectedRows: 5 }]);

			await copyCollectionRecipes(mockConnection, 1, 20);

			expect(mockConnection.execute).toHaveBeenCalledWith(
				expect.stringContaining('INSERT INTO collection_recipes'),
				[20, 1] // new collection id, original collection id
			);
		});
	});

	describe('copyIngredient', () => {
		it('should copy ingredient and return new ID', async () => {
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

			mockConnection.execute.mockResolvedValue([{ insertId: 30 }]);

			const result = await copyIngredient(mockConnection, mockIngredient, 2);

			expect(result).toBe(30);
			expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ingredients'), [
				mockIngredient.name,
				mockIngredient.fresh,
				mockIngredient.supermarketCategory_id,
				mockIngredient.cost,
				mockIngredient.stockcode,
				mockIngredient.public,
				mockIngredient.pantryCategory_id,
				2, // new household_id
				mockIngredient.id, // parent_id
			]);
		});
	});

	describe('updateJunctionTableForRecipe', () => {
		it('should update junction table for household collections', async () => {
			mockConnection.execute.mockResolvedValue([{ affectedRows: 2 }]);

			await updateJunctionTableForRecipe(mockConnection, 1, 10, 2);

			expect(mockConnection.execute).toHaveBeenCalledWith(
				expect.stringContaining('UPDATE collection_recipes cr'),
				[10, 2, 1] // new recipe id, household id, old recipe id
			);
		});
	});

	describe('updateJunctionTableForCollectionRecipe', () => {
		it('should update junction table for specific collection-recipe pair', async () => {
			mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);

			await updateJunctionTableForCollectionRecipe(mockConnection, 5, 1, 10);

			expect(mockConnection.execute).toHaveBeenCalledWith(
				expect.stringContaining('UPDATE collection_recipes'),
				[10, 5, 1] // new recipe id, collection id, old recipe id
			);
		});
	});

	describe('updateRecipeIngredientsForHousehold', () => {
		it('should update recipe ingredients for household recipes', async () => {
			mockConnection.execute.mockResolvedValue([{ affectedRows: 3 }]);

			await updateRecipeIngredientsForHousehold(mockConnection, 1, 30, 2);

			expect(mockConnection.execute).toHaveBeenCalledWith(
				expect.stringContaining('UPDATE recipe_ingredients ri'),
				[30, 2, 1] // new ingredient id, household id, old ingredient id
			);
		});
	});

	describe('removeCollectionSubscription', () => {
		it('should remove collection subscription', async () => {
			mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);

			await removeCollectionSubscription(mockConnection, 2, 1);

			expect(mockConnection.execute).toHaveBeenCalledWith(
				expect.stringContaining('DELETE FROM collection_subscriptions'),
				[2, 1] // household id, collection id
			);
		});
	});

	describe('deleteOrphanedIngredients', () => {
		it('should find and delete orphaned ingredients', async () => {
			// Mock finding orphaned ingredients
			mockConnection.execute
				.mockResolvedValueOnce([[{ id: 5 }, { id: 6 }, { id: 7 }]]) // find orphaned
				.mockResolvedValueOnce([{ affectedRows: 3 }]); // delete them

			const result = await deleteOrphanedIngredients(mockConnection, 2);

			expect(result).toEqual([5, 6, 7]);
			expect(mockConnection.execute).toHaveBeenCalledTimes(2);

			// Check the find query
			expect(mockConnection.execute).toHaveBeenNthCalledWith(1, expect.stringContaining('SELECT DISTINCT i.id'), [2, 2]);

			// Check the delete query
			expect(mockConnection.execute).toHaveBeenNthCalledWith(2, expect.stringContaining('DELETE FROM ingredients'), [5, 6, 7]);
		});

		it('should handle no orphaned ingredients', async () => {
			mockConnection.execute.mockResolvedValueOnce([[]]); // no orphaned ingredients found

			const result = await deleteOrphanedIngredients(mockConnection, 2);

			expect(result).toEqual([]);
			expect(mockConnection.execute).toHaveBeenCalledTimes(1); // only the find query
		});

		it('should exclude specific recipe when provided', async () => {
			mockConnection.execute.mockResolvedValueOnce([[{ id: 5 }]]);

			await deleteOrphanedIngredients(mockConnection, 2, 10);

			expect(mockConnection.execute).toHaveBeenCalledWith(
				expect.stringContaining('AND r.id != ?'),
				[2, 2, 10] // household id, household id, exclude recipe id
			);
		});
	});

	describe('deleteRecipeIngredients', () => {
		it('should delete recipe ingredients and return count', async () => {
			mockConnection.execute.mockResolvedValue([{ affectedRows: 5 }]);

			const result = await deleteRecipeIngredients(mockConnection, 10);

			expect(result).toBe(5);
			expect(mockConnection.execute).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM recipe_ingredients'), [10]);
		});
	});

	describe('SQL Injection Protection', () => {
		it('should use parameterized queries for all operations', async () => {
			// Test a few key functions to ensure they use parameterized queries
			mockConnection.execute.mockResolvedValue([[{ id: 1 }]]);

			await getRecipeById(mockConnection, 1);
			await getCollectionById(mockConnection, 1);
			await getIngredientById(mockConnection, 1);

			// Verify all calls used parameterized queries (second argument should be an array)
			const calls = mockConnection.execute.mock.calls;
			calls.forEach(call => {
				expect(call[1]).toBeDefined();
				expect(Array.isArray(call[1])).toBe(true);
			});
		});
	});

	describe('Error Handling', () => {
		it('should propagate database errors correctly', async () => {
			const dbError = new Error('Database connection error');
			mockConnection.execute.mockRejectedValue(dbError);

			await expect(getRecipeById(mockConnection, 1)).rejects.toThrow('Database connection error');
		});

		it('should handle constraint violation errors', async () => {
			const constraintError = new Error('Foreign key constraint fails');
			mockConnection.execute.mockRejectedValue(constraintError);

			await expect(
				copyRecipe(
					mockConnection,
					{
						id: 1,
						name: 'Test',
						prepTime: null,
						cookTime: null,
						description: null,
						archived: 0,
						season_id: null,
						primaryType_id: null,
						secondaryType_id: null,
						public: 0,
						url_slug: 'test',
						image_filename: null,
						pdf_filename: null,
						household_id: 1,
						parent_id: null,
					},
					2
				)
			).rejects.toThrow('Foreign key constraint fails');
		});
	});

	describe('Performance Considerations', () => {
		it('should use efficient queries with proper indexing hints', () => {
			// Verify that queries are structured to use indexes effectively
			mockConnection.execute.mockResolvedValue([[]]);

			getRecipeById(mockConnection, 1);

			const query = mockConnection.execute.mock.calls[0][0];
			expect(query).toContain('WHERE id = ?'); // Should use primary key
		});

		it('should batch operations where possible', async () => {
			mockConnection.execute.mockResolvedValue([{ affectedRows: 5 }]);

			await copyCollectionRecipes(mockConnection, 1, 20);

			// Should use a single INSERT with SELECT rather than multiple individual inserts
			const query = mockConnection.execute.mock.calls[0][0];
			expect(query).toContain('INSERT INTO collection_recipes');
			expect(query).toContain('SELECT');
		});
	});
});
