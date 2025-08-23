import type { NextRequest } from 'next/server';
import type { User } from '@/types/user';

// Standard mock admin user data
export const mockAdminUser: User = {
	id: 1,
	username: 'admin',
	first_name: 'Admin',
	last_name: 'User',
	email: 'admin@example.com',
	is_admin: true,
	is_active: true,
	date_joined: '2024-01-01T00:00:00Z',
	last_login: '2024-08-01T00:00:00Z',
};

// Standard mock regular user data
export const mockRegularUser: User = {
	id: 2,
	username: 'user',
	first_name: 'Regular',
	last_name: 'User',
	email: 'user@example.com',
	is_admin: false,
	is_active: true,
	date_joined: '2024-01-01T00:00:00Z',
	last_login: '2024-08-01T00:00:00Z',
};

// Standard mock inactive user
export const mockInactiveUser: User = {
	id: 3,
	username: 'inactive',
	first_name: 'Inactive',
	last_name: 'User',
	email: 'inactive@example.com',
	is_admin: false,
	is_active: false,
	date_joined: '2024-01-01T00:00:00Z',
	last_login: null,
};

/**
 * Helper to mock environment variables
 * Usage: const restoreEnv = mockEnv({ NODE_ENV: 'production' });
 */
export const mockEnv = (env: Record<string, string | undefined>) => {
	const originalEnv = process.env;
	process.env = { ...originalEnv, ...env };
	return () => {
		process.env = originalEnv;
	};
};

/**
 * Standard mock setup for authentication helpers
 * Used in beforeEach to reset all auth mocks
 */
export const setupAuthMocks = () => {
	const { requireAdminUser, getAuthenticatedUser } = jest.requireMock('@/lib/auth-helpers');
	return {
		mockRequireAdminUser: requireAdminUser as jest.MockedFunction<typeof requireAdminUser>,
		mockGetAuthenticatedUser: getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>,
	};
};

/**
 * Standard mock setup for database operations
 */
export const setupDatabaseMocks = () => {
	const mockPool = {
		execute: jest.fn(),
		end: jest.fn(),
	};
	return { mockPool };
};

/**
 * Mock database object with execute method for direct usage
 */
export const mockDatabase = {
	execute: jest.fn(),
	end: jest.fn(),
};

/**
 * Clear all mocks - call this in beforeEach
 */
export const clearAllMocks = () => {
	jest.clearAllMocks();
	mockDatabase.execute.mockClear();
};

/**
 * Standard mock setup for storage operations
 */
export const setupStorageMocks = () => {
	const { uploadFile, deleteFile, getStorageMode } = jest.requireMock('@/lib/storage');
	return {
		mockUploadFile: uploadFile as jest.MockedFunction<typeof uploadFile>,
		mockDeleteFile: deleteFile as jest.MockedFunction<typeof deleteFile>,
		mockGetStorageMode: getStorageMode as jest.MockedFunction<typeof getStorageMode>,
	};
};

/**
 * Standard mock setup for console methods
 * Returns cleanup function to restore original methods
 */
export const setupConsoleMocks = () => {
	const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
	const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

	return {
		mockConsoleLog,
		mockConsoleError,
		cleanup: () => {
			mockConsoleLog.mockRestore();
			mockConsoleError.mockRestore();
		},
	};
};

/**
 * Standard Jest mock configuration for common modules
 * Use this at the top of test files
 */
export const getStandardMocks = () => {
	return {
		authHelpers: () => ({
			'@/lib/auth-helpers': {
				requireAdminUser: jest.fn(),
				getAuthenticatedUser: jest.fn(),
			},
		}),
		authMiddleware: () => ({
			'@/lib/auth-middleware': {
				withAuth: (handler: (...args: unknown[]) => unknown) => handler,
			},
		}),
		database: () => ({
			'@/lib/db.js': {
				execute: jest.fn(),
				end: jest.fn(),
			},
		}),
		storage: () => ({
			'@/lib/storage': {
				uploadFile: jest.fn(),
				deleteFile: jest.fn(),
				getStorageMode: jest.fn(),
			},
		}),
	};
};

