import {
	canEditResource,
	validateHouseholdAccess,
	canAccessRecipe,
	canAccessIngredient,
	canEditMultipleResources,
	isAdmin,
	validateRecipeInCollection,
	validateHouseholdCollectionAccess,
} from './permissions';
import pool from './db.js';
import { RowDataPacket } from 'mysql2';

// Mock the database pool
jest.mock('./db.js');
const mockPool = pool as jest.Mocked<typeof pool>;

// Mock the toast function
jest.mock('@/lib/toast', () => ({
	addToast: jest.fn(),
}));

describe('Permission System', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('canEditResource', () => {
		it('should return true for owned resources', async () => {
			mockPool.execute.mockResolvedValueOnce([[{ household_id: 1 }] as RowDataPacket[], []]);

			const result = await canEditResource(1, 'recipes', 123);

			expect(result).toBe(true);
			expect(mockPool.execute).toHaveBeenCalledWith('SELECT household_id FROM recipes WHERE id = ?', [123]);
		});

		it('should return false for resources owned by other households', async () => {
			mockPool.execute.mockResolvedValueOnce([[{ household_id: 2 }] as RowDataPacket[], []]);

			const result = await canEditResource(1, 'recipes', 123);

			expect(result).toBe(false);
		});

		it('should return false for non-existent resources', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			const result = await canEditResource(1, 'recipes', 999);

			expect(result).toBe(false);
		});

		it('should handle database errors gracefully', async () => {
			mockPool.execute.mockRejectedValueOnce(new Error('Database error'));

			const result = await canEditResource(1, 'recipes', 123);

			expect(result).toBe(false);
		});
	});

	describe('validateHouseholdAccess', () => {
		it('should return "owned" for collections owned by user household', async () => {
			const mockCollection = {
				household_id: 1,
				public: 0,
				is_subscribed: null,
			};
			mockPool.execute.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []]);

			const result = await validateHouseholdAccess(1, 123);

			expect(result).toBe('owned');
		});

		it('should return "subscribed" for subscribed collections', async () => {
			const mockCollection = {
				household_id: 2,
				public: 1,
				is_subscribed: 1,
			};
			mockPool.execute.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []]);

			const result = await validateHouseholdAccess(1, 123);

			expect(result).toBe('subscribed');
		});

		it('should return "public" for public collections', async () => {
			const mockCollection = {
				household_id: 2,
				public: 1,
				is_subscribed: null,
			};
			mockPool.execute.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []]);

			const result = await validateHouseholdAccess(1, 123);

			expect(result).toBe('public');
		});

		it('should return null for private collections without access', async () => {
			const mockCollection = {
				household_id: 2,
				public: 0,
				is_subscribed: null,
			};
			mockPool.execute.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []]);

			const result = await validateHouseholdAccess(1, 123);

			expect(result).toBeNull();
		});

		it('should return null for non-existent collections', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			const result = await validateHouseholdAccess(1, 999);

			expect(result).toBeNull();
		});
	});

	describe('canAccessRecipe', () => {
		it('should return true for owned recipes', async () => {
			const mockResult = {
				recipe_household_id: 1,
				collection_household_id: 2,
				collection_public: 0,
				is_subscribed_to_collection: null,
			};
			mockPool.execute.mockResolvedValueOnce([[mockResult] as RowDataPacket[], []]);

			const result = await canAccessRecipe(1, 123);

			expect(result).toBe(true);
		});

		it('should return true for recipes in owned collections', async () => {
			const mockResult = {
				recipe_household_id: 2,
				collection_household_id: 1,
				collection_public: 0,
				is_subscribed_to_collection: null,
			};
			mockPool.execute.mockResolvedValueOnce([[mockResult] as RowDataPacket[], []]);

			const result = await canAccessRecipe(1, 123);

			expect(result).toBe(true);
		});

		it('should return true for recipes in subscribed collections', async () => {
			const mockResult = {
				recipe_household_id: 2,
				collection_household_id: 2,
				collection_public: 0,
				is_subscribed_to_collection: 1,
			};
			mockPool.execute.mockResolvedValueOnce([[mockResult] as RowDataPacket[], []]);

			const result = await canAccessRecipe(1, 123);

			expect(result).toBe(true);
		});

		it('should return true for recipes in public collections', async () => {
			const mockResult = {
				recipe_household_id: 2,
				collection_household_id: 2,
				collection_public: 1,
				is_subscribed_to_collection: null,
			};
			mockPool.execute.mockResolvedValueOnce([[mockResult] as RowDataPacket[], []]);

			const result = await canAccessRecipe(1, 123);

			expect(result).toBe(true);
		});

		it('should return false for inaccessible recipes', async () => {
			const mockResult = {
				recipe_household_id: 2,
				collection_household_id: 2,
				collection_public: 0,
				is_subscribed_to_collection: null,
			};
			mockPool.execute.mockResolvedValueOnce([[mockResult] as RowDataPacket[], []]);

			const result = await canAccessRecipe(1, 123);

			expect(result).toBe(false);
		});

		it('should handle collection context correctly', async () => {
			const mockResult = {
				recipe_household_id: 2,
				collection_household_id: 1,
				collection_public: 0,
				is_subscribed_to_collection: null,
			};
			mockPool.execute.mockResolvedValueOnce([[mockResult] as RowDataPacket[], []]);

			const result = await canAccessRecipe(1, 123, 456);

			expect(result).toBe(true);
			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE r.id = ? AND c.id = ?'), [1, 123, 456]);
		});
	});

	describe('canAccessIngredient', () => {
		it('should return true for owned ingredients', async () => {
			const mockResult = {
				ingredient_household_id: 1,
				recipe_household_id: null,
				collection_household_id: null,
				collection_public: null,
				is_subscribed_to_collection: null,
			};
			mockPool.execute.mockResolvedValueOnce([[mockResult] as RowDataPacket[], []]);

			const result = await canAccessIngredient(1, 123);

			expect(result).toBe(true);
		});

		it('should return true for ingredients in owned recipes', async () => {
			const mockResult = {
				ingredient_household_id: 2,
				recipe_household_id: 1,
				collection_household_id: null,
				collection_public: null,
				is_subscribed_to_collection: null,
			};
			mockPool.execute.mockResolvedValueOnce([[mockResult] as RowDataPacket[], []]);

			const result = await canAccessIngredient(1, 123);

			expect(result).toBe(true);
		});

		it('should return true for ingredients in public collections', async () => {
			const mockResult = {
				ingredient_household_id: 2,
				recipe_household_id: 2,
				collection_household_id: 2,
				collection_public: 1,
				is_subscribed_to_collection: null,
			};
			mockPool.execute.mockResolvedValueOnce([[mockResult] as RowDataPacket[], []]);

			const result = await canAccessIngredient(1, 123);

			expect(result).toBe(true);
		});

		it('should return false for inaccessible ingredients', async () => {
			const mockResult = {
				ingredient_household_id: 2,
				recipe_household_id: 2,
				collection_household_id: 2,
				collection_public: 0,
				is_subscribed_to_collection: null,
			};
			mockPool.execute.mockResolvedValueOnce([[mockResult] as RowDataPacket[], []]);

			const result = await canAccessIngredient(1, 123);

			expect(result).toBe(false);
		});
	});

	describe('canEditMultipleResources', () => {
		it('should return permissions for multiple resources', async () => {
			const mockResources = [
				{ id: 1, household_id: 1 }, // Can edit
				{ id: 2, household_id: 2 }, // Cannot edit
				{ id: 3, household_id: 1 }, // Can edit
			];
			mockPool.execute.mockResolvedValueOnce([mockResources as RowDataPacket[], []]);

			const result = await canEditMultipleResources(1, 'recipes', [1, 2, 3, 4]);

			expect(result).toEqual({
				1: true,
				2: false,
				3: true,
				4: false, // Not found in results
			});
		});

		it('should return empty object for empty input', async () => {
			const result = await canEditMultipleResources(1, 'recipes', []);

			expect(result).toEqual({});
			expect(mockPool.execute).not.toHaveBeenCalled();
		});

		it('should handle database errors gracefully', async () => {
			mockPool.execute.mockRejectedValueOnce(new Error('Database error'));

			const result = await canEditMultipleResources(1, 'recipes', [1, 2, 3]);

			expect(result).toEqual({
				1: false,
				2: false,
				3: false,
			});
		});
	});

	describe('isAdmin', () => {
		it('should return true for admin users', async () => {
			mockPool.execute.mockResolvedValueOnce([[{ is_admin: 1 }] as RowDataPacket[], []]);

			const result = await isAdmin(1);

			expect(result).toBe(true);
			expect(mockPool.execute).toHaveBeenCalledWith('SELECT is_admin FROM users WHERE id = ?', [1]);
		});

		it('should return false for non-admin users', async () => {
			mockPool.execute.mockResolvedValueOnce([[{ is_admin: 0 }] as RowDataPacket[], []]);

			const result = await isAdmin(1);

			expect(result).toBe(false);
		});

		it('should return false for non-existent users', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			const result = await isAdmin(999);

			expect(result).toBe(false);
		});

		it('should handle database errors gracefully', async () => {
			mockPool.execute.mockRejectedValueOnce(new Error('Database error'));

			const result = await isAdmin(1);

			expect(result).toBe(false);
		});
	});

	describe('validateHouseholdCollectionAccess', () => {
		it('should return true when household owns collection', async () => {
			mockPool.execute.mockResolvedValueOnce([[{ '1': 1 }] as RowDataPacket[], []]);

			const result = await validateHouseholdCollectionAccess(456, 123);

			expect(result).toBe(true);
			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('FROM collections c'), [123, 456, 123]);
		});

		it('should return true when household is subscribed to collection', async () => {
			mockPool.execute.mockResolvedValueOnce([[{ '1': 1 }] as RowDataPacket[], []]);

			const result = await validateHouseholdCollectionAccess(456, 123);

			expect(result).toBe(true);
		});

		it('should return true when collection is public', async () => {
			mockPool.execute.mockResolvedValueOnce([[{ '1': 1 }] as RowDataPacket[], []]);

			const result = await validateHouseholdCollectionAccess(456, 123);

			expect(result).toBe(true);
		});

		it('should return false when household has no access to collection', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			const result = await validateHouseholdCollectionAccess(456, 123);

			expect(result).toBe(false);
		});

		it('should return false when database query fails', async () => {
			mockPool.execute.mockRejectedValueOnce(new Error('Database connection failed'));

			const result = await validateHouseholdCollectionAccess(456, 123);

			expect(result).toBe(false);
		});
	});

	describe('validateRecipeInCollection', () => {
		it('should return true when household has access and recipe belongs to collection', async () => {
			// Mock household has collection access
			mockPool.execute
				.mockResolvedValueOnce([[{ '1': 1 }] as RowDataPacket[], []]) // Collection access check
				.mockResolvedValueOnce([[{ '1': 1 }] as RowDataPacket[], []]); // Recipe in collection check

			const result = await validateRecipeInCollection(123, 456, 789);

			expect(result).toBe(true);
			expect(mockPool.execute).toHaveBeenCalledTimes(2);
		});

		it('should return false when household has no access to collection', async () => {
			// Mock household has no collection access
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			const result = await validateRecipeInCollection(123, 456, 789);

			expect(result).toBe(false);
			expect(mockPool.execute).toHaveBeenCalledTimes(1); // Should not check recipe membership
		});

		it('should return false when household has access but recipe not in collection', async () => {
			// Mock household has collection access but recipe not in collection
			mockPool.execute
				.mockResolvedValueOnce([[{ '1': 1 }] as RowDataPacket[], []]) // Collection access check
				.mockResolvedValueOnce([[] as RowDataPacket[], []]); // Recipe not in collection

			const result = await validateRecipeInCollection(123, 456, 789);

			expect(result).toBe(false);
			expect(mockPool.execute).toHaveBeenCalledTimes(2);
		});

		it('should return false when database query fails', async () => {
			mockPool.execute.mockRejectedValueOnce(new Error('Database connection failed'));

			const result = await validateRecipeInCollection(123, 456, 789);

			expect(result).toBe(false);
		});
	});
});
