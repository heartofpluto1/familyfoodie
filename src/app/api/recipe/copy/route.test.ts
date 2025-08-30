/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import { NextResponse } from 'next/server';
import * as appHandler from './route';
import pool from '@/lib/db.js';
import { clearAllMocks, setupConsoleMocks, mockRegularSession } from '@/lib/test-utils';
import { requireAuth } from '@/lib/auth/helpers';

// Mock the database BEFORE other imports
jest.mock('@/lib/db.js', () => ({
	__esModule: true,
	default: {
		execute: jest.fn(),
		getConnection: jest.fn(),
	},
}));

// Mock OAuth auth helpers
jest.mock('@/lib/auth/helpers', () => ({
	requireAuth: jest.fn(),
}));

const mockExecute = pool.execute as jest.Mock;
const mockGetConnection = pool.getConnection as jest.Mock;
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;

// Mock connection interface
interface MockConnection {
	execute: jest.Mock;
	beginTransaction: jest.Mock;
	commit: jest.Mock;
	rollback: jest.Mock;
	release: jest.Mock;
}

describe('POST /api/recipe/copy', () => {
	let consoleCleanup: () => void;

	beforeEach(() => {
		clearAllMocks();
		const consoleMocks = setupConsoleMocks();
		consoleCleanup = consoleMocks.cleanup;

		// Reset all mocks to clean state
		mockExecute.mockReset();
		mockGetConnection.mockReset();
		mockRequireAuth.mockReset();

		// Setup default OAuth auth response
		mockRequireAuth.mockResolvedValue({
			authorized: true as const,
			session: mockRegularSession,
			household_id: mockRegularSession.user.household_id,
			user_id: mockRegularSession.user.id,
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	afterAll(() => {
		if (consoleCleanup) {
			consoleCleanup();
		}
		jest.restoreAllMocks();
	});

	describe('Success Cases', () => {
		it('should successfully copy recipes to a collection', async () => {
			// Setup mocks
			mockExecute
				.mockResolvedValueOnce([[{ id: 5, household_id: 1 }], []]) // collection check
				.mockResolvedValueOnce([[{ id: 1 }, { id: 2 }, { id: 3 }], []]) // recipe existence
				.mockResolvedValueOnce([[], []]); // existing recipes check

			const mockConnection: MockConnection = {
				execute: jest.fn().mockResolvedValue([{ affectedRows: 3 }, []]),
				beginTransaction: jest.fn(),
				commit: jest.fn(),
				rollback: jest.fn(),
				release: jest.fn(),
			};
			mockGetConnection.mockResolvedValue(mockConnection);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							recipeIds: [1, 2, 3],
							targetCollectionId: 5,
						}),
					});
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json.success).toBe(true);
					expect(json.copiedCount).toBe(3);
					expect(json.skippedCount).toBe(0);
					expect(mockConnection.commit).toHaveBeenCalled();
					expect(mockConnection.release).toHaveBeenCalled();
				},
			});
		});

		it('should skip recipes that already exist in the collection', async () => {
			// Setup mocks
			mockExecute
				.mockResolvedValueOnce([[{ id: 5, household_id: 1 }], []]) // collection check
				.mockResolvedValueOnce([[{ id: 1 }, { id: 2 }, { id: 3 }], []]) // recipe existence
				.mockResolvedValueOnce([[{ recipe_id: 1 }], []]); // recipe 1 already exists

			const mockConnection: MockConnection = {
				execute: jest.fn().mockResolvedValue([{ affectedRows: 2 }, []]),
				beginTransaction: jest.fn(),
				commit: jest.fn(),
				rollback: jest.fn(),
				release: jest.fn(),
			};
			mockGetConnection.mockResolvedValue(mockConnection);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							recipeIds: [1, 2, 3],
							targetCollectionId: 5,
						}),
					});
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json.success).toBe(true);
					expect(json.copiedCount).toBe(2);
					expect(json.skippedCount).toBe(1);
					expect(json.copiedRecipeIds).toEqual([2, 3]);
					expect(json.skippedRecipeIds).toEqual([1]);
				},
			});
		});

		it('should handle when all recipes already exist in collection', async () => {
			// Setup mocks
			mockExecute
				.mockResolvedValueOnce([[{ id: 5, household_id: 1 }], []]) // collection check
				.mockResolvedValueOnce([[{ id: 1 }, { id: 2 }, { id: 3 }], []]) // recipe existence
				.mockResolvedValueOnce([[{ recipe_id: 1 }, { recipe_id: 2 }, { recipe_id: 3 }], []]); // ALL already exist

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							recipeIds: [1, 2, 3],
							targetCollectionId: 5,
						}),
					});
					const json = await response.json();

					expect(response.status).toBe(200);
					expect(json.success).toBe(true);
					expect(json.message).toContain('already exist');
					expect(json.copiedCount).toBe(0);
					expect(json.skippedCount).toBe(3);
					// Should NOT call getConnection since no copying needed
					expect(mockGetConnection).not.toHaveBeenCalled();
				},
			});
		});
	});

	describe('Validation Errors', () => {
		it('should return error when recipe IDs are missing', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							targetCollectionId: 5,
						}),
					});
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json.success).toBe(false);
					expect(json.code).toBe('INVALID_RECIPE_IDS');
				},
			});
		});

		it('should return error when collection ID is missing', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							recipeIds: [1, 2, 3],
						}),
					});
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json.success).toBe(false);
					expect(json.code).toBe('MISSING_COLLECTION_ID');
				},
			});
		});

		it('should return error for empty recipe IDs array', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							recipeIds: [],
							targetCollectionId: 5,
						}),
					});
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json.success).toBe(false);
					expect(json.code).toBe('EMPTY_RECIPE_IDS');
				},
			});
		});

		it('should return error for invalid recipe IDs', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							recipeIds: ['not', 'numbers'],
							targetCollectionId: 5,
						}),
					});
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json.success).toBe(false);
					expect(json.code).toBe('INVALID_RECIPE_ID');
				},
			});
		});

		it('should return error for negative recipe IDs', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							recipeIds: [1, -2, 3],
							targetCollectionId: 5,
						}),
					});
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json.success).toBe(false);
					expect(json.code).toBe('INVALID_RECIPE_ID');
					expect(json.error).toContain('positive integers');
				},
			});
		});

		it('should return error for zero collection ID', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							recipeIds: [1, 2, 3],
							targetCollectionId: 0,
						}),
					});
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json.success).toBe(false);
					expect(json.code).toBe('INVALID_COLLECTION_ID');
				},
			});
		});

		it('should return error for invalid JSON in request body', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: 'invalid json {',
					});
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json.success).toBe(false);
					expect(json.code).toBe('INVALID_JSON');
				},
			});
		});

		it('should return error for non-numeric collection ID', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							recipeIds: [1, 2, 3],
							targetCollectionId: 'not-a-number',
						}),
					});
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json.success).toBe(false);
					expect(json.code).toBe('INVALID_COLLECTION_ID');
					expect(json.error).toContain('positive integer');
				},
			});
		});

		it('should return error when recipeIds is not an array', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							recipeIds: 'not-an-array',
							targetCollectionId: 5,
						}),
					});
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json.success).toBe(false);
					expect(json.code).toBe('INVALID_RECIPE_IDS');
					expect(json.error).toContain('array');
				},
			});
			// Ensure no database calls were made
			expect(mockExecute).not.toHaveBeenCalled();
		});

		it('should return error for float recipe IDs', async () => {
			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							recipeIds: [1, 2.5, 3],
							targetCollectionId: 5,
						}),
					});
					const json = await response.json();

					expect(response.status).toBe(400);
					expect(json.success).toBe(false);
					expect(json.code).toBe('INVALID_RECIPE_ID');
					expect(json.error).toContain('positive integers');
				},
			});
			// Ensure no database calls were made
			expect(mockExecute).not.toHaveBeenCalled();
		});
	});

	describe('Authentication', () => {
		it('should return 401 for unauthenticated users', async () => {
			// Mock auth failure
			mockRequireAuth.mockResolvedValueOnce({
				authorized: false as const,
				response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
			});

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							recipeIds: [1, 2, 3],
							targetCollectionId: 5,
						}),
					});

					const json = await response.json();

					expect(response.status).toBe(401);
					expect(json.error).toBe('Unauthorized');
				},
			});
		});
	});

	describe('Authorization Errors', () => {
		it('should return error when collection does not belong to household', async () => {
			// Mock collection check - returns empty (collection not found or wrong household)
			mockExecute.mockResolvedValueOnce([[], []]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							recipeIds: [1, 2, 3],
							targetCollectionId: 5,
						}),
					});
					const json = await response.json();

					expect(response.status).toBe(404);
					expect(json.success).toBe(false);
					expect(json.code).toBe('COLLECTION_NOT_FOUND');
				},
			});
		});

		it('should return error when some recipes do not exist', async () => {
			// Mock collection check
			mockExecute.mockResolvedValueOnce([[{ id: 5, household_id: 1 }], []]);
			// Mock recipe existence check - only recipes 1 and 2 exist
			mockExecute.mockResolvedValueOnce([[{ id: 1 }, { id: 2 }], []]);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							recipeIds: [1, 2, 3],
							targetCollectionId: 5,
						}),
					});
					const json = await response.json();

					expect(response.status).toBe(404);
					expect(json.success).toBe(false);
					expect(json.code).toBe('RECIPES_NOT_FOUND');
					expect(json.missingIds).toEqual([3]);
				},
			});
		});
	});

	describe('Error Handling', () => {
		it('should handle database connection errors', async () => {
			// Mock database connection error
			mockExecute.mockRejectedValueOnce(new Error('ECONNREFUSED: Connection refused'));

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							recipeIds: [1, 2, 3],
							targetCollectionId: 5,
						}),
					});
					const json = await response.json();

					expect(response.status).toBe(500);
					expect(json.success).toBe(false);
					expect(json.code).toBe('DATABASE_ERROR');
					expect(json.error).toContain('Connection refused');
				},
			});
		});

		it('should rollback transaction on insert failure', async () => {
			// Setup mocks
			mockExecute
				.mockResolvedValueOnce([[{ id: 5, household_id: 1 }], []]) // collection check
				.mockResolvedValueOnce([[{ id: 1 }, { id: 2 }, { id: 3 }], []]) // recipe existence
				.mockResolvedValueOnce([[], []]); // no existing recipes

			const mockConnection: MockConnection = {
				execute: jest.fn().mockRejectedValue(new Error('Insert failed')),
				beginTransaction: jest.fn(),
				commit: jest.fn(),
				rollback: jest.fn(),
				release: jest.fn(),
			};
			mockGetConnection.mockResolvedValue(mockConnection);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							recipeIds: [1, 2, 3],
							targetCollectionId: 5,
						}),
					});
					const json = await response.json();

					expect(response.status).toBe(500);
					expect(json.success).toBe(false);
					expect(json.error).toContain('Insert failed');
					expect(mockConnection.rollback).toHaveBeenCalled();
					expect(mockConnection.commit).not.toHaveBeenCalled();
					expect(mockConnection.release).toHaveBeenCalled();
				},
			});
		});

		it('should handle duplicate entry errors gracefully', async () => {
			// Setup mocks
			mockExecute
				.mockResolvedValueOnce([[{ id: 5, household_id: 1 }], []]) // collection check
				.mockResolvedValueOnce([[{ id: 1 }, { id: 2 }, { id: 3 }], []]) // recipe existence
				.mockResolvedValueOnce([[], []]); // no existing recipes

			const mockConnection: MockConnection = {
				execute: jest.fn().mockRejectedValue(new Error('Duplicate entry for key collection_recipes.PRIMARY')),
				beginTransaction: jest.fn(),
				commit: jest.fn(),
				rollback: jest.fn(),
				release: jest.fn(),
			};
			mockGetConnection.mockResolvedValue(mockConnection);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							recipeIds: [1, 2, 3],
							targetCollectionId: 5,
						}),
					});
					const json = await response.json();

					expect(response.status).toBe(500);
					expect(json.success).toBe(false);
					expect(json.code).toBe('DUPLICATE_ENTRY');
					expect(json.error).toContain('Duplicate entry');
					expect(mockConnection.rollback).toHaveBeenCalled();
					expect(mockConnection.release).toHaveBeenCalled();
				},
			});
		});

		it('should handle foreign key constraint violations', async () => {
			// Setup mocks
			mockExecute
				.mockResolvedValueOnce([[{ id: 5, household_id: 1 }], []]) // collection check
				.mockResolvedValueOnce([[{ id: 1 }, { id: 2 }, { id: 3 }], []]) // recipe existence
				.mockResolvedValueOnce([[], []]); // no existing recipes

			const mockConnection: MockConnection = {
				execute: jest.fn().mockRejectedValue(new Error('Cannot add or update a child row: a foreign key constraint fails')),
				beginTransaction: jest.fn(),
				commit: jest.fn(),
				rollback: jest.fn(),
				release: jest.fn(),
			};
			mockGetConnection.mockResolvedValue(mockConnection);

			await testApiHandler({
				appHandler,
				test: async ({ fetch }) => {
					const response = await fetch({
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							recipeIds: [1, 2, 3],
							targetCollectionId: 5,
						}),
					});
					const json = await response.json();

					expect(response.status).toBe(500);
					expect(json.success).toBe(false);
					expect(json.code).toBe('CONSTRAINT_VIOLATION');
					expect(json.error).toContain('foreign key constraint');
					expect(mockConnection.rollback).toHaveBeenCalled();
					expect(mockConnection.release).toHaveBeenCalled();
				},
			});
		});
	});
});
