'use client';

import { useEffect, useState } from 'react';

export interface ToastMessage {
	id: string;
	type: 'info' | 'error' | 'warning' | 'success';
	title: string;
	message: string;
}

interface ToastProps {
	toast: ToastMessage;
	onRemove: (id: string) => void;
}

const Toast = ({ toast, onRemove }: ToastProps) => {
	const [isVisible, setIsVisible] = useState(true);

	useEffect(() => {
		const timer = setTimeout(() => {
			setIsVisible(false);
			setTimeout(() => onRemove(toast.id), 300);
		}, 5000);

		return () => clearTimeout(timer);
	}, [toast.id, onRemove]);

	const getToastStyles = () => {
		const baseStyles = 'transform transition-all duration-300 ease-in-out';
		const positionStyles = isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0';

		let colorStyles = '';
		switch (toast.type) {
			case 'error':
				colorStyles = 'bg-red-50 border-red-200 text-red-800';
				break;
			case 'warning':
				colorStyles = 'bg-yellow-50 border-yellow-200 text-yellow-800';
				break;
			case 'success':
				colorStyles = 'bg-green-50 border-green-200 text-green-800';
				break;
			default:
				colorStyles = 'bg-blue-50 border-blue-200 text-blue-800';
		}

		return `${baseStyles} ${positionStyles} ${colorStyles}`;
	};

	return (
		<div className={`pointer-events-auto w-full overflow-hidden border-b shadow-sm ${getToastStyles()}`}>
			<div className="px-3 py-2">
				<div className="flex items-center">
					<div className="flex-shrink-0">
						{toast.type === 'error' && (
							<svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						)}
						{toast.type === 'warning' && (
							<svg className="h-4 w-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
								/>
							</svg>
						)}
						{toast.type === 'success' && (
							<svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						)}
						{toast.type === 'info' && (
							<svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						)}
					</div>
					<div className="ml-2 flex-1 min-w-0">
						<p className="text-sm font-medium truncate">{toast.title}</p>
						<p className="text-xs opacity-90 truncate">{toast.message}</p>
					</div>
					<div className="ml-2 flex-shrink-0">
						<button
							className="inline-flex rounded-md hover:opacity-75 focus:outline-none"
							onClick={() => {
								setIsVisible(false);
								setTimeout(() => onRemove(toast.id), 300);
							}}
						>
							<span className="sr-only">Close</span>
							<svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
								<path
									fillRule="evenodd"
									d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
									clipRule="evenodd"
								/>
							</svg>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Toast;
