'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useFeedback } from '@/app/components/providers/FeedbackProvider';
import FeedbackForm from './FeedbackForm';
import FeedbackSuccess from './FeedbackSuccess';
import { FeedbackCategory } from '@/types/feedback';
import { FeedbackIcon, CloseIcon } from '@/app/components/Icons';

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

	const handleOpen = () => {
		setShowSuccess(false);
		setError(null);
		openFeedback();
	};

	const handleClose = () => {
		closeFeedback();
		// Reset state after a delay to allow the closing animation
		setTimeout(() => {
			setShowSuccess(false);
			setError(null);
		}, 300);
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
					onClick={handleOpen}
					className="btn-default fixed bottom-4 right-4 w-12 h-12 rounded-full hover:scale-110 transition-all z-40 flex items-center justify-center"
					aria-label="Open feedback form"
				>
					<FeedbackIcon />
				</button>
			)}

			{/* Feedback Modal */}
			{isOpen && (
				<>
					<div className="fixed inset-0 bg-black/50 z-40" onClick={handleClose} />
					<div className="fixed bottom-20 right-6 w-[90vw] max-w-[400px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-sm shadow-xl z-50">
						<div className="p-6">
							<div className="flex justify-between items-center mb-4">
								<h2 className="text-xl text-gray-900 dark:text-gray-100">Share Your Feedback</h2>
								<button
									onClick={handleClose}
									className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
									aria-label="Close feedback form"
								>
									<CloseIcon className="w-6 h-6" />
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
