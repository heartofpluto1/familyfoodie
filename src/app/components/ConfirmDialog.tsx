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
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
				<h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
				<p className="text-gray-600 mb-6">{message}</p>

				<div className="flex gap-3 justify-end">
					<button
						onClick={onCancel}
						disabled={isLoading}
						className="px-4 py-2 bg-gray-500 text-white rounded-sm hover:bg-gray-600 transition-colors disabled:opacity-50"
					>
						{cancelText}
					</button>
					<button
						onClick={onConfirm}
						disabled={isLoading}
						className="px-4 py-2 bg-red-600 text-white rounded-sm hover:bg-red-700 transition-colors disabled:opacity-50"
					>
						{isLoading ? 'Deleting...' : confirmText}
					</button>
				</div>
			</div>
		</div>
	);
};

export default ConfirmDialog;
