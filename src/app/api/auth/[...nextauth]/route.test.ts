/** @jest-environment node */

import { testApiHandler } from 'next-test-api-route-handler';

// Mock @/auth — provide stub handlers
jest.mock('@/auth', () => ({
	handlers: {
		GET: () =>
			new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}),
		POST: () =>
			new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}),
	},
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