/**
 * Mock FormData for file upload testing
 */
export const createMockFormData = (data: Record<string, string | File>) => {
	const formData = new FormData();
	Object.entries(data).forEach(([key, value]) => {
		formData.append(key, value);
	});
	return formData;
};

/**
 * Create a mock File object for upload testing
 */
export const createMockFile = (name = 'test.jpg', type = 'image/jpeg', size = 1024, content?: string): File => {
	let buffer: ArrayBuffer;

	if (content !== undefined) {
		// Convert string content to ArrayBuffer
		const encoder = new TextEncoder();
		buffer = encoder.encode(content).buffer;
	} else {
		// Generate content with proper magic bytes based on type
		const uint8Array = new Uint8Array(size);

		switch (type) {
			case 'image/jpeg':
			case 'image/jpg':
				// JPEG magic bytes: FF D8
				uint8Array[0] = 0xff;
				uint8Array[1] = 0xd8;
				break;
			case 'image/png':
				// PNG magic bytes: 89 50 4E 47
				uint8Array[0] = 0x89;
				uint8Array[1] = 0x50; // P
				uint8Array[2] = 0x4e; // N
				uint8Array[3] = 0x47; // G
				break;
			case 'image/webp':
				// WebP magic bytes: RIFF + 4 byte size + WEBP
				const riff = new TextEncoder().encode('RIFF');
				const webp = new TextEncoder().encode('WEBP');
				uint8Array.set(riff, 0);
				uint8Array.set(webp, 8);
				// Size bytes (4-7) can remain 0 for testing
				break;
			default:
				// Default to JPEG for other types
				uint8Array[0] = 0xff;
				uint8Array[1] = 0xd8;
		}

		// Fill the rest with filler data if needed
		for (let i = Math.max(8, type === 'image/webp' ? 12 : 2); i < size; i++) {
			uint8Array[i] = 0x78; // 'x' character
		}

		buffer = uint8Array.buffer;
	}

	const blob = new Blob([buffer], { type });
	return new File([blob], name, { type, lastModified: Date.now() });
};

/**
 * Standard error scenarios for testing
 */
export const standardErrorScenarios = {
	databaseError: new Error('Database connection failed'),
	authError: new Error('Session validation failed'),
	notFoundError: new Error('Record not found'),
	validationError: new Error('Invalid input data'),
	storageError: new Error('File upload failed'),
};

/**
 * Common HTTP status codes and their expected error responses
 */
export const httpStatusTests = {
	unauthorized: { status: 401, error: 'Authentication required!!' },
	forbidden: { status: 403, error: 'Admin access required' },
	badRequest: { status: 400 },
	notFound: { status: 404 },
	serverError: { status: 500 },
};

/**
 * Standard test data for different entity types
 */
export const testData = {
	recipe: {
		id: 1,
		name: 'Test Recipe',
		collection_id: 1,
		image_filename: 'recipe_1.jpg',
		pdf_filename: 'recipe_1.pdf',
	},
	ingredient: {
		id: 1,
		name: 'Test Ingredient',
		primaryType_id: 1,
		secondaryType_id: 1,
	},
	collection: {
		id: 1,
		title: 'Test Collection',
		subtitle: 'Test Subtitle',
		filename: 'test_collection',
	},
	shoppingItem: {
		id: 1,
		ingredient_id: 1,
		quantity: '2',
		purchased: false,
	},
};

/**
 * Request patcher for authenticated user requests
 * Use this with testApiHandler to simulate authenticated requests
 */
export const mockAuthenticatedUser = (req: NextRequest & { user?: User }) => {
	req.user = mockRegularUser;
	return req;
};

/**
 * Request patcher for admin user requests
 */
export const mockAdminUserPatcher = (req: NextRequest & { user?: User }) => {
	req.user = mockAdminUser;
	return req;
};

/**
 * Request patcher for non-authenticated requests
 */
export const mockNonAuthenticatedUser = (req: NextRequest & { user?: User }) => {
	req.user = undefined;
	return req;
};
