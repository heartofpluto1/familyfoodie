/**
 * Creates a mock NextResponse for testing
 */
export function createMockNextResponse(body: unknown, init?: ResponseInit) {
	const response = {
		json: () => Promise.resolve(body),
		text: () => Promise.resolve(JSON.stringify(body)),
		status: init?.status || 200,
		statusText: init?.statusText || 'OK',
		ok: (init?.status || 200) >= 200 && (init?.status || 200) < 300,
		headers: new Headers(init?.headers),
		// Add other Response properties as needed for tests
		clone: () => response,
		body: null,
		bodyUsed: false,
		arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
		blob: () => Promise.resolve(new Blob()),
		formData: () => Promise.resolve(new FormData()),
		redirected: false,
		type: 'basic' as ResponseType,
		url: '',
	};
	return response as Response;
}
