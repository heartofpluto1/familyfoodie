/** @jest-environment node */

import { NextRequest } from 'next/server';
import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';

// Mock database module
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
}));

// Mock auth middleware with inline definition to avoid hoisting issues
jest.mock('@/lib/auth-middleware', () => ({
	withAuth: (handler: (request: NextRequest & { user?: { household_id: number }; household_id?: number }, context?: unknown) => Promise<Response>) => {
		return async (request: NextRequest & { user?: { household_id: number }; household_id?: number }, context?: unknown) => {
			// Check if user is set by requestPatcher
			if (!request.user) {
				return new Response(
					JSON.stringify({
						success: false,
						error: 'Authentication required',
						code: 'UNAUTHORIZED',
					}),
					{ status: 401, headers: { 'Content-Type': 'application/json' } }
				);
			}
			// Set household_id from user as the real middleware does
			request.household_id = request.user.household_id || 1; // Default to household_id 1 for testing
			return handler(request, context);
		};
	},
}));

import { mockRegularUser, clearAllMocks, setupConsoleMocks, standardErrorScenarios } from '@/lib/test-utils';

// Get mocked database function
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);

// Console mocks for cleaner test output
const { cleanup: cleanupConsole } = setupConsoleMocks();

// Test data
const validIngredientData = {
	name: 'Test Ingredient',
	fresh: true,
	price: 2.99,
	stockcode: 12345,
	supermarketCategoryId: 1,
	pantryCategoryId: 2,
};

const minimalIngredientData = {
	name: 'Minimal Ingredient',
	fresh: false,
	price: null,
	stockcode: null,
	supermarketCategoryId: null,
	pantryCategoryId: null,
};

// Helper to create authenticated request
function createAuthenticatedRequest(body: unknown) {
	const request = new NextRequest('http://localhost:3000/api/ingredients/add', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});

	// Mock auth middleware adds these properties
	(request as NextRequest & { user: typeof mockRegularUser; household_id: number }).user = mockRegularUser;
	(request as NextRequest & { user: typeof mockRegularUser; household_id: number }).household_id = mockRegularUser.household_id;

	return request;
}

