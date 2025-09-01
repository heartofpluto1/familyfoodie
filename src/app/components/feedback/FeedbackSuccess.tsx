'use client';

import React, { useEffect } from 'react';

interface FeedbackSuccessProps {
	onClose: () => void;
}

export default function FeedbackSuccess({ onClose }: FeedbackSuccessProps) {
	useEffect(() => {
		const timer = setTimeout(onClose, 3000);
		return () => clearTimeout(timer);
	}, [onClose]);

	return (
		<div className="text-center py-6">
			<div className="text-4xl mb-3">✓</div>
			<h3 className="text-lg text-foreground dark:text-gray-100 mb-2">Thank you for your feedback!</h3>
			<p className="text-sm text-muted dark:text-gray-400">We appreciate you taking the time to help us improve.</p>
		</div>
	);
}
