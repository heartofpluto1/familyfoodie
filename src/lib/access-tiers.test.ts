import {
	getBrowsingAccessCollections,
	getPlanningAccessCollections,
	getIngredientsAccessIngredients,
	validateAccessTier,
	validateMultipleAccessTiers,
	hasRequiredAccess,
	AccessContext,
} from './access-tiers';
import pool from './db.js';

// Mock the database pool
jest.mock('./db.js');
const mockPool = pool as jest.Mocked<typeof pool>;

describe('Three-Tier Access System', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('Tier 1 - Browsing Access', () => {
		describe('getBrowsingAccessCollections', () => {
			it('should return public collections for browsing', async () => {
				const mockCollections = [
					{
						id: 1,
						title: 'Public Collection',
						subtitle: 'Open to all',
						filename: 'public.jpg',
						filename_dark: 'public-dark.jpg',
						url_slug: 'public-collection',
						created_at: new Date(),
						updated_at: new Date(),
						household_name: 'Wilson',
						access_type: 'public',
						recipe_count: 8,
						can_edit: false,
						can_subscribe: true,
						household_id: 3,
					},
					{
						id: 2,
						title: 'Already Subscribed',
						subtitle: 'User subscribed',
						filename: 'subscribed.jpg',
						filename_dark: 'subscribed-dark.jpg',
						url_slug: 'already-subscribed',
						created_at: new Date(),
						updated_at: new Date(),
						household_name: 'Davis',
						access_type: 'subscribed',
						recipe_count: 12,
						can_edit: false,
						can_subscribe: false,
						household_id: 4,
					},
				];

				mockPool.execute.mockResolvedValueOnce([mockCollections, []]);

				const result = await getBrowsingAccessCollections(1);

				expect(result).toEqual(mockCollections);
				expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE c.public = 1'), [1]);
			});

			it('should order by title', async () => {
				mockPool.execute.mockResolvedValueOnce([[], []]);

				await getBrowsingAccessCollections(1);

				expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY c.title ASC'), [1]);
			});
		});
	});

	describe('Tier 2 - Planning Access', () => {
		describe('getPlanningAccessCollections', () => {
			it('should return owned and subscribed collections', async () => {
				const mockCollections = [
					{
						id: 1,
						title: 'My Collection',
						access_type: 'owned',
						can_edit: true,
						can_subscribe: false,
						household_id: 1,
					},
					{
						id: 2,
						title: 'Subscribed Collection',
						access_type: 'subscribed',
						can_edit: false,
						can_subscribe: false,
						household_id: 2,
					},
				];

				mockPool.execute.mockResolvedValueOnce([mockCollections, []]);

				const result = await getPlanningAccessCollections(1);

				expect(result).toEqual(mockCollections);
				expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE c.household_id = ? OR cs.household_id IS NOT NULL'), [1, 1, 1, 1]);
			});

			it('should prioritize owned collections in ordering', async () => {
				mockPool.execute.mockResolvedValueOnce([[], []]);

				await getPlanningAccessCollections(1);

				expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY access_type ASC, c.title ASC'), [1, 1, 1, 1]);
			});
		});
	});

	describe('Tier 3 - Ingredients Access', () => {
		describe('getIngredientsAccessIngredients', () => {
			it('should return owned and accessible ingredients', async () => {
				const mockIngredients = [
					{
						id: 1,
						name: 'My Ingredient',
						household_id: 1,
						access_type: 'owned',
						can_edit: true,
					},
					{
						id: 2,
						name: 'Spencer Essential',
						household_id: 1,
						access_type: 'accessible',
						can_edit: false,
					},
				];

				mockPool.execute.mockResolvedValueOnce([mockIngredients, []]);

				const result = await getIngredientsAccessIngredients(1);

				expect(result).toEqual(mockIngredients);
				expect(mockPool.execute).toHaveBeenCalledWith(
					expect.stringContaining("c.id = 1 OR           -- Always include Spencer's essentials"),
					[1, 1, 1, 1, 1, 1]
				);
			});

			it('should exclude household copies of other ingredients', async () => {
				mockPool.execute.mockResolvedValueOnce([[], []]);

				await getIngredientsAccessIngredients(1);

				expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('AND NOT EXISTS ('), [1, 1, 1, 1, 1, 1]);
			});

			it('should prioritize owned ingredients', async () => {
				mockPool.execute.mockResolvedValueOnce([[], []]);

				await getIngredientsAccessIngredients(1);

				expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY access_type ASC, i.name ASC'), [1, 1, 1, 1, 1, 1]);
			});
		});
	});

	describe('Access Validation', () => {
		describe('validateAccessTier', () => {
			it('should validate owned collection access', async () => {
				const mockResult = {
					household_id: 1,
					public: 0,
					is_subscribed: null,
					access_type: 'owned',
					can_edit: true,
					can_subscribe: false,
				};
				mockPool.execute.mockResolvedValueOnce([[mockResult], []]);

				const result = await validateAccessTier(1, 'collection', 123, 'planning');

				expect(result).toEqual({
					tier: 'planning',
					household_id: 1,
					access_type: 'owned',
					can_edit: true,
					can_subscribe: false,
				});
			});

			it('should validate subscribed collection access', async () => {
				const mockResult = {
					household_id: 2,
					public: 1,
					is_subscribed: 1,
					access_type: 'subscribed',
					can_edit: false,
					can_subscribe: false,
				};
				mockPool.execute.mockResolvedValueOnce([[mockResult], []]);

				const result = await validateAccessTier(1, 'collection', 123, 'browsing');

				expect(result).toEqual({
					tier: 'browsing',
					household_id: 1,
					access_type: 'subscribed',
					can_edit: false,
					can_subscribe: false,
				});
			});

			it('should validate public collection access', async () => {
				const mockResult = {
					household_id: 2,
					public: 1,
					is_subscribed: null,
					access_type: 'public',
					can_edit: false,
					can_subscribe: true,
				};
				mockPool.execute.mockResolvedValueOnce([[mockResult], []]);

				const result = await validateAccessTier(1, 'collection', 123, 'browsing');

				expect(result).toEqual({
					tier: 'browsing',
					household_id: 1,
					access_type: 'public',
					can_edit: false,
					can_subscribe: true,
				});
			});

			it('should return null for inaccessible resources', async () => {
				mockPool.execute.mockResolvedValueOnce([[], []]);

				const result = await validateAccessTier(1, 'collection', 999, 'planning');

				expect(result).toBeNull();
			});

			it('should handle database errors gracefully', async () => {
				mockPool.execute.mockRejectedValueOnce(new Error('Database error'));

				const result = await validateAccessTier(1, 'collection', 123, 'planning');

				expect(result).toBeNull();
			});

			it('should validate recipe access through collection context', async () => {
				const mockResult = {
					recipe_household_id: 2,
					collection_household_id: 1,
					collection_public: 0,
					is_subscribed_to_collection: null,
					access_type: 'accessible',
					can_edit: false,
				};
				mockPool.execute.mockResolvedValueOnce([[mockResult], []]);

				const result = await validateAccessTier(1, 'recipe', 123, 'planning');

				expect(result).toEqual({
					tier: 'planning',
					household_id: 1,
					access_type: 'accessible',
					can_edit: false,
					can_subscribe: false,
				});
			});

			it('should validate ingredient access with Spencer essentials', async () => {
				const mockResult = {
					ingredient_household_id: 1,
					recipe_household_id: null,
					collection_household_id: null,
					collection_public: null,
					is_subscribed_to_collection: null,
					access_type: 'accessible',
					can_edit: false,
				};
				mockPool.execute.mockResolvedValueOnce([[mockResult], []]);

				const result = await validateAccessTier(1, 'ingredient', 123, 'ingredients');

				expect(result).toEqual({
					tier: 'ingredients',
					household_id: 1,
					access_type: 'accessible',
					can_edit: false,
					can_subscribe: false,
				});
			});
		});

		describe('validateMultipleAccessTiers', () => {
			it('should validate access for multiple resources', async () => {
				const mockResults = [
					{
						household_id: 1,
						public: 0,
						is_subscribed: null,
						access_type: 'owned',
						can_edit: true,
						can_subscribe: false,
					},
					{
						recipe_household_id: 1,
						collection_household_id: 1,
						collection_public: 0,
						is_subscribed_to_collection: null,
						access_type: 'owned',
						can_edit: true,
					},
				];

				mockPool.execute.mockResolvedValueOnce([[mockResults[0]], []]).mockResolvedValueOnce([[mockResults[1]], []]);

				const resources = [
					{ type: 'collection' as const, id: 1, required_tier: 'planning' as const },
					{ type: 'recipe' as const, id: 2, required_tier: 'planning' as const },
				];

				const result = await validateMultipleAccessTiers(1, resources);

				expect(result).toEqual({
					collection_1: {
						tier: 'planning',
						household_id: 1,
						access_type: 'owned',
						can_edit: true,
						can_subscribe: false,
					},
					recipe_2: {
						tier: 'planning',
						household_id: 1,
						access_type: 'owned',
						can_edit: true,
						can_subscribe: false,
					},
				});
			});
		});

		describe('hasRequiredAccess', () => {
			const mockContext: AccessContext = {
				tier: 'planning',
				household_id: 1,
				access_type: 'owned',
				can_edit: true,
				can_subscribe: false,
			};

			it('should return true for view access when context exists', () => {
				expect(hasRequiredAccess(mockContext, 'view')).toBe(true);
			});

			it('should return false for view access when context is null', () => {
				expect(hasRequiredAccess(null, 'view')).toBe(false);
			});

			it('should return correct value for edit access', () => {
				expect(hasRequiredAccess(mockContext, 'edit')).toBe(true);

				const readOnlyContext = { ...mockContext, can_edit: false };
				expect(hasRequiredAccess(readOnlyContext, 'edit')).toBe(false);
			});

			it('should return correct value for subscribe access', () => {
				expect(hasRequiredAccess(mockContext, 'subscribe')).toBe(false);

				const subscribableContext = { ...mockContext, can_subscribe: true };
				expect(hasRequiredAccess(subscribableContext, 'subscribe')).toBe(true);
			});
		});
	});
});
