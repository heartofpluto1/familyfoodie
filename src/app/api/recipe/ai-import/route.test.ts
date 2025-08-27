/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';
import * as appHandler from './route';
import { mockAuthenticatedUser, mockNonAuthenticatedUser, clearAllMocks, setupConsoleMocks, createMockFile, MockConnection } from '@/lib/test-utils';

// Mock the auth middleware to properly handle authentication
jest.mock('@/lib/auth-middleware', () => jest.requireActual('@/lib/test-utils').authMiddlewareMock);

// Mock the database pool
const mockConnection: MockConnection = {
	beginTransaction: jest.fn(),
	commit: jest.fn(),
	rollback: jest.fn(),
	release: jest.fn(),
	execute: jest.fn(),
};

jest.mock('@/lib/db.js', () => ({
	getConnection: jest.fn(() => Promise.resolve(mockConnection)),
}));

// Set OpenAI API key before any module imports
process.env.OPENAI_API_KEY = 'test-api-key-12345';

// Mock OpenAI with proper setup
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

// Mock storage utilities
jest.mock('@/lib/storage', () => ({
	uploadFile: jest.fn(),
	getStorageMode: jest.fn(() => 'local'),
}));

// Mock utilities
jest.mock('@/lib/utils/secureFilename', () => ({
	generateVersionedFilename: jest.fn(),
}));

jest.mock('@/lib/utils/urlHelpers', () => ({
	generateSlugFromTitle: jest.fn(),
}));

// Import mocked modules
const mockUploadFile = jest.mocked(jest.requireMock('@/lib/storage').uploadFile);
const mockGenerateVersionedFilename = jest.mocked(jest.requireMock('@/lib/utils/secureFilename').generateVersionedFilename);
const mockGenerateSlugFromTitle = jest.mocked(jest.requireMock('@/lib/utils/urlHelpers').generateSlugFromTitle);

