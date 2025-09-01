'use client';

import React, { useState } from 'react';
import { FeedbackCategory } from '@/types/feedback';
import RatingStars from './RatingStars';

interface FeedbackFormProps {
	onSubmit: (data: { rating?: number; category?: FeedbackCategory; message?: string }) => void;
	onCancel: () => void;
	isSubmitting?: boolean;
	defaultCategory?: FeedbackCategory;
}

export default function FeedbackForm({ onSubmit, onCancel, isSubmitting = false, defaultCategory }: FeedbackFormProps) {
	const [rating, setRating] = useState<number>(0);
	const [category, setCategory] = useState<FeedbackCategory>(defaultCategory || 'general');
	const [message, setMessage] = useState('');

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSubmit({
			rating: rating > 0 ? rating : undefined,
			category,
			message: message.trim() || undefined,
		});
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div>
				<label className="block text-sm font-medium text-foreground dark:text-gray-200 mb-2">How would you rate your experience?</label>
				<div className="flex justify-center">
					<RatingStars rating={rating} onChange={setRating} disabled={isSubmitting} />
				</div>
			</div>

			<div>
				<label htmlFor="category" className="block text-sm font-medium text-foreground dark:text-gray-200 mb-2">
					Category
				</label>
				<select
					id="category"
					value={category}
					onChange={e => setCategory(e.target.value as FeedbackCategory)}
					disabled={isSubmitting}
					className="w-full px-3 py-2 border border-custom dark:border-gray-600 rounded-sm bg-surface dark:bg-gray-700 text-foreground dark:text-gray-100 disabled:opacity-50"
				>
					<option value="general">General Feedback</option>
					<option value="bug">Bug Report</option>
					<option value="feature_request">Feature Request</option>
					<option value="praise">Praise</option>
				</select>
			</div>

			<div>
				<label htmlFor="message" className="block text-sm font-medium text-foreground dark:text-gray-200 mb-2">
					Your feedback (optional)
				</label>
				<textarea
					id="message"
					value={message}
					onChange={e => setMessage(e.target.value)}
					disabled={isSubmitting}
					rows={4}
					maxLength={5000}
					placeholder="Tell us more about your experience..."
					className="w-full px-3 py-2 border border-custom dark:border-gray-600 rounded-sm bg-surface dark:bg-gray-700 text-foreground dark:text-gray-100 placeholder-muted dark:placeholder-gray-400 disabled:opacity-50"
				/>
				<div className="text-xs text-muted dark:text-gray-400 mt-1">{message.length}/5000 characters</div>
			</div>

			<div className="flex gap-3 justify-end">
				<button
					type="button"
					onClick={onCancel}
					disabled={isSubmitting}
					className="px-4 py-2 text-sm font-medium text-foreground dark:text-gray-300 bg-surface dark:bg-gray-700 border border-custom dark:border-gray-600 rounded-sm hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={isSubmitting}
					className="px-4 py-2 text-sm font-medium text-white bg-accent dark:bg-accent hover:bg-accent/90 dark:hover:bg-accent/80 rounded-sm disabled:opacity-50 transition-colors"
				>
					{isSubmitting ? 'Submitting...' : 'Submit Feedback'}
				</button>
			</div>
		</form>
	);
}
