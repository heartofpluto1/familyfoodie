'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useFeedback } from '@/app/components/providers/FeedbackProvider';
import FeedbackForm from './FeedbackForm';
import FeedbackSuccess from './FeedbackSuccess';
import { FeedbackCategory } from '@/types/feedback';

export default function FeedbackWidget() {
	const { isOpen, openFeedback, closeFeedback, submitFeedback, isSubmitting } = useFeedback();
	const [showSuccess, setShowSuccess] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const pathname = usePathname();

	useEffect(() => {
		const shouldHide = pathname?.includes('/auth/') || pathname?.includes('/admin/');
		if (shouldHide && isOpen) {
			closeFeedback();
		}
	}, [pathname, isOpen, closeFeedback]);

	const handleSubmit = async (data: { rating?: number; category?: FeedbackCategory; message?: string }) => {
		setError(null);
		try {
			await submitFeedback({
				...data,
				pageContext: pathname || '/',
			});
			setShowSuccess(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to submit feedback');
		}
	};

	const handleClose = () => {
		setShowSuccess(false);
		setError(null);
		closeFeedback();
	};

	const shouldShow = pathname && !pathname.includes('/auth/') && !pathname.includes('/admin/');

	if (!shouldShow) {
		return null;
	}

	return (
		<>
			{/* Floating Action Button */}
			{!isOpen && (
				<button
					onClick={() => openFeedback()}
					className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-accent/90 dark:bg-accent/80 text-white shadow-lg hover:bg-accent dark:hover:bg-accent/70 hover:scale-110 transition-all z-40 flex items-center justify-center"
					aria-label="Open feedback form"
				>
					<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
						/>
					</svg>
				</button>
			)}

			{/* Feedback Modal */}
			{isOpen && (
				<>
					<div className="fixed inset-0 bg-black/50 z-40" onClick={handleClose} />
					<div className="fixed bottom-20 right-6 w-[90vw] max-w-[400px] bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50">
						<div className="p-6">
							<div className="flex justify-between items-center mb-4">
								<h2 className="text-xl text-foreground dark:text-gray-100">Share Your Feedback</h2>
								<button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close feedback form">
									<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>

							{error && (
								<div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-sm">
									<p className="text-sm text-red-600 dark:text-red-400">{error}</p>
								</div>
							)}

							{showSuccess ? (
								<FeedbackSuccess onClose={handleClose} />
							) : (
								<FeedbackForm onSubmit={handleSubmit} onCancel={handleClose} isSubmitting={isSubmitting} />
							)}
						</div>
					</div>
				</>
			)}
		</>
	);
}
