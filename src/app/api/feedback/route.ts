import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { createFeedback } from '@/lib/queries/feedback';
import { FeedbackSubmission } from '@/types/feedback';

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
