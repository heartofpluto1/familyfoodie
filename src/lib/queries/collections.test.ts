import { getMyCollections, getPublicCollections, getCollectionByIdWithHousehold } from './collections';
import pool from '@/lib/db.js';
import { RowDataPacket } from 'mysql2';

// Mock the database pool
jest.mock('@/lib/db.js');
const mockPool = pool as jest.Mocked<typeof pool>;

describe('Collections Queries with Household Context', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('getMyCollections', () => {
		it('should return owned and subscribed collections', async () => {
			const mockCollections = [
				{
					id: 1,
					title: 'My Collection',
					subtitle: 'Personal recipes',
					filename: 'my-collection.jpg',
					filename_dark: 'my-collection-dark.jpg',
					url_slug: 'my-collection',
					created_at: new Date(),
					updated_at: new Date(),
					household_name: 'Spencer',
					access_type: 'owned',
					recipe_count: 5,
					can_edit: true,
					can_subscribe: false,
					household_id: 1,
				},
				{
					id: 2,
					title: 'Subscribed Collection',
					subtitle: 'Great recipes',
					filename: 'subscribed.jpg',
					filename_dark: 'subscribed-dark.jpg',
					url_slug: 'subscribed-collection',
					created_at: new Date(),
					updated_at: new Date(),
					household_name: 'Johnson',
					access_type: 'subscribed',
					recipe_count: 3,
					can_edit: false,
					can_subscribe: false,
					household_id: 2,
				},
			];

			mockPool.execute.mockResolvedValueOnce([mockCollections as RowDataPacket[], []]);

			const result = await getMyCollections(1);

			expect(result).toEqual(mockCollections);
			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE c.household_id = ? OR cs.household_id IS NOT NULL'), [1, 1, 1, 1]);
		});

		it('should return empty array when no collections found', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			const result = await getMyCollections(1);

			expect(result).toEqual([]);
		});

		it('should order results by access type and title', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getMyCollections(1);

			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('ORDER BY access_type ASC, c.title ASC'), [1, 1, 1, 1]);
		});
	});

	describe('getPublicCollections', () => {
		it('should return public collections with subscription status', async () => {
			const mockCollections = [
				{
					id: 3,
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
					id: 4,
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

			mockPool.execute.mockResolvedValueOnce([mockCollections as RowDataPacket[], []]);

			const result = await getPublicCollections(1);

			expect(result).toEqual(mockCollections);
			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE c.public = 1'), [1]);
		});

		it('should filter only public collections', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getPublicCollections(1);

			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE c.public = 1'), [1]);
		});
	});

	describe('getCollectionByIdWithHousehold', () => {
		it('should return collection with household context for owned collection', async () => {
			const mockCollection = {
				id: 1,
				title: 'My Collection',
				subtitle: 'Personal recipes',
				filename: 'my-collection.jpg',
				filename_dark: 'my-collection-dark.jpg',
				url_slug: 'my-collection',
				created_at: new Date(),
				updated_at: new Date(),
				household_name: 'Spencer',
				access_type: 'owned',
				recipe_count: 5,
				can_edit: true,
				can_subscribe: false,
				household_id: 1,
			};

			mockPool.execute.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []]);

			const result = await getCollectionByIdWithHousehold(1, 1);

			expect(result).toEqual(mockCollection);
			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE c.id = ?'), [1, 1, 1, 1, 1, 1]);
		});

		it('should return collection for subscribed access', async () => {
			const mockCollection = {
				id: 2,
				title: 'Subscribed Collection',
				subtitle: 'Great recipes',
				filename: 'subscribed.jpg',
				filename_dark: 'subscribed-dark.jpg',
				url_slug: 'subscribed-collection',
				created_at: new Date(),
				updated_at: new Date(),
				household_name: 'Johnson',
				access_type: 'subscribed',
				recipe_count: 3,
				can_edit: false,
				can_subscribe: false,
				household_id: 2,
			};

			mockPool.execute.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []]);

			const result = await getCollectionByIdWithHousehold(2, 1);

			expect(result).toEqual(mockCollection);
		});

		it('should return collection for public access', async () => {
			const mockCollection = {
				id: 3,
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
			};

			mockPool.execute.mockResolvedValueOnce([[mockCollection] as RowDataPacket[], []]);

			const result = await getCollectionByIdWithHousehold(3, 1);

			expect(result).toEqual(mockCollection);
		});

		it('should return null for inaccessible collection', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			const result = await getCollectionByIdWithHousehold(999, 1);

			expect(result).toBeNull();
		});

		it('should validate access permissions in query', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getCollectionByIdWithHousehold(1, 1);

			expect(mockPool.execute).toHaveBeenCalledWith(expect.stringContaining('c.household_id = ? OR           -- User owns collection'), [1, 1, 1, 1, 1, 1]);
		});

		it('should calculate can_subscribe correctly', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getCollectionByIdWithHousehold(1, 1);

			expect(mockPool.execute).toHaveBeenCalledWith(
				expect.stringContaining('(c.public = 1 AND c.household_id != ? AND cs.household_id IS NULL) as can_subscribe'),
				[1, 1, 1, 1, 1, 1]
			);
		});
	});

	describe('recipe count calculation', () => {
		it('should only count non-archived recipes', async () => {
			mockPool.execute.mockResolvedValueOnce([[] as RowDataPacket[], []]);

			await getMyCollections(1);

			expect(mockPool.execute).toHaveBeenCalledWith(
				expect.stringContaining('COUNT(CASE WHEN r.archived = 0 THEN cr.recipe_id END) as recipe_count'),
				[1, 1, 1, 1]
			);
		});
	});
});