describe('/api/recipe/ai-import', () => {
	let consoleMocks: ReturnType<typeof setupConsoleMocks>;

	// Helper function to create a fresh mock setup for each test
	const setupFreshMocks = () => {
		// Completely reset all mocks to avoid any state leakage
		jest.clearAllMocks();

		// Reset database connection mocks - use mockReset to clear any queued values
		mockConnection.beginTransaction.mockReset().mockResolvedValue();
		mockConnection.commit.mockReset().mockResolvedValue();
		mockConnection.rollback.mockReset().mockResolvedValue();
		mockConnection.release.mockReset().mockImplementation(() => {});
		mockConnection.execute.mockReset().mockResolvedValue([{ insertId: 123, affectedRows: 1 }, []]);

		// Reset utility mocks
		mockGenerateVersionedFilename.mockReset().mockImplementation(() => 'test-filename-abc123.jpg');
		mockGenerateSlugFromTitle.mockReset().mockImplementation((id: number, title: string) => `${id}-${title.toLowerCase().replace(/\s+/g, '-')}`);
		mockUploadFile.mockReset().mockResolvedValue({ success: true, url: 'https://example.com/file.jpg' });

		// Reset OpenAI mock
		mockOpenAICreate.mockReset();
	};

	beforeEach(() => {
		clearAllMocks();
		consoleMocks = setupConsoleMocks();
		setupFreshMocks();
	});

	afterEach(() => {
		consoleMocks.cleanup();
	});

	// Test data
	const mockExtractedRecipe = {
		title: 'Delicious Pasta',
		description: 'A wonderful pasta dish perfect for family dinners',
		prepTime: 15,
		cookTime: 30,
		servings: 4,
		ingredients: [
			{
				name: 'pasta',
				quantity_2_servings: '200',
				quantity_4_servings: '400',
				unit: 'g',
			},
			{
				name: 'tomatoes',
				quantity_2_servings: '2',
				quantity_4_servings: '4',
				unit: 'item',
				existing_ingredient_id: 5,
			},
			{
				name: 'basil',
				quantity_2_servings: '0.5',
				quantity_4_servings: '1',
				unit: 'cup',
				fresh: true,
				pantryCategory_id: 2,
				supermarketCategory_id: 3,
				measureId: 4,
			},
		],
		cuisine: 'Italian',
		difficulty: 'Medium',
		seasonId: 1,
		primaryTypeId: 2,
		secondaryTypeId: 3,
		collectionId: 10,
	};

	const validFormData = () => {
		const formData = new FormData();
		formData.append('pdfFile', createMockFile('recipe.pdf', 'application/pdf', 2048));
		formData.append('heroImage', createMockFile('hero.jpg', 'image/jpeg', 1024));
		formData.append('collectionId', '10'); // Add collection ID for AI path
		return formData;
	};

	const validFormDataWithoutCollection = () => {
		const formData = new FormData();
		formData.append('pdfFile', createMockFile('recipe.pdf', 'application/pdf', 2048));
		formData.append('heroImage', createMockFile('hero.jpg', 'image/jpeg', 1024));
		// No collection ID - for testing early validation
		return formData;
	};

	const validFormDataWithStructuredRecipe = () => {
		const formData = validFormData();
		formData.append('structuredRecipe', JSON.stringify(mockExtractedRecipe));
		return formData;
	};

	describe('POST /api/recipe/ai-import', () => {
		describe('Authentication Tests', () => {
			it('should return 401 for unauthenticated requests', async () => {
				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormData(),
						});

						expect(response.status).toBe(401);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Authentication required',
							code: 'UNAUTHORIZED',
						});

						// Verify no database operations were attempted
						expect(mockConnection.beginTransaction).not.toHaveBeenCalled();
					},
					requestPatcher: mockNonAuthenticatedUser,
				});
			});

			it('should process authenticated requests with proper household context validation', async () => {
				// Setup successful AI response
				mockOpenAICreate.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockExtractedRecipe),
							},
						},
					],
				});

				// Mock collection validation FIRST, then recipe creation
				mockConnection.execute
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]) // Collection validation FIRST
					.mockResolvedValueOnce([{ insertId: 123, affectedRows: 1 }, []]) // Recipe insert
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Recipe update with filenames
					.mockResolvedValueOnce([[], []]) // Check existing ingredient (pasta - not found in household)
					.mockResolvedValueOnce([{ insertId: 101, affectedRows: 1 }, []]) // Create new pasta ingredient with household_id
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Add pasta to recipe_ingredients
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Add tomatoes (existing) to recipe_ingredients
					.mockResolvedValueOnce([[], []]) // Check existing ingredient (basil - not found in household)
					.mockResolvedValueOnce([{ insertId: 102, affectedRows: 1 }, []]) // Create new basil ingredient with household_id
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Add basil to recipe_ingredients
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Add recipe to collection
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]); // Final collection lookup for response

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormData(),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data.success).toBe(true);
						expect(data.recipeId).toBe(123);

						// Verify collection was validated FIRST with household context
						const collectionValidationCall = mockConnection.execute.mock.calls[0];
						expect(collectionValidationCall[0]).toContain('collections');
						expect(collectionValidationCall[0]).toContain('household_id');
						expect(collectionValidationCall[1]).toContain(10); // collection_id
						expect(collectionValidationCall[1]).toContain(1); // user's household_id

						// Verify recipe was created with user's household_id
						const recipeInsertCall = mockConnection.execute.mock.calls[1];
						expect(recipeInsertCall[1]).toContain(1); // user's household_id from mockRegularUser
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Input Validation', () => {
			it('should return 400 with detailed error when PDF file is missing', async () => {
				const formData = new FormData();
				// No PDF file added

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'PDF file is required for recipe import',
							code: 'MISSING_PDF_FILE',
							details: 'A PDF file containing the recipe must be provided to extract recipe data.',
						});

						// Verify no database operations were attempted
						expect(mockConnection.beginTransaction).not.toHaveBeenCalled();
						expect(mockOpenAICreate).not.toHaveBeenCalled();
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should validate structured recipe data format before processing', async () => {
				const formData = validFormData();
				formData.append('structuredRecipe', 'invalid-json-data');

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Invalid structured recipe data provided',
							code: 'INVALID_RECIPE_DATA',
							details: 'Structured recipe data must be valid JSON with required fields: title, ingredients, description.',
						});

						// Verify no processing occurred
						expect(mockConnection.beginTransaction).not.toHaveBeenCalled();
						expect(mockOpenAICreate).not.toHaveBeenCalled();
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('OpenAI Integration', () => {
			// Note: Testing API key not configured would require module re-import which is complex
			// We'll focus on testing the actual functionality with mocked OpenAI calls

			it('should handle OpenAI API failures with detailed error response', async () => {
				// Mock collection validation first (should pass)
				mockConnection.execute.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]);
				mockOpenAICreate.mockRejectedValueOnce(new Error('OpenAI API error'));

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormData(),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Failed to extract recipe data from PDF',
							code: 'OPENAI_EXTRACTION_ERROR',
							details: 'Unable to process the PDF file. Please ensure the PDF contains a clear recipe and try again.',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle empty response from OpenAI with detailed error', async () => {
				// Mock collection validation first (should pass)
				mockConnection.execute.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]);
				mockOpenAICreate.mockResolvedValueOnce({
					choices: [],
				});

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormData(),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'No recipe data extracted from PDF',
							code: 'OPENAI_NO_RESPONSE',
							details: 'The AI service returned no recipe data. The PDF may not contain a recognizable recipe format.',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle invalid JSON from OpenAI with detailed error', async () => {
				// Mock collection validation first (should pass)
				mockConnection.execute.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]);
				mockOpenAICreate.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: 'This is not valid JSON',
							},
						},
					],
				});

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormData(),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Invalid recipe data format received',
							code: 'OPENAI_INVALID_JSON',
							details: 'The AI service returned malformed data. Please try again or contact support if the problem persists.',
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should call OpenAI with proper parameters and PDF data', async () => {
				mockOpenAICreate.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockExtractedRecipe),
							},
						},
					],
				});

				// Mock successful database operations with collection validation first
				mockConnection.execute
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]) // Collection validation FIRST
					.mockResolvedValueOnce([{ insertId: 123, affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([[], []])
					.mockResolvedValueOnce([{ insertId: 101, affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([[], []])
					.mockResolvedValueOnce([{ insertId: 102, affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]); // Final collection lookup

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormData(),
						});

						expect(response.status).toBe(200);

						// Verify OpenAI was called with correct parameters
						expect(mockOpenAICreate).toHaveBeenCalledWith({
							model: 'gpt-4o',
							messages: expect.arrayContaining([
								{
									role: 'system',
									content: expect.stringContaining('recipe extraction expert'),
								},
								{
									role: 'user',
									content: expect.arrayContaining([
										{
											type: 'text',
											text: expect.stringContaining('extract a complete recipe'),
										},
										{
											type: 'image_url',
											image_url: {
												url: expect.stringMatching(/^data:application\/pdf;base64,/),
											},
										},
									]),
								},
							]),
							temperature: 0.3,
							max_tokens: 2000,
						});
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Structured Recipe Processing', () => {
			it('should use structured recipe data when provided (preview editing flow)', async () => {
				// Mock database operations with collection validation first
				mockConnection.execute
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]) // Collection validation FIRST
					.mockResolvedValueOnce([{ insertId: 123, affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([[], []])
					.mockResolvedValueOnce([{ insertId: 101, affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([[], []])
					.mockResolvedValueOnce([{ insertId: 102, affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]); // Final collection lookup

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormDataWithStructuredRecipe(),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data.success).toBe(true);
						expect(data.recipe.title).toBe(mockExtractedRecipe.title);

						// Verify OpenAI was NOT called (structured data was used)
						expect(mockOpenAICreate).not.toHaveBeenCalled();
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Database Operations', () => {
			it('should successfully create recipe with all ingredients', async () => {
				// Setup AI response
				mockOpenAICreate.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockExtractedRecipe),
							},
						},
					],
				});

				// Mock successful database operations starting with collection validation
				mockConnection.execute
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]) // Collection validation FIRST
					.mockResolvedValueOnce([{ insertId: 123, affectedRows: 1 }, []]) // Recipe insert
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Recipe update with filenames
					.mockResolvedValueOnce([[], []]) // Check existing ingredient (pasta - not found)
					.mockResolvedValueOnce([{ insertId: 101, affectedRows: 1 }, []]) // Create new pasta ingredient
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Add pasta to recipe_ingredients
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Add tomatoes (existing) to recipe_ingredients
					.mockResolvedValueOnce([[], []]) // Check existing ingredient (basil - not found)
					.mockResolvedValueOnce([{ insertId: 102, affectedRows: 1 }, []]) // Create new basil ingredient
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Add basil to recipe_ingredients
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Add recipe to collection
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]); // Final collection lookup for response

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormData(),
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.recipeId).toBe(123);
						expect(data.recipeSlug).toBe('123-delicious-pasta');
						expect(data.collectionSlug).toBe('test-collection');
						expect(data.addedIngredients).toBe(3);
						expect(data.newIngredients).toBe(2);
						expect(data.existingIngredients).toBe(1);
						expect(data.pdfSaved).toBe(true);
						expect(data.heroImageSaved).toBe(true);

						// Verify transaction was committed
						expect(mockConnection.beginTransaction).toHaveBeenCalled();
						expect(mockConnection.commit).toHaveBeenCalled();
						expect(mockConnection.rollback).not.toHaveBeenCalled();
						expect(mockConnection.release).toHaveBeenCalled();
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle existing ingredients correctly', async () => {
				const recipeWithExistingIngredients = {
					...mockExtractedRecipe,
					ingredients: [
						{
							name: 'pasta',
							quantity_2_servings: '200',
							quantity_4_servings: '400',
							existing_ingredient_id: 50, // Existing ingredient
						},
					],
				};

				mockOpenAICreate.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(recipeWithExistingIngredients),
							},
						},
					],
				});

				mockConnection.execute
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]) // Collection validation FIRST
					.mockResolvedValueOnce([{ insertId: 123, affectedRows: 1 }, []]) // Recipe insert
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Recipe update
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Add existing ingredient to recipe
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Add recipe to collection
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]); // Final collection lookup

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormData(),
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.newIngredients).toBe(0); // No new ingredients created
						expect(data.existingIngredients).toBe(1);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should rollback transaction on database failure with detailed error', async () => {
				mockOpenAICreate.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockExtractedRecipe),
							},
						},
					],
				});

				// Mock database failure after collection validation and recipe insert
				mockConnection.execute
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]) // Collection validation
					.mockResolvedValueOnce([{ insertId: 123, affectedRows: 1 }, []]) // Recipe insert
					.mockRejectedValueOnce(new Error('Database connection failed')); // Failure on recipe update

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormData(),
						});

						expect(response.status).toBe(500);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Failed to save recipe to database',
							code: 'DATABASE_SAVE_ERROR',
							details: 'A database error occurred while saving the recipe. No changes were made.',
						});

						// Verify transaction was rolled back
						expect(mockConnection.beginTransaction).toHaveBeenCalled();
						expect(mockConnection.rollback).toHaveBeenCalled();
						expect(mockConnection.commit).not.toHaveBeenCalled();
						expect(mockConnection.release).toHaveBeenCalled();
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle recipe creation with household_id (Agent 2 requirement)', async () => {
				mockOpenAICreate.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockExtractedRecipe),
							},
						},
					],
				});

				mockConnection.execute.mockResolvedValue([{ insertId: 123, affectedRows: 1 }, []]);

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						await fetch({
							method: 'POST',
							body: validFormData(),
						});

						// Verify recipe was created with household_id from authenticated user
						const recipeInsertCall = mockConnection.execute.mock.calls[0];
						expect(recipeInsertCall[0]).toContain('household_id');
						expect(recipeInsertCall[1]).toContain(1); // mockRegularUser.household_id
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('File Upload Operations', () => {
			it('should successfully upload PDF and hero image files', async () => {
				mockOpenAICreate.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockExtractedRecipe),
							},
						},
					],
				});

				// Mock successful database operations with full flow
				mockConnection.execute
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]) // Collection validation FIRST
					.mockResolvedValueOnce([{ insertId: 123, affectedRows: 1 }, []]) // Recipe insert
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Recipe update with filenames
					.mockResolvedValueOnce([[], []]) // Check existing ingredient (pasta - not found)
					.mockResolvedValueOnce([{ insertId: 101, affectedRows: 1 }, []]) // Create new pasta ingredient
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Add pasta to recipe_ingredients
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Add tomatoes (existing) to recipe_ingredients
					.mockResolvedValueOnce([[], []]) // Check existing ingredient (basil - not found)
					.mockResolvedValueOnce([{ insertId: 102, affectedRows: 1 }, []]) // Create new basil ingredient
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Add basil to recipe_ingredients
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Add recipe to collection
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]); // Final collection lookup

				mockUploadFile
					.mockResolvedValueOnce({ success: true, url: 'https://example.com/recipe.pdf' }) // PDF upload
					.mockResolvedValueOnce({ success: true, url: 'https://example.com/hero.jpg' }); // Hero image upload

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormData(),
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.pdfSaved).toBe(true);
						expect(data.heroImageSaved).toBe(true);
						expect(data.fileErrors).toBeUndefined();

						// Verify both files were uploaded
						expect(mockUploadFile).toHaveBeenCalledTimes(2);
						expect(mockUploadFile).toHaveBeenCalledWith(expect.any(Buffer), 'test-filename-abc123', 'pdf', 'application/pdf');
						expect(mockUploadFile).toHaveBeenCalledWith(expect.any(Buffer), 'test-filename-abc123', 'jpg', 'image/jpeg');
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle PDF upload failure as critical error', async () => {
				mockOpenAICreate.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockExtractedRecipe),
							},
						},
					],
				});

				mockConnection.execute
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]) // Collection validation
					.mockResolvedValueOnce([{ insertId: 123, affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValue([{ affectedRows: 1 }, []]);

				// Mock PDF upload failure
				mockUploadFile
					.mockResolvedValueOnce({ success: false, error: 'Storage error' }) // PDF upload fails
					.mockResolvedValueOnce({ success: true, url: 'https://example.com/hero.jpg' }); // Hero upload succeeds

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormData(),
						});

						expect(response.status).toBe(500);
						const data = await response.json();

						expect(data.success).toBe(false);
						expect(data.error).toBe('Recipe created but PDF file upload failed. Please try uploading the PDF again.');
						expect(data.recipeId).toBe(123);
						expect(data.fileErrors).toEqual(['Failed to save PDF: Storage error']);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should handle hero image upload failure gracefully', async () => {
				mockOpenAICreate.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockExtractedRecipe),
							},
						},
					],
				});

				mockConnection.execute
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]) // Collection validation
					.mockResolvedValueOnce([{ insertId: 123, affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValue([{ affectedRows: 1 }, []]);

				// Mock hero image upload failure
				mockUploadFile
					.mockResolvedValueOnce({ success: true, url: 'https://example.com/recipe.pdf' }) // PDF upload succeeds
					.mockResolvedValueOnce({ success: false, error: 'Image processing error' }); // Hero upload fails

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormData(),
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.pdfSaved).toBe(true);
						expect(data.heroImageSaved).toBe(false);
						expect(data.message).toContain('Warning: Some file uploads failed.');
						expect(data.fileErrors).toEqual(['Failed to save hero image: Image processing error']);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should work without hero image', async () => {
				mockOpenAICreate.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockExtractedRecipe),
							},
						},
					],
				});

				mockConnection.execute
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]) // Collection validation
					.mockResolvedValueOnce([{ insertId: 123, affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValue([{ affectedRows: 1 }, []]);

				// Only PDF upload should be called
				mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/recipe.pdf' });

				const formData = new FormData();
				formData.append('pdfFile', createMockFile('recipe.pdf', 'application/pdf', 2048));
				formData.append('collectionId', '10'); // Add required collection ID
				// No heroImage added

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: formData,
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						expect(data.success).toBe(true);
						expect(data.pdfSaved).toBe(true);
						expect(data.heroImageSaved).toBe(false);

						// Only PDF should be uploaded
						expect(mockUploadFile).toHaveBeenCalledTimes(1);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Collection Validation', () => {
			it('should validate collection ID early before any processing', async () => {
				const recipeWithoutCollection = {
					...mockExtractedRecipe,
					collectionId: undefined,
				};

				mockOpenAICreate.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(recipeWithoutCollection),
							},
						},
					],
				});

				// No database operations should be mocked - validation should happen first

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormDataWithoutCollection(),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Collection ID is required for recipe import',
							code: 'MISSING_COLLECTION_ID',
							details: 'A collection must be specified to organize the imported recipe.',
						});

						// Verify no database operations were attempted at all
						expect(mockConnection.beginTransaction).not.toHaveBeenCalled();
						expect(mockConnection.execute).not.toHaveBeenCalled();
						expect(mockOpenAICreate).not.toHaveBeenCalled();
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should validate collection exists in user household before processing', async () => {
				mockOpenAICreate.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockExtractedRecipe),
							},
						},
					],
				});

				// Mock early collection validation that returns empty (collection not found)
				mockConnection.execute.mockResolvedValueOnce([[], []]); // Collection lookup - empty result

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormData(),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Collection with ID 10 not found in your household',
							code: 'COLLECTION_NOT_FOUND',
							details: 'The specified collection does not exist or you do not have access to it.',
						});

						// Verify collection was validated early with household context
						const collectionValidationCall = mockConnection.execute.mock.calls[0];
						expect(collectionValidationCall[0]).toContain('collections');
						expect(collectionValidationCall[0]).toContain('household_id');
						expect(collectionValidationCall[1]).toContain(10); // collection_id
						expect(collectionValidationCall[1]).toContain(1); // user's household_id

						// Verify no recipe creation occurred
						expect(mockConnection.execute).toHaveBeenCalledTimes(1); // Only collection validation
						expect(mockOpenAICreate).not.toHaveBeenCalled();
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should validate collection has URL slug during early validation', async () => {
				mockOpenAICreate.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockExtractedRecipe),
							},
						},
					],
				});

				// Mock early collection validation that finds collection but missing URL slug
				mockConnection.execute.mockResolvedValueOnce([[{ id: 10, url_slug: null, title: 'Test Collection', household_id: 1 }], []]); // Collection without slug

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormData(),
						});

						expect(response.status).toBe(400);
						const data = await response.json();
						expect(data).toEqual({
							success: false,
							error: 'Collection "Test Collection" is missing URL slug',
							code: 'COLLECTION_INVALID',
							details: 'The collection configuration is incomplete. Please contact support.',
						});

						// Verify no recipe creation occurred
						expect(mockConnection.execute).toHaveBeenCalledTimes(1); // Only collection validation
						expect(mockOpenAICreate).not.toHaveBeenCalled();
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Ingredient Handling Edge Cases', () => {
			it('should handle ingredients with all possible properties', async () => {
				const complexRecipe = {
					...mockExtractedRecipe,
					ingredients: [
						{
							name: 'complex-ingredient',
							quantity_2_servings: '1.5',
							quantity_4_servings: '3',
							unit: 'cup',
							fresh: false,
							pantryCategory_id: 5,
							supermarketCategory_id: 8,
							measureId: 12,
						},
					],
				};

				mockOpenAICreate.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(complexRecipe),
							},
						},
					],
				});

				mockConnection.execute
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]) // Collection validation
					.mockResolvedValueOnce([{ insertId: 123, affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([[], []]) // Ingredient not found
					.mockResolvedValueOnce([{ insertId: 201, affectedRows: 1 }, []]) // Create ingredient
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Add to recipe
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection' }], []]); // Final collection lookup

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormData(),
						});

						expect(response.status).toBe(200);
						const data = await response.json();
						expect(data.success).toBe(true);

						// Verify ingredient was created with all properties including household ownership
						const ingredientCreateCall = mockConnection.execute.mock.calls[4];
						expect(ingredientCreateCall[0]).toContain('household_id'); // Should include household_id in query
						expect(ingredientCreateCall[1]).toEqual([
							'complex-ingredient',
							0, // fresh: false -> 0
							5, // pantryCategory_id
							8, // supermarketCategory_id
							1, // household_id from authenticated user
							0, // public: false (private to household by default for security)
						]);

						// Verify recipe_ingredient was created with measure
						const recipeIngredientCall = mockConnection.execute.mock.calls[5];
						expect(recipeIngredientCall[1]).toEqual([
							123, // recipe_id
							201, // ingredient_id
							'1.5', // quantity_2_servings
							'3', // quantity_4_servings
							12, // measureId
							0, // primaryIngredient
						]);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should use default values for missing ingredient properties', async () => {
				const minimalIngredientRecipe = {
					...mockExtractedRecipe,
					ingredients: [
						{
							name: 'minimal-ingredient',
							quantity_2_servings: '1',
							quantity_4_servings: '2',
						},
					],
				};

				mockOpenAICreate.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(minimalIngredientRecipe),
							},
						},
					],
				});

				mockConnection.execute
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]) // Collection validation
					.mockResolvedValueOnce([{ insertId: 123, affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([[], []])
					.mockResolvedValueOnce([{ insertId: 201, affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection' }], []]); // Final collection lookup

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormData(),
						});

						expect(response.status).toBe(200);

						// Verify defaults were used with household ownership
						const ingredientCreateCall = mockConnection.execute.mock.calls[4];
						expect(ingredientCreateCall[0]).toContain('household_id'); // Should include household_id in query
						expect(ingredientCreateCall[1]).toEqual([
							'minimal-ingredient',
							1, // fresh: default true -> 1
							1, // pantryCategory_id: default
							1, // supermarketCategory_id: default
							1, // household_id from authenticated user
							0, // public: false (private to household by default for security)
						]);

						// Verify recipe_ingredient with nulls for missing values
						const recipeIngredientCall = mockConnection.execute.mock.calls[5];
						expect(recipeIngredientCall[1]).toEqual([
							123, // recipe_id
							201, // ingredient_id
							'1', // quantity_2_servings
							'2', // quantity_4_servings
							null, // measureId: missing -> null
							0, // primaryIngredient
						]);
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});

			it('should check for existing ingredients within user household context only', async () => {
				const recipeWithCommonIngredient = {
					...mockExtractedRecipe,
					ingredients: [
						{
							name: 'salt',
							quantity_2_servings: '1',
							quantity_4_servings: '2',
							unit: 'tsp',
						},
					],
				};

				mockOpenAICreate.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(recipeWithCommonIngredient),
							},
						},
					],
				});

				mockConnection.execute
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]) // Collection validation
					.mockResolvedValueOnce([{ insertId: 123, affectedRows: 1 }, []]) // Recipe insert
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Recipe update
					.mockResolvedValueOnce([[], []]) // Check existing ingredient with household context
					.mockResolvedValueOnce([{ insertId: 201, affectedRows: 1 }, []]) // Create ingredient
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // Add to recipe
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // Add to collection

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormData(),
						});

						expect(response.status).toBe(200);

						// Verify ingredient lookup included household context
						const ingredientLookupCall = mockConnection.execute.mock.calls[3];
						expect(ingredientLookupCall[0]).toContain('household_id');
						expect(ingredientLookupCall[0]).toContain('OR public = 1'); // Can access public ingredients
						expect(ingredientLookupCall[1]).toContain('salt');
						expect(ingredientLookupCall[1]).toContain(1); // user's household_id
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});

		describe('Response Format Validation', () => {
			it('should return complete success response with all expected fields', async () => {
				mockOpenAICreate.mockResolvedValueOnce({
					choices: [
						{
							message: {
								content: JSON.stringify(mockExtractedRecipe),
							},
						},
					],
				});

				mockConnection.execute
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection', household_id: 1 }], []]) // Collection validation
					.mockResolvedValueOnce([{ insertId: 123, affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([[], []]) // pasta - new
					.mockResolvedValueOnce([{ insertId: 101, affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []]) // tomatoes - existing
					.mockResolvedValueOnce([[], []]) // basil - new
					.mockResolvedValueOnce([{ insertId: 102, affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([{ affectedRows: 1 }, []])
					.mockResolvedValueOnce([[{ id: 10, url_slug: 'test-collection', title: 'Test Collection' }], []]); // Final collection lookup

				await testApiHandler({
					appHandler,
					test: async ({ fetch }) => {
						const response = await fetch({
							method: 'POST',
							body: validFormData(),
						});

						expect(response.status).toBe(200);
						const data = await response.json();

						// Verify all expected response fields
						expect(data).toMatchObject({
							success: true,
							recipeId: 123,
							recipeSlug: '123-delicious-pasta',
							collectionSlug: 'test-collection',
							message: expect.stringContaining('Recipe imported successfully'),
							recipe: {
								title: 'Delicious Pasta',
								description: 'A wonderful pasta dish perfect for family dinners',
								prepTime: 15,
								cookTime: 30,
								servings: 4,
								cuisine: 'Italian',
								difficulty: 'Medium',
							},
							addedIngredients: 3,
							newIngredients: 2,
							existingIngredients: 1,
							totalIngredients: 3,
							pdfSaved: true,
							heroImageSaved: true,
						});

						expect(data.fileErrors).toBeUndefined();
					},
					requestPatcher: mockAuthenticatedUser,
				});
			});
		});
	});
});
