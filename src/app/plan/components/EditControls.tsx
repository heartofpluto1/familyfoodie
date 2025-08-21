import React from 'react';
import { PlanActions } from '@/types/plan';
import { ConfirmDialog } from './ConfirmDialog';
import { IntroShoppingCartIcon } from '@/app/components/Icons';

interface EditControlsProps {
	isEditMode: boolean;
	isLoading: boolean;
	planActions: PlanActions;
	week?: number;
	year?: number;
}

export function EditControls({ isEditMode, isLoading, planActions, week, year }: EditControlsProps) {
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
			<div className="mb-6 flex justify-between items-center">
				<button onClick={planActions.handleEdit} disabled={isLoading} className="btn-default px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50">
					{isLoading ? 'Loading recipes...' : 'Edit Week'}
				</button>

				{week && year && (
					<a href={`/shop/${year}/${week}`} className="btn-default px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2">
						<IntroShoppingCartIcon className="w-4 h-4" />
						Shopping List
					</a>
				)}
			</div>
		);
	}

	return (
		<>
			<div className="week-controls mb-6 flex gap-2 flex-wrap">
				<button
					onClick={planActions.handleAutomate}
					disabled={isLoading}
					className="btn-default px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50"
				>
					Automate
				</button>
				<button onClick={planActions.handleSave} disabled={isLoading} className="btn-default px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50">
					Save
				</button>
				<button
					onClick={handleDeleteClick}
					disabled={isLoading}
					className="btn-default px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50"
					aria-label="Delete all recipes for this week"
				>
					Delete
				</button>
				<button onClick={planActions.handleCancel} className="btn-default px-3 py-1.5 rounded text-sm font-medium">
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
