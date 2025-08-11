import React, { useEffect } from 'react';

interface ConfirmDialogProps {
	isOpen: boolean;
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	onConfirm: () => void;
	onCancel: () => void;
}

export function ConfirmDialog({ isOpen, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel }: ConfirmDialogProps) {
	useEffect(() => {
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onCancel();
			}
		};

		if (isOpen) {
			document.addEventListener('keydown', handleEscape);
			document.body.style.overflow = 'hidden';
		}

		return () => {
			document.removeEventListener('keydown', handleEscape);
			document.body.style.overflow = 'unset';
		};
	}, [isOpen, onCancel]);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div className="absolute inset-0 bg-black bg-opacity-50" onClick={onCancel} aria-hidden="true" />

			<div
				className="relative bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
				role="dialog"
				aria-modal="true"
				aria-labelledby="dialog-title"
			>
				<h2 id="dialog-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
					{title}
				</h2>

				<p className="text-gray-700 dark:text-gray-300 mb-6">{message}</p>

				<div className="flex justify-end gap-3">
					<button
						onClick={onCancel}
						className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
					>
						{cancelLabel}
					</button>
					<button
						onClick={onConfirm}
						className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
						autoFocus
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}
