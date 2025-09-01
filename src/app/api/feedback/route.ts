import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { createFeedback, getFeedback, getFeedbackStats } from '@/lib/queries/feedback';
import { FeedbackSubmission, FeedbackQuery, FeedbackStatus, FeedbackCategory } from '@/types/feedback';

// POST /api/feedback - Submit new feedback
export async function POST(request: NextRequest) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body: FeedbackSubmission = await request.json();

		// Validate required fields
		if (!body.pageContext) {
			return NextResponse.json({ error: 'Page context is required' }, { status: 400 });
		}

		// Validate rating if provided
		if (body.rating !== undefined && (body.rating < 1 || body.rating > 5)) {
			return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
		}

		// Validate message length
		if (body.message && body.message.length > 5000) {
			return NextResponse.json({ error: 'Message must be 5000 characters or less' }, { status: 400 });
		}

		// Rate limiting check (simple in-memory for now)
		const now = Date.now();
		const lastSubmission = request.headers.get('x-last-submission');
		if (lastSubmission && now - parseInt(lastSubmission) < 5000) {
			return NextResponse.json({ error: 'Please wait a moment before submitting again' }, { status: 429 });
		}

		const feedbackId = await createFeedback(parseInt(session.user.id), session.user.household_id || null, body);

		return NextResponse.json(
			{
				success: true,
				id: feedbackId,
				message: 'Thank you for your feedback!',
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Error submitting feedback:', error);
		return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
	}
}

// GET /api/feedback - Get feedback (Admin only)
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
