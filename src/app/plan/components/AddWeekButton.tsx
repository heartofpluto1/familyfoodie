import React from 'react';
import { PlusIcon } from '@/app/components/Icons';

interface AddWeekButtonProps {
	onAddWeek: () => Promise<void>;
	isLoading?: boolean;
	nextWeekNumber?: number;
}

export function AddWeekButton({ onAddWeek, isLoading = false, nextWeekNumber }: AddWeekButtonProps) {
	return (
		<div className="flex justify-center mb-8">
			<button
				onClick={onAddWeek}
				disabled={isLoading}
				className="btn-default flex items-center gap-2 px-4 py-2 rounded-lg font-medium disabled:opacity-50"
				aria-label="Add next week to plan"
			>
				<PlusIcon className="w-4 h-4" />
				{isLoading ? 'Adding Week...' : nextWeekNumber ? `Week ${nextWeekNumber}` : 'Next Week'}
			</button>
		</div>
	);
}
