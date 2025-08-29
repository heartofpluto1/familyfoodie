'use client';

import { useState } from 'react';
import { Collection } from '@/lib/queries/collections';
import { useToast } from '@/app/components/ToastProvider';
import Modal from '@/app/components/Modal';

interface CopyRecipesModalProps {
	isOpen: boolean;
	onClose: () => void;
	collections: Collection[];
	selectedRecipeIds: Set<number>;
	currentCollectionId: number;
	onSuccess: () => void;
}

const CopyRecipesModal = ({ isOpen, onClose, collections, selectedRecipeIds, currentCollectionId, onSuccess }: CopyRecipesModalProps) => {
	const { showToast } = useToast();
	const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
	const [isCopying, setIsCopying] = useState(false);

	// Filter out the current collection from the options
	const availableCollections = collections.filter(c => c.id !== currentCollectionId);

	const handleCopy = async () => {
		if (!selectedCollectionId) {
			showToast('warning', 'No collection selected', 'Please select a collection to copy recipes to');
			return;
		}

		setIsCopying(true);
		try {
			const response = await fetch('/api/recipe/copy', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					recipeIds: Array.from(selectedRecipeIds),
					targetCollectionId: selectedCollectionId,
				}),
			});

			let result;
			try {
				result = await response.json();
			} catch {
				// If response isn't JSON, create a basic error object
				result = { success: false, error: 'Failed to copy recipes' };
			}

			if (!response.ok) {
				throw new Error(result.error || 'Failed to copy recipes');
			}

			// Build success message based on what was copied and skipped
			const targetCollection = availableCollections.find(c => c.id === selectedCollectionId);
			let message = '';

			if (result.copiedCount > 0 && result.skippedCount > 0) {
				message = `Copied ${result.copiedCount} recipe${result.copiedCount !== 1 ? 's' : ''} to ${targetCollection?.title}. ${result.skippedCount} recipe${result.skippedCount !== 1 ? 's' : ''} already existed.`;
			} else if (result.copiedCount > 0) {
				message = `Successfully copied ${result.copiedCount} recipe${result.copiedCount !== 1 ? 's' : ''} to ${targetCollection?.title}`;
			} else if (result.skippedCount > 0) {
				message = `All ${result.skippedCount} recipe${result.skippedCount !== 1 ? 's' : ''} already exist in ${targetCollection?.title}`;
			}

			showToast(result.copiedCount > 0 ? 'success' : 'info', result.copiedCount > 0 ? 'Recipes Copied' : 'No New Recipes Added', message);

			// Reset state and close modal
			setSelectedCollectionId(null);
			onSuccess();
			onClose();
		} catch (error) {
			console.error('Error copying recipes:', error);
			showToast('error', 'Copy Failed', error instanceof Error ? error.message : 'Failed to copy recipes');
		} finally {
			setIsCopying(false);
		}
	};

	const handleClose = () => {
		setSelectedCollectionId(null);
		onClose();
	};

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Copy Recipes to Collection" maxWidth="md">
			<div className="mb-4">
				<p className="text-sm text-muted">
					{selectedRecipeIds.size} recipe{selectedRecipeIds.size !== 1 ? 's' : ''} selected
				</p>
			</div>

			<div className="mb-6">
				<label htmlFor="collection-select" className="block text-sm font-medium text-foreground mb-2">
					Select target collection:
				</label>
				<select
					id="collection-select"
					value={selectedCollectionId || ''}
					onChange={e => setSelectedCollectionId(Number(e.target.value))}
					className="w-full px-3 py-2 border border-custom rounded-md text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-blue-500"
					disabled={isCopying}
				>
					<option value="">Choose a collection...</option>
					{availableCollections.map(collection => (
						<option key={collection.id} value={collection.id}>
							{collection.title}
						</option>
					))}
				</select>
			</div>

			<div className="flex gap-3 justify-end">
				<button onClick={handleClose} className="btn-default px-4 py-2 rounded-md" disabled={isCopying}>
					Cancel
				</button>
				<button
					onClick={handleCopy}
					className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={!selectedCollectionId || isCopying}
				>
					{isCopying ? 'Copying...' : 'Copy to Collection'}
				</button>
			</div>
		</Modal>
	);
};

export default CopyRecipesModal;
