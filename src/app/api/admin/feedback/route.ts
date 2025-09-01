import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getFeedback, getFeedbackStats } from '@/lib/queries/feedback';
import { FeedbackQuery, FeedbackStatus, FeedbackCategory } from '@/types/feedback';

// GET /api/admin/feedback - Get feedback (Admin only)
export async function GET(request: NextRequest) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.is_admin) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const searchParams = request.nextUrl.searchParams;

		// Parse and validate numeric parameters
		const limitParam = searchParams.get('limit');
		const offsetParam = searchParams.get('offset');
		const ratingParam = searchParams.get('rating');
		const userIdParam = searchParams.get('userId');

		const query: FeedbackQuery = {
			status: (searchParams.get('status') as FeedbackStatus) || undefined,
			category: (searchParams.get('category') as FeedbackCategory) || undefined,
			rating: ratingParam ? parseInt(ratingParam) : undefined,
			userId: userIdParam ? parseInt(userIdParam) : undefined,
			startDate: searchParams.get('startDate') || undefined,
			endDate: searchParams.get('endDate') || undefined,
			limit: limitParam ? parseInt(limitParam) : 50,
			offset: offsetParam ? parseInt(offsetParam) : 0,
		};

		// Validate numeric values aren't NaN
		if (query.limit !== undefined && isNaN(query.limit)) query.limit = 50;
		if (query.offset !== undefined && isNaN(query.offset)) query.offset = 0;
		if (query.rating !== undefined && isNaN(query.rating)) query.rating = undefined;
		if (query.userId !== undefined && isNaN(query.userId)) query.userId = undefined;

		const feedback = await getFeedback(query);

		// Get stats if requested
		let stats = undefined;
		if (searchParams.get('includeStats') === 'true') {
			stats = await getFeedbackStats();
		}

		return NextResponse.json({
			feedback,
			stats,
			query,
		});
	} catch (error) {
		console.error('Error fetching feedback:', error);
		return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
	}
}
