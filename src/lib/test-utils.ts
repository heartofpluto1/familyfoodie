import type { NextRequest } from 'next/server';
import type { Session } from 'next-auth';
import { createMockNextResponse } from './test-utils/mockNextResponse';

// Standard mock session for admin user
export const mockAdminSession: Session = {
	user: {
		id: '1',
		email: 'admin@example.com',
		household_id: 1,
		household_name: 'Test Household',
		is_admin: true,
	},
	expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

// Standard mock session for regular user
export const mockRegularSession: Session = {
	user: {
		id: '2',
		email: 'user@example.com',
		household_id: 1,
		household_name: 'Test Household',
		is_admin: false,
	},
	expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

// Legacy user objects for backwards compatibility in tests
export const mockAdminUser = {
	id: 1,
	email: 'admin@example.com',
	first_name: 'Admin',
	last_name: 'User',
	oauth_provider: 'google',
	oauth_provider_id: '123456',
	is_admin: true,
	is_active: true,
	household_id: 1,
	household_name: 'Test Household',
};

export const mockRegularUser = {
	id: 2,
	email: 'user@example.com',
	first_name: 'Regular',
	last_name: 'User',
	oauth_provider: 'google',
	oauth_provider_id: '789012',
	is_admin: false,
	is_active: true,
	household_id: 1,
	household_name: 'Test Household',
};

/**
 * Clear all mocks - call this in beforeEach
 */
export const clearAllMocks = () => {
	jest.clearAllMocks();
};

/**
 * Mock for requireAuth function from @/lib/auth/helpers
 */
export const mockRequireAuth = jest.fn();

/**
 * Mock for requireAdminAuth function from @/lib/auth/helpers
 */
export const mockRequireAdminAuth = jest.fn();

/**
 * Mock for getServerSession from next-auth
 */
export const mockGetServerSession = jest.fn();

/**
 * Standard auth helpers mock configuration
 * Use this directly in jest.mock() calls
 */
export const authHelpersMock = {
	requireAuth: mockRequireAuth,
	requireAdminAuth: mockRequireAdminAuth,
};

/**
 * Mock next-auth module
 */
export const nextAuthMock = {
	getServerSession: mockGetServerSession,
};

/**
 * Setup authenticated user mock - call in beforeEach for authenticated tests
 */
export const setupAuthenticatedUser = (isAdmin = false) => {
	const session = isAdmin ? mockAdminSession : mockRegularSession;
	mockGetServerSession.mockResolvedValue(session);
	mockRequireAuth.mockResolvedValue({
		authorized: true,
		session,
		household_id: session.user.household_id,
		user_id: session.user.id,
	});
	if (isAdmin) {
		mockRequireAdminAuth.mockResolvedValue({
			authorized: true,
			session,
			household_id: session.user.household_id,
			user_id: session.user.id,
			is_admin: true,
		});
	} else {
		mockRequireAdminAuth.mockResolvedValue({
			authorized: false,
			response: createMockNextResponse({ error: 'Admin access required' }, { status: 403 }),
		});
	}
};

/**
 * Setup non-authenticated user mock - call in beforeEach for non-authenticated tests
 */
export const setupNonAuthenticatedUser = () => {
	mockGetServerSession.mockResolvedValue(null);
	mockRequireAuth.mockResolvedValue({
		authorized: false,
		response: createMockNextResponse({ error: 'Unauthorized' }, { status: 401 }),
	});
	mockRequireAdminAuth.mockResolvedValue({
		authorized: false,
		response: createMockNextResponse({ error: 'Unauthorized' }, { status: 401 }),
	});
};

/**
 * Standard mock setup for console methods
 * Returns cleanup function to restore original methods
 */
export const setupConsoleMocks = () => {
	const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
	const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
	const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();

	return {
		mockConsoleLog,
		mockConsoleError,
		mockConsoleWarn,
		cleanup: () => {
			mockConsoleLog.mockRestore();
			mockConsoleError.mockRestore();
			mockConsoleWarn.mockRestore();
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
				// JPEG magic bytes: FF D8 FF (JPEG/JFIF header)
				uint8Array[0] = 0xff;
				uint8Array[1] = 0xd8;
				uint8Array[2] = 0xff;
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
				uint8Array[2] = 0xff;
		}

		// Fill the rest with filler data if needed
		for (let i = Math.max(8, type === 'image/webp' ? 12 : 3); i < size; i++) {
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
export const mockAuthenticatedUser = (req: NextRequest) => {
	// OAuth doesn't attach user to request directly
	return req;
};

/**
 * Request patcher for non-authenticated requests
 */
export const mockNonAuthenticatedUser = (req: NextRequest) => {
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
