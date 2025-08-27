/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { setupConsoleMocks, mockAuthenticatedUser, mockNonAuthenticatedUser, createMockFile } from '@/lib/test-utils';
import { RowDataPacket } from 'mysql2';

// Mock OpenAI
const mockOpenAICreate = jest.fn();
jest.mock('openai', () => {
	return jest.fn().mockImplementation(() => ({
		chat: {
			completions: {
				create: mockOpenAICreate,
			},
		},
	}));
});

// Mock database
jest.mock('@/lib/db.js', () => ({
	execute: jest.fn(),
}));

// Mock auth middleware
jest.mock('@/lib/auth-middleware', () => jest.requireActual('@/lib/test-utils').authMiddlewareMock);

// Get mocked functions
const mockExecute = jest.mocked(jest.requireMock('@/lib/db.js').execute);

// Sample data interfaces for tests
interface MockExistingIngredient extends RowDataPacket {
	id: number;
	name: string;
	fresh: number;
	pantryCategory_id: number;
	supermarketCategory_id: number;
	pantryCategory_name: string;
}

interface MockCategory extends RowDataPacket {
	id: number;
	name: string;
}

describe('/api/recipe/ai-preview', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;
	let originalApiKey: string | undefined;

	beforeEach(() => {
		// Save original API key to avoid test interference
		originalApiKey = process.env.OPENAI_API_KEY;

		// Set default API key for all tests (individual tests can override)
		process.env.OPENAI_API_KEY = 'test-key';

		// Clear mock calls and return values
		jest.clearAllMocks();
		mockOpenAICreate.mockClear();
		mockOpenAICreate.mockReset(); // Reset mock implementation and return values
		mockExecute.mockClear();
		mockExecute.mockReset(); // Reset mock implementation and return values

		consoleMocks = setupConsoleMocks();
	});

	afterEach(() => {
		// Restore original API key after each test
		if (originalApiKey !== undefined) {
			process.env.OPENAI_API_KEY = originalApiKey;
		} else {
			delete process.env.OPENAI_API_KEY;
		}
	});

	afterAll(() => {
		consoleMocks.cleanup();
	});

	// Test data
	const mockRecipeResponse = {
		title: 'Test Recipe',
		description: 'A delicious test recipe',
		prepTime: 15,
		cookTime: 30,
		servings: 4,
		season: 'Summer',
		seasonReason: 'Fresh ingredients are in season',
		primaryType: 'Chicken',
		secondaryType: 'Rice',
		hasHeroImage: false,
		ingredients: [
			{
				name: 'Chicken Breast',
				quantity_2_servings: '200',
				quantity_4_servings: '400',
				unit: 'gram',
				supermarketCategory: 'meat',
				pantryCategory: 'fridge',
			},
			{
				name: 'Rice',
				quantity_2_servings: '0.5',
				quantity_4_servings: '1',
				unit: 'cup',
				supermarketCategory: 'center aisles',
				pantryCategory: 'pantry',
			},
		],
	};

	const mockExistingIngredients: MockExistingIngredient[] = [
		{
			id: 1,
			name: 'Chicken Breast',
			fresh: 1,
			pantryCategory_id: 1,
			supermarketCategory_id: 1,
			pantryCategory_name: 'Fridge',
		} as MockExistingIngredient,
		{
			id: 2,
			name: 'Brown Rice',
			fresh: 0,
			pantryCategory_id: 2,
			supermarketCategory_id: 2,
			pantryCategory_name: 'Pantry',
		} as MockExistingIngredient,
	];

	const mockPantryCategories: MockCategory[] = [
		{ id: 1, name: 'fridge' } as MockCategory,
		{ id: 2, name: 'pantry' } as MockCategory,
		{ id: 3, name: 'kitchen cupboard' } as MockCategory,
	];

	const mockSupermarketCategories: MockCategory[] = [
		{ id: 1, name: 'meat' } as MockCategory,
		{ id: 2, name: 'center aisles' } as MockCategory,
		{ id: 3, name: 'dairy' } as MockCategory,
	];

	const mockAIMatchingResponse = [
		{ original: 'Chicken Breast', matched: 'Chicken Breast' },
		{ original: 'Rice', matched: 'Brown Rice' },
	];

	describe('Authentication Tests', () => {
		it('should return 401 for unauthenticated requests', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockNonAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(401);
					const data = await response.json();
					expect(data).toEqual({
						success: false,
						error: 'Authentication required',
						code: 'UNAUTHORIZED',
					});
				},
			});
		});

		it('should proceed with authenticated requests', async () => {
			// Mock OpenAI API key not configured to test early auth check
			const originalApiKey = process.env.OPENAI_API_KEY;
			delete process.env.OPENAI_API_KEY;

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data.error).toBe('OpenAI API key not configured');
				},
			});

			// Restore API key
			if (originalApiKey) {
				process.env.OPENAI_API_KEY = originalApiKey;
			}
		});
	});

	describe('Input Validation Tests', () => {
		it('should return 500 when OpenAI API key is not configured', async () => {
			delete process.env.OPENAI_API_KEY;

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data.error).toBe('OpenAI API key not configured');
				},
			});
		});

		it('should return 400 when no image files are provided', async () => {
			process.env.OPENAI_API_KEY = 'test-key';
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('At least one image file is required');
				},
			});
		});

		it('should return 400 when form data contains no image files', async () => {
			process.env.OPENAI_API_KEY = 'test-key';
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('text', 'some text data');

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(400);
					const data = await response.json();
					expect(data.error).toBe('At least one image file is required');
				},
			});
		});

		it('should accept multiple image files', async () => {
			process.env.OPENAI_API_KEY = 'test-key';
			mockOpenAICreate.mockRejectedValueOnce(new Error('OpenAI test error'));

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test1.jpg', 'image/jpeg'));
					formData.append('image1', createMockFile('test2.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					// Should get to OpenAI call (which fails in this test)
					expect(response.status).toBe(500);
					expect(mockOpenAICreate).toHaveBeenCalledTimes(1);
				},
			});
		});
	});

	describe('OpenAI Integration Tests', () => {
		it('should successfully extract recipe from OpenAI', async () => {
			process.env.OPENAI_API_KEY = 'test-key';
			mockOpenAICreate
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockRecipeResponse),
							},
						},
					],
				})
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockAIMatchingResponse),
							},
						},
					],
				});

			mockExecute
				.mockResolvedValueOnce([mockExistingIngredients, []])
				.mockResolvedValueOnce([mockPantryCategories, []])
				.mockResolvedValueOnce([mockSupermarketCategories, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.success).toBe(true);
					expect(data.recipe.title).toBe('Test Recipe');
					expect(data.recipe.ingredients).toHaveLength(2);
				},
			});
		});

		it('should handle OpenAI API error gracefully', async () => {
			process.env.OPENAI_API_KEY = 'test-key';
			mockOpenAICreate.mockRejectedValueOnce(new Error('OpenAI API rate limit exceeded'));

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data.error).toContain('OpenAI API rate limit exceeded');
				},
			});
		});

		it('should handle invalid JSON response from OpenAI', async () => {
			process.env.OPENAI_API_KEY = 'test-key';
			mockOpenAICreate.mockResolvedValueOnce({
				choices: [
					{
						message: {
							content: 'Invalid JSON response {',
						},
					},
				],
			});

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data.error).toContain('Unexpected token');
				},
			});
		});

		it('should handle no content from OpenAI', async () => {
			process.env.OPENAI_API_KEY = 'test-key';
			mockOpenAICreate.mockResolvedValueOnce({
				choices: [
					{
						message: {
							content: null,
						},
					},
				],
			});

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data.error).toBe('No content received from OpenAI');
				},
			});
		});

		it('should clean markdown code blocks from OpenAI response', async () => {
			process.env.OPENAI_API_KEY = 'test-key';
			mockOpenAICreate
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: '```json\n' + JSON.stringify(mockRecipeResponse) + '\n```',
							},
						},
					],
				})
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockAIMatchingResponse),
							},
						},
					],
				});

			mockExecute
				.mockResolvedValueOnce([mockExistingIngredients, []])
				.mockResolvedValueOnce([mockPantryCategories, []])
				.mockResolvedValueOnce([mockSupermarketCategories, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.success).toBe(true);
					expect(data.recipe.title).toBe('Test Recipe');
				},
			});
		});

		it('should handle AI matching failure gracefully', async () => {
			process.env.OPENAI_API_KEY = 'test-key';
			mockOpenAICreate
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockRecipeResponse),
							},
						},
					],
				})
				.mockRejectedValueOnce(new Error('AI matching failed'));

			mockExecute
				.mockResolvedValueOnce([mockExistingIngredients, []])
				.mockResolvedValueOnce([mockPantryCategories, []])
				.mockResolvedValueOnce([mockSupermarketCategories, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.success).toBe(true);
					// Should still work with fallback exact matching
					expect(data.recipe.ingredients).toHaveLength(2);
				},
			});
		});
	});

	describe('Household-Scoped Database Query Tests', () => {
		beforeEach(() => {
			mockOpenAICreate
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockRecipeResponse),
							},
						},
					],
				})
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockAIMatchingResponse),
							},
						},
					],
				});
		});

		it('should execute household-scoped ingredients query', async () => {
			process.env.OPENAI_API_KEY = 'test-key';
			mockExecute
				.mockResolvedValueOnce([mockExistingIngredients, []])
				.mockResolvedValueOnce([mockPantryCategories, []])
				.mockResolvedValueOnce([mockSupermarketCategories, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					await fetch({
						method: 'POST',
						body: formData,
					});

					// Check the complex household-scoped query was called
					expect(mockExecute).toHaveBeenNthCalledWith(
						1,
						expect.stringContaining('SELECT DISTINCT'),
						[1, 1, 1, 1, 1] // household_id repeated 5 times
					);

					// Verify the query includes household filtering
					const sqlQuery = mockExecute.mock.calls[0][0];
					expect(sqlQuery).toContain('i.household_id = ?');
					expect(sqlQuery).toContain('c.id = 1'); // Spencer's essentials
					expect(sqlQuery).toContain('cs.household_id IS NOT NULL'); // Subscribed collections
					expect(sqlQuery).toContain('LOWER(i2.name) = LOWER(i.name)'); // Name-based duplicate removal
				},
			});
		});

		it("should include Spencer's essentials (collection_id=1)", async () => {
			process.env.OPENAI_API_KEY = 'test-key';
			mockExecute
				.mockResolvedValueOnce([mockExistingIngredients, []])
				.mockResolvedValueOnce([mockPantryCategories, []])
				.mockResolvedValueOnce([mockSupermarketCategories, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					await fetch({
						method: 'POST',
						body: formData,
					});

					const sqlQuery = mockExecute.mock.calls[0][0];
					expect(sqlQuery).toContain('c.id = 1 OR');
				},
			});
		});

		it('should handle empty ingredient results', async () => {
			process.env.OPENAI_API_KEY = 'test-key';
			mockExecute
				.mockResolvedValueOnce([[], []]) // No ingredients found
				.mockResolvedValueOnce([mockPantryCategories, []])
				.mockResolvedValueOnce([mockSupermarketCategories, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(200);
					const data = await response.json();
					expect(data.success).toBe(true);
					// Should still process with no existing ingredients to match against
					expect(data.recipe.ingredients).toHaveLength(2);
				},
			});
		});

		it('should fetch pantry and supermarket categories', async () => {
			process.env.OPENAI_API_KEY = 'test-key';

			// Mock OpenAI calls that will happen during the route execution
			mockOpenAICreate
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockRecipeResponse),
							},
						},
					],
				})
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockAIMatchingResponse),
							},
						},
					],
				});

			mockExecute
				.mockResolvedValueOnce([mockExistingIngredients, []])
				.mockResolvedValueOnce([mockPantryCategories, []])
				.mockResolvedValueOnce([mockSupermarketCategories, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(200);
					const data = await response.json();

					expect(mockExecute).toHaveBeenNthCalledWith(2, 'SELECT id, name FROM category_pantry ORDER BY name');
					expect(mockExecute).toHaveBeenNthCalledWith(3, 'SELECT id, name FROM category_supermarket ORDER BY name');

					expect(data.categories.pantryCategories).toHaveLength(3);
					expect(data.categories.supermarketCategories).toHaveLength(3);
				},
			});
		});

		it('should handle database query failure', async () => {
			mockExecute.mockRejectedValueOnce(new Error('Database connection failed'));

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data.error).toContain('Database connection failed');
				},
			});
		});
	});

	describe('Ingredient Processing Logic Tests', () => {
		it('should match existing ingredients correctly', async () => {
			process.env.OPENAI_API_KEY = 'test-key';
			mockOpenAICreate
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockRecipeResponse),
							},
						},
					],
				})
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockAIMatchingResponse),
							},
						},
					],
				});

			mockExecute
				.mockResolvedValueOnce([mockExistingIngredients, []])
				.mockResolvedValueOnce([mockPantryCategories, []])
				.mockResolvedValueOnce([mockSupermarketCategories, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(200);
					const data = await response.json();

					// First ingredient should match "Chicken Breast"
					expect(data.recipe.ingredients[0].existing_ingredient_id).toBe(1);
					expect(data.recipe.ingredients[0].pantryCategory_id).toBe(1);

					// Second ingredient should match "Brown Rice" (AI mapped "Rice" to "Brown Rice")
					expect(data.recipe.ingredients[1].existing_ingredient_id).toBe(2);
					expect(data.recipe.ingredients[1].pantryCategory_id).toBe(2);
				},
			});
		});

		it('should handle case-insensitive matching', async () => {
			const caseTestIngredients: MockExistingIngredient[] = [
				{
					id: 1,
					name: 'CHICKEN BREAST', // Uppercase in database
					fresh: 1,
					pantryCategory_id: 1,
					supermarketCategory_id: 1,
					pantryCategory_name: 'Fridge',
				} as MockExistingIngredient,
			];

			// Need both OpenAI calls - first for recipe extraction, then for matching
			mockOpenAICreate
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockRecipeResponse),
							},
						},
					],
				})
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify([{ original: 'Chicken Breast', matched: 'CHICKEN BREAST' }]),
							},
						},
					],
				});

			mockExecute
				.mockResolvedValueOnce([caseTestIngredients, []])
				.mockResolvedValueOnce([mockPantryCategories, []])
				.mockResolvedValueOnce([mockSupermarketCategories, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(200);
					const data = await response.json();

					// Should match despite case differences
					expect(data.recipe.ingredients[0].existing_ingredient_id).toBe(1);
					expect(data.recipe.ingredients[0].name).toBe('CHICKEN BREAST'); // Uses database name
				},
			});
		});

		it('should process new ingredients with AI category recommendations', async () => {
			const noMatchResponse = [
				{ original: 'Chicken Breast', matched: null },
				{ original: 'Rice', matched: null },
			];

			// Need both OpenAI calls - first for recipe extraction, then for matching
			mockOpenAICreate
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockRecipeResponse),
							},
						},
					],
				})
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(noMatchResponse),
							},
						},
					],
				});

			mockExecute
				.mockResolvedValueOnce([[], []]) // No existing ingredients
				.mockResolvedValueOnce([mockPantryCategories, []])
				.mockResolvedValueOnce([mockSupermarketCategories, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(200);
					const data = await response.json();

					// Both should be new ingredients
					expect(data.recipe.ingredients[0].existing_ingredient_id).toBeUndefined();
					expect(data.recipe.ingredients[1].existing_ingredient_id).toBeUndefined();

					// Should have category IDs from AI recommendations
					expect(data.recipe.ingredients[0].pantryCategory_id).toBe(1); // 'fridge' category
					expect(data.recipe.ingredients[0].supermarketCategory_id).toBe(1); // 'meat' category

					expect(data.recipe.ingredients[1].pantryCategory_id).toBe(2); // 'pantry' category
					expect(data.recipe.ingredients[1].supermarketCategory_id).toBe(2); // 'center aisles' category
				},
			});
		});

		it('should fallback to default categories when AI categories not found', async () => {
			process.env.OPENAI_API_KEY = 'test-key';
			const recipeWithBadCategories = {
				...mockRecipeResponse,
				ingredients: [
					{
						name: 'Exotic Spice',
						quantity_2_servings: '1',
						quantity_4_servings: '2',
						unit: 'tsp',
						supermarketCategory: 'nonexistent category',
						pantryCategory: 'another nonexistent category',
					},
				],
			};

			mockOpenAICreate
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(recipeWithBadCategories),
							},
						},
					],
				})
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify([{ original: 'Exotic Spice', matched: null }]),
							},
						},
					],
				});

			mockExecute
				.mockResolvedValueOnce([[], []]) // No existing ingredients
				.mockResolvedValueOnce([mockPantryCategories, []])
				.mockResolvedValueOnce([mockSupermarketCategories, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(200);
					const data = await response.json();

					// Should fallback to first available categories
					expect(data.recipe.ingredients[0].pantryCategory_id).toBe(1); // First pantry category
					expect(data.recipe.ingredients[0].supermarketCategory_id).toBe(1); // First supermarket category
				},
			});
		});
	});

	describe('Response Format Tests', () => {
		beforeEach(() => {
			process.env.OPENAI_API_KEY = 'test-key';
			mockOpenAICreate
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockRecipeResponse),
							},
						},
					],
				})
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockAIMatchingResponse),
							},
						},
					],
				});

			mockExecute
				.mockResolvedValueOnce([mockExistingIngredients, []])
				.mockResolvedValueOnce([mockPantryCategories, []])
				.mockResolvedValueOnce([mockSupermarketCategories, []]);
		});

		it('should return correct response structure', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(200);
					const data = await response.json();

					// Check top-level structure
					expect(data).toHaveProperty('success', true);
					expect(data).toHaveProperty('recipe');
					expect(data).toHaveProperty('categories');

					// Check recipe structure
					expect(data.recipe).toHaveProperty('title');
					expect(data.recipe).toHaveProperty('description');
					expect(data.recipe).toHaveProperty('ingredients');
					expect(data.recipe).toHaveProperty('serves'); // Note: mapped from servings

					// Check categories structure
					expect(data.categories).toHaveProperty('pantryCategories');
					expect(data.categories).toHaveProperty('supermarketCategories');
				},
			});
		});

		it('should preserve all OpenAI extracted data', async () => {
			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(200);
					const data = await response.json();

					expect(data.recipe.title).toBe('Test Recipe');
					expect(data.recipe.description).toBe('A delicious test recipe');
					expect(data.recipe.prepTime).toBe(15);
					expect(data.recipe.cookTime).toBe(30);
					expect(data.recipe.serves).toBe(4); // servings mapped to serves
					expect(data.recipe.season).toBe('Summer');
					expect(data.recipe.seasonReason).toBe('Fresh ingredients are in season');
					expect(data.recipe.primaryType).toBe('Chicken');
					expect(data.recipe.secondaryType).toBe('Rice');
					expect(data.recipe.hasHeroImage).toBe(false);
				},
			});
		});

		it('should augment ingredients with database information', async () => {
			process.env.OPENAI_API_KEY = 'test-key';

			mockOpenAICreate
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockRecipeResponse),
							},
						},
					],
				})
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockAIMatchingResponse),
							},
						},
					],
				});

			mockExecute
				.mockResolvedValueOnce([mockExistingIngredients, []])
				.mockResolvedValueOnce([mockPantryCategories, []])
				.mockResolvedValueOnce([mockSupermarketCategories, []]);

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(200);
					const data = await response.json();

					const ingredients = data.recipe.ingredients;
					expect(ingredients).toHaveLength(2);

					// Check augmented data for matched ingredients
					expect(ingredients[0]).toHaveProperty('existing_ingredient_id');
					expect(ingredients[0]).toHaveProperty('pantryCategory_id');
					expect(ingredients[0]).toHaveProperty('pantryCategory_name');
					expect(ingredients[0]).toHaveProperty('supermarketCategory_id');
					expect(ingredients[0]).toHaveProperty('fresh');

					// Original AI data should be preserved
					expect(ingredients[0]).toHaveProperty('quantity_2_servings');
					expect(ingredients[0]).toHaveProperty('quantity_4_servings');
					expect(ingredients[0]).toHaveProperty('unit');
				},
			});
		});
	});

	describe('Error Handling Tests', () => {
		beforeEach(() => {
			process.env.OPENAI_API_KEY = 'test-key';
		});

		it('should handle category query failure', async () => {
			mockOpenAICreate
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockRecipeResponse),
							},
						},
					],
				})
				.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockAIMatchingResponse),
							},
						},
					],
				});

			mockExecute.mockResolvedValueOnce([mockExistingIngredients, []]).mockRejectedValueOnce(new Error('Category table not found'));

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data.error).toContain('Category table not found');
				},
			});
		});

		it('should handle generic errors', async () => {
			process.env.OPENAI_API_KEY = 'test-key';
			mockOpenAICreate.mockImplementationOnce(() => {
				throw new Error('Unexpected error occurred');
			});

			await testApiHandler({
				appHandler,
				requestPatcher: mockAuthenticatedUser,
				test: async ({ fetch }) => {
					const formData = new FormData();
					formData.append('image0', createMockFile('test.jpg', 'image/jpeg'));

					const response = await fetch({
						method: 'POST',
						body: formData,
					});

					expect(response.status).toBe(500);
					const data = await response.json();
					expect(data.error).toContain('Unexpected error occurred');
				},
			});
		});
	});
});
