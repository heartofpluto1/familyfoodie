/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';

// Mock NextAuth completely - just return a working handler
jest.mock('next-auth', () => {
	return jest.fn(() => {
		return () =>
			new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
	});
});

// Mock the auth config
jest.mock('@/lib/auth/config', () => ({
	authOptions: {},
}));

import * as appHandler from './route';

describe('/api/auth/[...nextauth]', () => {
	it('should respond to GET requests', async () => {
		await testApiHandler({
			appHandler,
			url: '/api/auth/session',
			paramsPatcher(params) {
				params.nextauth = ['session'];
			},
			test: async ({ fetch }) => {
				const response = await fetch({ method: 'GET' });
				expect(response.status).toBe(200);
			},
		});
	});

	it('should respond to POST requests', async () => {
		await testApiHandler({
			appHandler,
			url: '/api/auth/signout',
			paramsPatcher(params) {
				params.nextauth = ['signout'];
			},
			test: async ({ fetch }) => {
				const response = await fetch({
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({}),
				});
				expect(response.status).toBe(200);
			},
		});
	});
});
