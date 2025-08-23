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

/**
 * Clear all mocks - call this in beforeEach
 */
export const clearAllMocks = () => {
	jest.clearAllMocks();
};

/**
 * Standard auth middleware mock configuration
 * Use this directly in jest.mock() calls via require
 */
export const authMiddlewareMock = {
	withAuth: (handler: (request: NextRequest, session: unknown) => Promise<Response>) => {
		return async (request: NextRequest & { user?: unknown }) => {
			// Check if user is set by requestPatcher
			if (!request.user) {
				return new Response(
					JSON.stringify({
						success: false,
						error: 'Authentication required!!',
					}),
					{ status: 401, headers: { 'Content-Type': 'application/json' } }
				);
			}
			return handler(request, request.user);
		};
	},
};

/**
 * Passthrough auth middleware mock configuration
 * Used for admin routes that handle auth differently
 */
export const passthroughAuthMock = {
	withAuth: (handler: (...args: unknown[]) => unknown) => handler,
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
 * Request patcher for authenticated user requests
 * Use this with testApiHandler to simulate authenticated requests
 */
export const mockAuthenticatedUser = (req: NextRequest & { user?: User }) => {
	req.user = mockRegularUser;
	return req;
};

/**
 * Request patcher for non-authenticated requests
 */
export const mockNonAuthenticatedUser = (req: NextRequest & { user?: User }) => {
	req.user = undefined;
	return req;
};

/**
 * Standard database connection mock interface
 * Use this type for consistent connection mocking across tests
 */
export interface MockConnection {
	beginTransaction: jest.MockedFunction<() => Promise<void>>;
	commit: jest.MockedFunction<() => Promise<void>>;
	rollback: jest.MockedFunction<() => Promise<void>>;
	release: jest.MockedFunction<() => void>;
	execute: jest.MockedFunction<(sql: string, values?: unknown[]) => Promise<unknown>>;
}

/**
 * Enhanced test data with more comprehensive scenarios
 */
export const enhancedTestData = {
	recipes: {
		valid: {
			id: 1,
			name: 'Test Recipe',
			collection_id: 1,
			image_filename: 'recipe_1.jpg',
			pdf_filename: 'recipe_1.pdf',
		},
		withLongName: {
			id: 2,
			name: 'A'.repeat(255),
			collection_id: 1,
		},
		withSpecialChars: {
			id: 3,
			name: 'Recipe with "quotes" & <tags>',
			collection_id: 1,
		},
	},
	ingredients: {
		valid: {
			id: 1,
			ingredientId: 5,
			quantity: '2 cups',
			quantity4: '500ml',
			measureId: 3,
			preparationId: 2,
		},
		minimal: {
			ingredientId: 20,
			quantity: '1 pinch',
			quantity4: '1g',
		},
		withSpecialChars: {
			ingredientId: 35,
			quantity: '1½ cups "chopped"',
			quantity4: '375ml & <measured>',
		},
	},
	databaseResults: {
		successfulUpdate: [{ affectedRows: 1 }, []],
		successfulInsert: [{ insertId: 123, affectedRows: 1 }, []],
		successfulDelete: [{ affectedRows: 2 }, []],
		noRowsAffected: [{ affectedRows: 0 }, []],
	},
};
