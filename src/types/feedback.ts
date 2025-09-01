export type FeedbackCategory = 'bug' | 'feature_request' | 'general' | 'praise';
export type FeedbackStatus = 'new' | 'reviewed' | 'actioned' | 'closed';

export interface FeedbackSubmission {
	rating?: number;
	category?: FeedbackCategory;
	message?: string;
	pageContext: string;
	metadata?: {
		lastActions?: string[];
		browserInfo?: string;
		timestamp: number;
	};
}

export interface Feedback {
	id: number;
	user_id: number;
	household_id: number | null;
	rating: number | null;
	category: FeedbackCategory;
	message: string | null;
	page_context: string;
	user_agent: string | null;
	metadata: Record<string, unknown>;
	created_at: string;
	status: FeedbackStatus;
	admin_notes: string | null;
	reviewed_at: string | null;
	reviewed_by: number | null;
	user_email?: string;
	user_name?: string;
}

export interface FeedbackResponse {
	id: number;
	feedback_id: number;
	admin_id: number;
	response: string;
	created_at: string;
}

export interface FeedbackQuery {
	status?: FeedbackStatus;
	category?: FeedbackCategory;
	rating?: number;
	userId?: number;
	startDate?: string;
	endDate?: string;
	limit?: number;
	offset?: number;
}

export interface FeedbackUpdate {
	status?: FeedbackStatus;
	adminNotes?: string;
}

export interface FeedbackStats {
	total: number;
	new: number;
	reviewed: number;
	actioned: number;
	closed: number;
	averageRating: number | null;
	byCategory: Record<FeedbackCategory, number>;
}
