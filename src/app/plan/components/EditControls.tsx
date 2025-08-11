import React from 'react';
import { PlanActions } from '@/types/plan';
import { ConfirmDialog } from './ConfirmDialog';

interface EditControlsProps {
	isEditMode: boolean;
	isLoading: boolean;
	planActions: PlanActions;
}

export function EditControls({ isEditMode, isLoading, planActions }: EditControlsProps) {
	const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

	const handleDeleteClick = () => {
		setShowDeleteConfirm(true);
	};

	const handleConfirmDelete = async () => {
		setShowDeleteConfirm(false);
		await planActions.handleDelete();
	};

	if (!isEditMode) {
		return (
			<div className="mb-6">
				<button
					onClick={planActions.handleEdit}
					disabled={isLoading}
					className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
				>
					{isLoading ? 'Loading recipes...' : 'Edit Week'}
				</button>
			</div>
		);
	}

	return (
		<>
			<div className="week-controls mb-6 flex gap-2 flex-wrap">
				<button
					onClick={planActions.handleAutomate}
					disabled={isLoading}
					className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
				>
					{isLoading ? 'Automating...' : 'Automate'}
				</button>
				<button
					onClick={planActions.handleSave}
					disabled={isLoading}
					className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
				>
					{isLoading ? 'Saving...' : 'Save'}
				</button>
				<button
					onClick={handleDeleteClick}
					disabled={isLoading}
					className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
					aria-label="Delete all recipes for this week"
				>
					Delete
				</button>
				<button
					onClick={planActions.handleCancel}
					className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-1.5 rounded text-sm font-medium transition-colors"
				>
					Cancel
				</button>
			</div>

			<ConfirmDialog
				isOpen={showDeleteConfirm}
				title="Delete Week Plan"
				message="Are you sure you want to delete all recipes for this week? This action cannot be undone."
				confirmLabel="Delete"
				cancelLabel="Cancel"
				onConfirm={handleConfirmDelete}
				onCancel={() => setShowDeleteConfirm(false)}
			/>
		</>
	);
}