describe('/api/ingredients/add', () => {
	beforeEach(() => {
		clearAllMocks();
	});

	afterAll(() => {
		cleanupConsole();
	});

	describe('POST /api/ingredients/add', () => {
		describe('Successful ingredient creation', () => {
			it('should create ingredient with all fields and household ownership', async () => {
				const mockCreatedIngredient = {
					id: 123,
					name: 'Test Ingredient',
					fresh: 1,
					price: 2.99,
					stockcode: 12345,
					supermarketCategoryId: 1,
					pantryCategoryId: 2,
					household_id: mockRegularUser.household_id,
					created_at: '2024-01-01T12:00:00Z',
				};

				// Mock successful database operations
				mockExecute
					.mockResolvedValueOnce([[], []]) // Check existing ingredient (none found)
					.mockResolvedValueOnce([{ insertId: 123, affectedRows: 1 }, []]) // Insert ingredient
					.mockResolvedValueOnce([[mockCreatedIngredient], []]); // Fetch created ingredient

				const request = createAuthenticatedRequest(validIngredientData);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(validIngredientData),
						});

						expect(response.status).toBe(201);
						expect(response.headers.get('Location')).toBe('/api/ingredients/123');
						const data = await response.json();

						expect(data).toEqual({
							success: true,
							data: {
								id: 123,
								name: 'Test Ingredient',
								fresh: true,
								price: 2.99,
								stockcode: 12345,
								supermarketCategoryId: 1,
								pantryCategoryId: 2,
								household_id: mockRegularUser.household_id,
								created_at: '2024-01-01T12:00:00Z',
							},
							message: 'Ingredient added successfully',
						});

						// Verify check for existing ingredient in household
						expect(mockExecute).toHaveBeenNthCalledWith(1, 'SELECT id FROM ingredients WHERE name = ? AND household_id = ?', [
							'Test Ingredient',
							mockRegularUser.household_id,
						]);

						// Verify insert with household ownership
						expect(mockExecute).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO ingredients'), [
							'Test Ingredient',
							true, // fresh
							2.99, // price
							12345, // stockcode
							1, // supermarketCategoryId
							2, // pantryCategoryId
							mockRegularUser.household_id,
						]);

						// Verify fetch of created ingredient
						expect(mockExecute).toHaveBeenNthCalledWith(3, expect.stringContaining('SELECT id, name, fresh, cost as price'), [123]);
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});

			it('should create ingredient with minimal required fields', async () => {
				const mockCreatedIngredient = {
					id: 456,
					name: 'Minimal Ingredient',
					fresh: 0,
					price: null,
					stockcode: null,
					supermarketCategoryId: null,
					pantryCategoryId: null,
					household_id: mockRegularUser.household_id,
					created_at: '2024-01-01T12:00:00Z',
				};

				mockExecute
					.mockResolvedValueOnce([[], []]) // No existing ingredient
					.mockResolvedValueOnce([{ insertId: 456, affectedRows: 1 }, []]) // Insert successful
					.mockResolvedValueOnce([[mockCreatedIngredient], []]); // Fetch created ingredient

				const request = createAuthenticatedRequest(minimalIngredientData);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(minimalIngredientData),
						});

						expect(response.status).toBe(201);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.data.id).toBe(456);

						// Verify insert with null values handled correctly
						expect(mockExecute).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO ingredients'), [
							'Minimal Ingredient',
							false, // fresh
							null, // price
							null, // stockcode
							null, // supermarketCategoryId
							null, // pantryCategoryId
							mockRegularUser.household_id,
						]);
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});

			it('should trim whitespace from ingredient name', async () => {
				const mockCreatedIngredient = {
					id: 789,
					name: 'Whitespace Ingredient',
					fresh: 1,
					price: 2.99,
					stockcode: 12345,
					supermarketCategoryId: 1,
					pantryCategoryId: 2,
					household_id: mockRegularUser.household_id,
					created_at: '2024-01-01T12:00:00Z',
				};

				mockExecute
					.mockResolvedValueOnce([[], []]) // No existing ingredient
					.mockResolvedValueOnce([{ insertId: 789, affectedRows: 1 }, []]) // Insert successful
					.mockResolvedValueOnce([[mockCreatedIngredient], []]); // Fetch created ingredient

				const ingredientWithWhitespace = {
					...validIngredientData,
					name: '  Whitespace Ingredient  ',
				};

				const request = createAuthenticatedRequest(ingredientWithWhitespace);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(ingredientWithWhitespace),
						});

						expect(response.status).toBe(201);

						// Verify name is trimmed in both check and insert
						expect(mockExecute).toHaveBeenNthCalledWith(1, 'SELECT id FROM ingredients WHERE name = ? AND household_id = ?', [
							'Whitespace Ingredient',
							mockRegularUser.household_id,
						]);

						expect(mockExecute).toHaveBeenNthCalledWith(
							2,
							expect.stringContaining('INSERT INTO ingredients'),
							expect.arrayContaining(['Whitespace Ingredient'])
						);
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});

			it('should set public flag to 0 for household-owned ingredients', async () => {
				const mockCreatedIngredient = {
					id: 999,
					name: 'Test Ingredient',
					fresh: 1,
					price: 2.99,
					stockcode: 12345,
					supermarketCategoryId: 1,
					pantryCategoryId: 2,
					household_id: mockRegularUser.household_id,
					created_at: '2024-01-01T12:00:00Z',
				};

				mockExecute
					.mockResolvedValueOnce([[], []]) // No existing ingredient
					.mockResolvedValueOnce([{ insertId: 999, affectedRows: 1 }, []]) // Insert successful
					.mockResolvedValueOnce([[mockCreatedIngredient], []]); // Fetch created ingredient

				const request = createAuthenticatedRequest(validIngredientData);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(validIngredientData),
						});

						expect(response.status).toBe(201);

						// Verify SQL includes public = 0
						expect(mockExecute).toHaveBeenNthCalledWith(
							2,
							'INSERT INTO ingredients \n\t\t\t (name, fresh, cost, stockcode, supermarketCategory_id, pantryCategory_id, public, household_id) \n\t\t\t VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
							expect.arrayContaining([expect.any(String), expect.any(Boolean), expect.any(Number)])
						);
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});
		});

		describe('Validation errors', () => {
			it('should return 400 when name is missing', async () => {
				const ingredientWithoutName: Partial<typeof validIngredientData> = { ...validIngredientData };
				delete ingredientWithoutName.name;

				const request = createAuthenticatedRequest(ingredientWithoutName);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(ingredientWithoutName),
						});

						expect(response.status).toBe(400);
						const data = await response.json();

						expect(data).toEqual({
							success: false,
							error: 'Ingredient name is required',
							code: 'VALIDATION_ERROR',
							details: [
								{
									field: 'name',
									code: 'REQUIRED',
									message: 'Ingredient name is required',
								},
							],
						});

						// Should not call database
						expect(mockExecute).not.toHaveBeenCalled();
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});

			it('should return 400 when name is empty string', async () => {
				const ingredientWithEmptyName = {
					...validIngredientData,
					name: '',
				};

				const request = createAuthenticatedRequest(ingredientWithEmptyName);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(ingredientWithEmptyName),
						});

						expect(response.status).toBe(400);
						const data = await response.json();

						expect(data).toEqual({
							success: false,
							error: 'Ingredient name is required',
							code: 'VALIDATION_ERROR',
							details: [
								{
									field: 'name',
									code: 'REQUIRED',
									message: 'Ingredient name is required',
								},
							],
						});
						expect(mockExecute).not.toHaveBeenCalled();
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});

			it('should return 400 when name is only whitespace', async () => {
				const ingredientWithWhitespaceOnlyName = {
					...validIngredientData,
					name: '   \t\n   ',
				};

				const request = createAuthenticatedRequest(ingredientWithWhitespaceOnlyName);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(ingredientWithWhitespaceOnlyName),
						});

						expect(response.status).toBe(400);
						const data = await response.json();

						expect(data).toEqual({
							success: false,
							error: 'Ingredient name cannot be empty',
							code: 'VALIDATION_ERROR',
							details: [
								{
									field: 'name',
									code: 'REQUIRED',
									message: 'Ingredient name cannot be empty',
								},
							],
						});
						expect(mockExecute).not.toHaveBeenCalled();
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});

			it('should return 409 when ingredient already exists in household', async () => {
				// Mock existing ingredient found
				mockExecute.mockResolvedValueOnce([[{ id: 555 }], []]);

				const request = createAuthenticatedRequest(validIngredientData);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(validIngredientData),
						});

						expect(response.status).toBe(409);
						const data = await response.json();

						expect(data).toEqual({
							success: false,
							error: 'An ingredient with this name already exists in your household',
							code: 'DUPLICATE_RESOURCE',
							details: {
								field: 'name',
								value: 'Test Ingredient',
								existingId: 555,
							},
						});

						// Should check for existing but not attempt insert
						expect(mockExecute).toHaveBeenCalledTimes(1);
						expect(mockExecute).toHaveBeenCalledWith('SELECT id FROM ingredients WHERE name = ? AND household_id = ?', [
							'Test Ingredient',
							mockRegularUser.household_id,
						]);
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});
		});

		describe('Household isolation', () => {
			it('should only check for duplicates within the same household', async () => {
				const mockCreatedIngredient = {
					id: 777,
					name: 'Common Ingredient Name',
					fresh: 1,
					price: 1.99,
					stockcode: null,
					supermarketCategoryId: null,
					pantryCategoryId: null,
					household_id: mockRegularUser.household_id,
					created_at: '2024-01-01T12:00:00Z',
				};

				// Mock that ingredient exists in another household but not in user's household
				mockExecute
					.mockResolvedValueOnce([[], []]) // No ingredient found in user's household
					.mockResolvedValueOnce([{ insertId: 777, affectedRows: 1 }, []]) // Insert successful
					.mockResolvedValueOnce([[mockCreatedIngredient], []]); // Fetch created ingredient

				const request = createAuthenticatedRequest({
					name: 'Common Ingredient Name',
					fresh: true,
					price: 1.99,
					stockcode: null,
					supermarketCategoryId: null,
					pantryCategoryId: null,
				});

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								name: 'Common Ingredient Name',
								fresh: true,
								price: 1.99,
								stockcode: null,
								supermarketCategoryId: null,
								pantryCategoryId: null,
							}),
						});

						expect(response.status).toBe(201);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.data.id).toBe(777);

						// Verify household isolation in duplicate check
						expect(mockExecute).toHaveBeenNthCalledWith(1, 'SELECT id FROM ingredients WHERE name = ? AND household_id = ?', [
							'Common Ingredient Name',
							mockRegularUser.household_id,
						]);

						// Verify household_id is set correctly in insert
						expect(mockExecute).toHaveBeenNthCalledWith(
							2,
							expect.stringContaining('INSERT INTO ingredients'),
							expect.arrayContaining([mockRegularUser.household_id])
						);
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});

			it('should assign ingredient to authenticated user household', async () => {
				const mockCreatedIngredient = {
					id: 888,
					name: 'Test Ingredient',
					fresh: 1,
					price: 2.99,
					stockcode: 12345,
					supermarketCategoryId: 1,
					pantryCategoryId: 2,
					household_id: 99,
					created_at: '2024-01-01T12:00:00Z',
				};

				mockExecute
					.mockResolvedValueOnce([[], []]) // No existing ingredient
					.mockResolvedValueOnce([{ insertId: 888, affectedRows: 1 }, []]) // Insert successful
					.mockResolvedValueOnce([[mockCreatedIngredient], []]); // Fetch created ingredient

				// Create request with different household_id to test isolation
				const request = createAuthenticatedRequest(validIngredientData);
				const customUser = { ...mockRegularUser, household_id: 99 };
				(request as NextRequest & { user: typeof customUser; household_id: number }).user = customUser;
				(request as NextRequest & { user: typeof customUser; household_id: number }).household_id = 99;

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(validIngredientData),
						});

						expect(response.status).toBe(201);

						// Verify correct household_id used in both operations
						expect(mockExecute).toHaveBeenNthCalledWith(1, 'SELECT id FROM ingredients WHERE name = ? AND household_id = ?', ['Test Ingredient', 99]);

						expect(mockExecute).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO ingredients'), expect.arrayContaining([99]));
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});
		});

		describe('Error handling', () => {
			it('should handle database connection failure during duplicate check', async () => {
				mockExecute.mockRejectedValueOnce(standardErrorScenarios.databaseError);

				const request = createAuthenticatedRequest(validIngredientData);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(validIngredientData),
						});

						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data).toEqual({
							success: false,
							error: 'An internal server error occurred. Please try again later.',
							code: 'INTERNAL_ERROR',
						});
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});

			it('should handle database connection failure during insert', async () => {
				mockExecute
					.mockResolvedValueOnce([[], []]) // Duplicate check succeeds
					.mockRejectedValueOnce(new Error('Insert failed')); // Insert fails

				const request = createAuthenticatedRequest(validIngredientData);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(validIngredientData),
						});

						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data).toEqual({
							success: false,
							error: 'An internal server error occurred. Please try again later.',
							code: 'INTERNAL_ERROR',
						});
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});

			it('should handle invalid JSON request body', async () => {
				const request = new NextRequest('http://localhost:3000/api/ingredients/add', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: 'invalid json{',
				});

				(request as NextRequest & { user: typeof mockRegularUser; household_id: number }).user = mockRegularUser;
				(request as NextRequest & { user: typeof mockRegularUser; household_id: number }).household_id = mockRegularUser.household_id;

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: 'invalid json{',
						});

						expect(response.status).toBe(400);
						const data = await response.json();

						expect(data).toEqual({
							success: false,
							error: 'Invalid JSON in request body',
							code: 'INVALID_JSON',
						});

						// Should not call database on JSON parse error
						expect(mockExecute).not.toHaveBeenCalled();
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});

			it('should handle generic error gracefully', async () => {
				mockExecute.mockResolvedValueOnce([[], []]).mockRejectedValueOnce(new Error('Unexpected error'));

				const request = createAuthenticatedRequest(validIngredientData);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(validIngredientData),
						});

						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data).toEqual({
							success: false,
							error: 'An internal server error occurred. Please try again later.',
							code: 'INTERNAL_ERROR',
						});
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});

			it('should handle non-Error exceptions', async () => {
				mockExecute.mockResolvedValueOnce([[], []]).mockRejectedValueOnce('String error'); // Non-Error object

				const request = createAuthenticatedRequest(validIngredientData);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(validIngredientData),
						});

						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data).toEqual({
							success: false,
							error: 'An internal server error occurred. Please try again later.',
							code: 'INTERNAL_ERROR',
						});
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});
		});

		describe('Authentication integration', () => {
			it('should require authentication', async () => {
				// Create request without authentication
				const request = new NextRequest('http://localhost:3000/api/ingredients/add', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(validIngredientData),
				});
				// Don't set user property - this simulates unauthenticated request

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(validIngredientData),
						});

						expect(response.status).toBe(401);
						const data = await response.json();

						expect(data).toEqual({
							success: false,
							error: 'Authentication required',
							code: 'UNAUTHORIZED',
						});

						// Should not call database without authentication
						expect(mockExecute).not.toHaveBeenCalled();
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});

			it('should use household_id from auth middleware', async () => {
				const mockCreatedIngredient = {
					id: 111,
					name: 'Test Ingredient',
					fresh: 1,
					price: 2.99,
					stockcode: 12345,
					supermarketCategoryId: 1,
					pantryCategoryId: 2,
					household_id: mockRegularUser.household_id,
					created_at: '2024-01-01T12:00:00Z',
				};

				mockExecute
					.mockResolvedValueOnce([[], []]) // No existing ingredient
					.mockResolvedValueOnce([{ insertId: 111, affectedRows: 1 }, []]) // Insert successful
					.mockResolvedValueOnce([[mockCreatedIngredient], []]); // Fetch created ingredient

				// Test that household_id comes from auth middleware
				const request = createAuthenticatedRequest(validIngredientData);
				// Verify the middleware sets household_id
				expect((request as NextRequest & { household_id: number }).household_id).toBe(mockRegularUser.household_id);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(validIngredientData),
						});

						expect(response.status).toBe(201);

						// Verify household_id from middleware is used
						expect(mockExecute).toHaveBeenNthCalledWith(1, 'SELECT id FROM ingredients WHERE name = ? AND household_id = ?', [
							'Test Ingredient',
							mockRegularUser.household_id,
						]);

						expect(mockExecute).toHaveBeenNthCalledWith(
							2,
							expect.stringContaining('INSERT INTO ingredients'),
							expect.arrayContaining([mockRegularUser.household_id])
						);
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});
		});

		describe('Enhanced validation tests', () => {
			it('should validate data types comprehensively', async () => {
				const invalidData = {
					name: 123, // Should be string
					fresh: 'yes', // Should be boolean
					price: 'expensive', // Should be number or null
					stockcode: 'ABC123', // Should be number or null
					supermarketCategoryId: 'produce', // Should be number or null
					pantryCategoryId: true, // Should be number or null
				};

				const request = createAuthenticatedRequest(invalidData);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(invalidData),
						});

						expect(response.status).toBe(400);
						const data = await response.json();

						expect(data).toEqual({
							success: false,
							error: 'Invalid input data',
							code: 'VALIDATION_ERROR',
							details: expect.arrayContaining([
								expect.objectContaining({
									field: 'name',
									code: 'INVALID_TYPE',
									message: 'Name must be a string',
								}),
								expect.objectContaining({
									field: 'fresh',
									code: 'INVALID_TYPE',
									message: 'Fresh must be a boolean',
								}),
								expect.objectContaining({
									field: 'price',
									code: 'INVALID_TYPE',
									message: 'Price must be a number or null',
								}),
							]),
						});

						expect(mockExecute).not.toHaveBeenCalled();
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});

			it('should validate string length limits', async () => {
				const dataWithLongName = {
					...validIngredientData,
					name: 'A'.repeat(300), // Exceeds 255 char limit
				};

				const request = createAuthenticatedRequest(dataWithLongName);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(dataWithLongName),
						});

						expect(response.status).toBe(400);
						const data = await response.json();

						expect(data).toEqual({
							success: false,
							error: 'Ingredient name cannot exceed 255 characters',
							code: 'VALIDATION_ERROR',
							details: [
								{
									field: 'name',
									code: 'MAX_LENGTH_EXCEEDED',
									message: 'Ingredient name cannot exceed 255 characters',
									maxLength: 255,
									actualLength: 300,
								},
							],
						});
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});

			it('should validate numeric ranges', async () => {
				const dataWithInvalidNumbers = {
					...validIngredientData,
					price: -10.5, // Negative price should be invalid
					supermarketCategoryId: 0, // Should be > 0
					pantryCategoryId: -5, // Should be > 0
				};

				const request = createAuthenticatedRequest(dataWithInvalidNumbers);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(dataWithInvalidNumbers),
						});

						expect(response.status).toBe(400);
						const data = await response.json();

						expect(data).toEqual({
							success: false,
							error: 'Invalid input data',
							code: 'VALIDATION_ERROR',
							details: expect.arrayContaining([
								expect.objectContaining({
									field: 'price',
									code: 'OUT_OF_RANGE',
									message: 'Price must be greater than or equal to 0',
								}),
								expect.objectContaining({
									field: 'supermarketCategoryId',
									code: 'OUT_OF_RANGE',
									message: 'Supermarket category ID must be greater than 0',
								}),
								expect.objectContaining({
									field: 'pantryCategoryId',
									code: 'OUT_OF_RANGE',
									message: 'Pantry category ID must be greater than 0',
								}),
							]),
						});
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});

			it('should validate required fresh field', async () => {
				const dataWithoutFresh = {
					name: 'Test Ingredient',
					price: 2.99,
					// fresh is missing
				};

				const request = createAuthenticatedRequest(dataWithoutFresh);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(dataWithoutFresh),
						});

						expect(response.status).toBe(400);
						const data = await response.json();

						expect(data).toEqual({
							success: false,
							error: 'Fresh status is required',
							code: 'VALIDATION_ERROR',
							details: [
								{
									field: 'fresh',
									code: 'REQUIRED',
									message: 'Fresh status is required',
								},
							],
						});
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});
		});

		describe('Data type handling', () => {
			it('should handle boolean fresh field correctly', async () => {
				const mockCreatedIngredient = {
					id: 222,
					name: 'Test Ingredient',
					fresh: 0,
					price: 2.99,
					stockcode: 12345,
					supermarketCategoryId: 1,
					pantryCategoryId: 2,
					household_id: mockRegularUser.household_id,
					created_at: '2024-01-01T12:00:00Z',
				};

				mockExecute
					.mockResolvedValueOnce([[], []]) // No existing ingredient
					.mockResolvedValueOnce([{ insertId: 222, affectedRows: 1 }, []]) // Insert successful
					.mockResolvedValueOnce([[mockCreatedIngredient], []]); // Fetch created ingredient

				const ingredientWithFreshFalse = {
					...validIngredientData,
					fresh: false,
				};

				const request = createAuthenticatedRequest(ingredientWithFreshFalse);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(ingredientWithFreshFalse),
						});

						expect(response.status).toBe(201);

						// Verify boolean false is passed correctly
						expect(mockExecute).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO ingredients'), expect.arrayContaining([false]));
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});

			it('should handle numeric fields correctly', async () => {
				const mockCreatedIngredient = {
					id: 333,
					name: 'Test Ingredient',
					fresh: 1,
					price: 99.99,
					stockcode: 9876543210,
					supermarketCategoryId: 5,
					pantryCategoryId: 3,
					household_id: mockRegularUser.household_id,
					created_at: '2024-01-01T12:00:00Z',
				};

				mockExecute
					.mockResolvedValueOnce([[], []]) // No existing ingredient
					.mockResolvedValueOnce([{ insertId: 333, affectedRows: 1 }, []]) // Insert successful
					.mockResolvedValueOnce([[mockCreatedIngredient], []]); // Fetch created ingredient

				const ingredientWithNumbers = {
					...validIngredientData,
					price: 99.99,
					stockcode: 9876543210,
					supermarketCategoryId: 5,
					pantryCategoryId: 3,
				};

				const request = createAuthenticatedRequest(ingredientWithNumbers);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(ingredientWithNumbers),
						});

						expect(response.status).toBe(201);

						// Verify numeric values are passed correctly
						expect(mockExecute).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO ingredients'), [
							'Test Ingredient',
							true,
							99.99,
							9876543210,
							5,
							3,
							mockRegularUser.household_id,
						]);
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});

			it('should handle null values correctly', async () => {
				const mockCreatedIngredient = {
					id: 444,
					name: 'Null Values Test',
					fresh: 0,
					price: null,
					stockcode: null,
					supermarketCategoryId: null,
					pantryCategoryId: null,
					household_id: mockRegularUser.household_id,
					created_at: '2024-01-01T12:00:00Z',
				};

				mockExecute
					.mockResolvedValueOnce([[], []]) // No existing ingredient
					.mockResolvedValueOnce([{ insertId: 444, affectedRows: 1 }, []]) // Insert successful
					.mockResolvedValueOnce([[mockCreatedIngredient], []]); // Fetch created ingredient

				const ingredientWithNulls = {
					name: 'Null Values Test',
					fresh: false,
					price: null,
					stockcode: null,
					supermarketCategoryId: null,
					pantryCategoryId: null,
				};

				const request = createAuthenticatedRequest(ingredientWithNulls);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(ingredientWithNulls),
						});

						expect(response.status).toBe(201);

						// Verify null values are passed correctly
						expect(mockExecute).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO ingredients'), [
							'Null Values Test',
							false,
							null,
							null,
							null,
							null,
							mockRegularUser.household_id,
						]);
					},
					requestPatcher: req => Object.assign(req, request),
				});
			});
		});
	});
});
