'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { FeedbackSubmission } from '@/types/feedback';
import { usePathname } from 'next/navigation';

interface FeedbackContextType {
	isOpen: boolean;
	openFeedback: () => void;
	closeFeedback: () => void;
	submitFeedback: (data: FeedbackSubmission) => Promise<void>;
	lastActions: string[];
	trackAction: (action: string) => void;
	isSubmitting: boolean;
	lastSubmissionTime: number | null;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
	const [isOpen, setIsOpen] = useState(false);
	const [lastActions, setLastActions] = useState<string[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [lastSubmissionTime, setLastSubmissionTime] = useState<number | null>(null);
	const pathname = usePathname();

	const trackAction = useCallback((action: string) => {
		setLastActions(prev => {
			const newActions = [action, ...prev].slice(0, 3);
			return newActions;
		});
	}, []);

	useEffect(() => {
		if (pathname) {
			trackAction(`Navigated to ${pathname}`);
		}
	}, [pathname, trackAction]);

	const openFeedback = useCallback(() => {
		// Category parameter will be added in future
		setIsOpen(true);
	}, []);

	const closeFeedback = useCallback(() => {
		setIsOpen(false);
	}, []);

	const submitFeedback = useCallback(
		async (data: FeedbackSubmission) => {
			const now = Date.now();
			if (lastSubmissionTime && now - lastSubmissionTime < 5000) {
				throw new Error('Please wait a moment before submitting again');
			}

			setIsSubmitting(true);
			try {
				const response = await fetch('/api/feedback', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						...data,
						metadata: {
							...data.metadata,
							lastActions,
							browserInfo: navigator.userAgent,
							timestamp: now,
						},
					}),
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || 'Failed to submit feedback');
				}

				setLastSubmissionTime(now);
				closeFeedback();
			} finally {
				setIsSubmitting(false);
			}
		},
		[lastActions, lastSubmissionTime, closeFeedback]
	);

	return (
		<FeedbackContext.Provider
			value={{
				isOpen,
				openFeedback,
				closeFeedback,
				submitFeedback,
				lastActions,
				trackAction,
				isSubmitting,
				lastSubmissionTime,
			}}
		>
			{children}
		</FeedbackContext.Provider>
	);
}

export function useFeedback() {
	const context = useContext(FeedbackContext);
	if (context === undefined) {
		throw new Error('useFeedback must be used within a FeedbackProvider');
	}
	return context;
}
