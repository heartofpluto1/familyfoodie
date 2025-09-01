'use client';

import React, { useEffect } from 'react';
import { CheckCircleIcon } from '@/app/components/Icons';

interface FeedbackSuccessProps {
	onClose: () => void;
}

export default function FeedbackSuccess({ onClose }: FeedbackSuccessProps) {
	useEffect(() => {
		const timer = setTimeout(onClose, 3000);
		return () => clearTimeout(timer);
	}, [onClose]);

	return (
		<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-sm p-6">
			<div className="flex flex-col items-center text-center">
				<CheckCircleIcon className="w-12 h-12 text-green-600 dark:text-green-400 mb-3" />
				<h3 className="text-lg font-medium text-green-900 dark:text-green-100 mb-1">Thank you for your feedback!</h3>
				<p className="text-sm text-green-700 dark:text-green-300">We appreciate you taking the time to help us improve.</p>
			</div>
		</div>
	);
}
