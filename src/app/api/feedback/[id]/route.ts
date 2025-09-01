import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getFeedbackById, updateFeedback, addFeedbackResponse } from '@/lib/queries/feedback';
import { FeedbackUpdate } from '@/types/feedback';

// GET /api/feedback/[id] - Get single feedback item
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.is_admin) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const params = await props.params;
		const feedbackId = parseInt(params.id);
		if (isNaN(feedbackId)) {
			return NextResponse.json({ error: 'Invalid feedback ID' }, { status: 400 });
		}

		const feedback = await getFeedbackById(feedbackId);
		if (!feedback) {
			return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
		}

		return NextResponse.json(feedback);
	} catch (error) {
		console.error('Error fetching feedback:', error);
		return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
	}
}

// PATCH /api/feedback/[id] - Update feedback status/notes
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.is_admin) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const params = await props.params;
		const feedbackId = parseInt(params.id);
		if (isNaN(feedbackId)) {
			return NextResponse.json({ error: 'Invalid feedback ID' }, { status: 400 });
		}

		const body: FeedbackUpdate = await request.json();

		// Validate status if provided
		if (body.status && !['new', 'reviewed', 'actioned', 'closed'].includes(body.status)) {
			return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
		}

		const updated = await updateFeedback(feedbackId, parseInt(session.user.id), {
			status: body.status,
			adminNotes: body.adminNotes,
		});

		if (!updated) {
			return NextResponse.json({ error: 'Failed to update feedback' }, { status: 400 });
		}

		return NextResponse.json({
			success: true,
			message: 'Feedback updated successfully',
		});
	} catch (error) {
		console.error('Error updating feedback:', error);
		return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
	}
}

// POST /api/feedback/[id]/response - Add admin response
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.is_admin) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const params = await props.params;
		const feedbackId = parseInt(params.id);
		if (isNaN(feedbackId)) {
			return NextResponse.json({ error: 'Invalid feedback ID' }, { status: 400 });
		}

		const { response } = await request.json();
		if (!response || response.trim().length === 0) {
			return NextResponse.json({ error: 'Response message is required' }, { status: 400 });
		}

		const responseId = await addFeedbackResponse(feedbackId, parseInt(session.user.id), response);

		return NextResponse.json({
			success: true,
			id: responseId,
			message: 'Response added successfully',
		});
	} catch (error) {
		console.error('Error adding response:', error);
		return NextResponse.json({ error: 'Failed to add response' }, { status: 500 });
	}
}
