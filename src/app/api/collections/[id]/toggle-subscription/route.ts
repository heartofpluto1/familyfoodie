import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { subscribeToCollection, unsubscribeFromCollection, isSubscribed } from '@/lib/queries/subscriptions';

type RouteContext = {
	params: Promise<Record<string, string | string[]>>;
};

/**
 * Toggle subscription to a collection (subscribe if not subscribed, unsubscribe if subscribed)
 * POST /api/collections/[id]/toggle-subscription
 */
export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
	const auth = await requireAuth();
	if (!auth.authorized) {
		return auth.response;
	}

	try {
		// Handle missing context or params gracefully
		if (!context || !context.params) {
			return NextResponse.json(
				{
					success: false,
					error: 'Invalid collection ID',
				},
				{ status: 400 }
			);
		}

		const params = await context.params;
		if (!params || !params.id) {
			return NextResponse.json(
				{
					success: false,
					error: 'Invalid collection ID',
				},
				{ status: 400 }
			);
		}

		const { id } = params;
		const idValue = Array.isArray(id) ? id[0] : id;
		const collectionId = parseInt(idValue as string);

		if (!collectionId || isNaN(collectionId) || collectionId <= 0) {
			return NextResponse.json(
				{
					success: false,
					error: 'Invalid collection ID',
				},
				{ status: 400 }
			);
		}

		const householdId = auth.household_id;

		// Check current subscription status
		const currentlySubscribed = await isSubscribed(householdId, collectionId);

		let success: boolean;
		let action: string;

		if (currentlySubscribed) {
			// Unsubscribe
			success = await unsubscribeFromCollection(householdId, collectionId);
			action = 'unsubscribed';
		} else {
			// Subscribe
			success = await subscribeToCollection(householdId, collectionId);
			action = 'subscribed';
		}

		if (!success) {
			return NextResponse.json(
				{
					success: false,
					error: `Failed to ${action === 'subscribed' ? 'subscribe' : 'unsubscribe'}`,
				},
				{ status: 409 }
			);
		}

		return NextResponse.json({
			success: true,
			action,
			subscribed: !currentlySubscribed,
			message: `Successfully ${action}`,
		});
	} catch (error) {
		console.error('Toggle subscription error:', error);

		const errorMessage = error instanceof Error ? error.message : 'Failed to toggle subscription';
		const statusCode = errorMessage.includes('not found') ? 404 : errorMessage.includes('Cannot subscribe') ? 400 : 500;

		return NextResponse.json(
			{
				success: false,
				error: errorMessage,
			},
			{ status: statusCode }
		);
	}
}
