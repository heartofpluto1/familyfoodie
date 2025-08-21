'use client';

interface ConfirmDialogProps {
	isOpen: boolean;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	onConfirm: () => void;
	onCancel: () => void;
	isLoading?: boolean;
}

const ConfirmDialog = ({
	isOpen,
	title,
	message,
	confirmText = 'Confirm',
	cancelText = 'Cancel',
	onConfirm,
	onCancel,
	isLoading = false,
}: ConfirmDialogProps) => {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
			<div className="bg-surface dark:bg-gray-800 border border-custom rounded-sm p-6 max-w-md w-full shadow-xl">
				<h3 className="text-lg font-semibold text-foreground mb-3">{title}</h3>
				<p className="text-secondary dark:text-gray-300 mb-6 leading-relaxed">{message}</p>

				<div className="flex gap-3 justify-end">
					<button onClick={onCancel} disabled={isLoading} className="btn-default px-4 py-2 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed">
						{cancelText}
					</button>
					<button
						onClick={onConfirm}
						disabled={isLoading}
						className="px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isLoading ? 'Deleting...' : confirmText}
					</button>
				</div>
			</div>
		</div>
	);
};

export default ConfirmDialog;
