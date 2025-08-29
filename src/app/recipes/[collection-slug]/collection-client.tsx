'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { Recipe } from '@/types/menus';
import { Collection } from '@/lib/queries/collections';
import CollectionCardSmall from '@/app/components/CollectionCardSmall';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import { useToast } from '@/app/components/ToastProvider';
import { EditIcon, TrashIcon, CursorClickIcon, CopyIcon, CancelIcon } from '@/app/components/Icons';
import RecipeList from '../components/RecipeList';
import CopyRecipesModal from '../components/CopyRecipesModal';
import { getCollectionImageUrl, getCollectionDarkImageUrl } from '@/lib/utils/secureFilename';

interface CollectionClientProps {
	recipes: Recipe[];
	collections: Collection[];
	selectedCollection: Collection;
}

const CollectionClient = ({ recipes, collections, selectedCollection }: CollectionClientProps) => {
	const { showToast } = useToast();

	// Use collection slug for import URL
	const collectionSlug = selectedCollection.url_slug;
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	// Selection mode state
	const [isSelecting, setIsSelecting] = useState(false);
	const [selectedRecipeIds, setSelectedRecipeIds] = useState<Set<number>>(new Set());
	const [showCopyModal, setShowCopyModal] = useState(false);

	const getSubtitle = () => {
		return `${recipes.length} recipes in this collection`;
	};

	const handleDeleteClick = (collection: Collection) => {
		setCollectionToDelete(collection);
		setShowDeleteConfirm(true);
	};

	const handleDeleteConfirm = async () => {
		if (!collectionToDelete) return;

		setIsDeleting(true);
		try {
			const response = await fetch('/api/collections/delete', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					collectionId: collectionToDelete.id,
				}),
			});

			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.error || 'Failed to delete collection');
			}

			showToast('success', 'Success', 'Collection deleted successfully');
			setShowDeleteConfirm(false);
			setCollectionToDelete(null);

			// Redirect to recipes page after successful deletion
			window.location.href = '/recipes';
		} catch (error) {
			console.error('Error deleting collection:', error);
			showToast('error', 'Error', error instanceof Error ? error.message : 'Failed to delete collection');
		} finally {
			setIsDeleting(false);
		}
	};

	const handleDeleteCancel = () => {
		setShowDeleteConfirm(false);
		setCollectionToDelete(null);
	};

	// Selection mode handlers
	const handleEnterSelectionMode = () => {
		setIsSelecting(true);
		setSelectedRecipeIds(new Set());
	};

	const handleExitSelectionMode = () => {
		setIsSelecting(false);
		setSelectedRecipeIds(new Set());
	};

	const handleToggleRecipeSelection = (recipeId: number) => {
		setSelectedRecipeIds(prev => {
			const newSet = new Set(prev);
			if (newSet.has(recipeId)) {
				newSet.delete(recipeId);
			} else {
				newSet.add(recipeId);
			}
			return newSet;
		});
	};

	const handleCopyClick = () => {
		if (selectedRecipeIds.size === 0) {
			showToast('warning', 'No recipes selected', 'Please select at least one recipe to copy');
			return;
		}
		setShowCopyModal(true);
	};

	return (
		<>
			<div className="mb-8">
				<div className="mb-4">
					<Link href="/recipes" className="text-muted text-sm">
						← Back to Collections
					</Link>
				</div>
			</div>

			{/* Small Collection Card Display */}
			<div className="mb-8">
				<div className="flex items-center gap-6">
					<CollectionCardSmall
						coverImage={getCollectionImageUrl(selectedCollection.filename)}
						darkCoverImage={getCollectionDarkImageUrl(selectedCollection.filename_dark)}
						title={selectedCollection.title}
						subtitle={selectedCollection.subtitle || undefined}
						subscribed={true}
					/>
					<div className="flex-1">
						<div className="flex items-start justify-between">
							<div>
								<h2 className="text-2xl text-foreground">{selectedCollection.title}</h2>
								{selectedCollection.subtitle && <p className="text-sm text-muted">{selectedCollection.subtitle}</p>}
								<p className="text-sm text-muted pt-4">{getSubtitle()}</p>
							</div>
							{/* Conditional buttons based on selection mode */}
							<div className="flex gap-2">
								{isSelecting ? (
									// Selection mode: Copy and Cancel buttons with border
									<div className="flex gap-2 p-1 border border-gray-300 dark:border-gray-600 rounded-full">
										<button
											onClick={handleCopyClick}
											className="btn-default inline-flex items-center justify-center w-10 h-10 rounded-full hover:shadow transition-all"
											title={`Copy ${selectedRecipeIds.size} selected recipe${selectedRecipeIds.size !== 1 ? 's' : ''}`}
											disabled={selectedRecipeIds.size === 0}
										>
											<CopyIcon className="w-4 h-4" />
										</button>
										<button
											onClick={handleExitSelectionMode}
											className="btn-default inline-flex items-center justify-center w-10 h-10 rounded-full hover:shadow transition-all"
											title="Cancel selection"
										>
											<CancelIcon className="w-4 h-4" />
										</button>
									</div>
								) : (
									// Normal mode: Select, Edit and Delete buttons
									<>
										<button
											onClick={handleEnterSelectionMode}
											className="btn-default inline-flex items-center justify-center w-10 h-10 rounded-full hover:shadow transition-all"
											title="Select recipes"
										>
											<CursorClickIcon className="w-4 h-4" />
										</button>
										<button
											onClick={() => {
												// TODO: Handle edit
												console.log('Edit collection:', selectedCollection.id);
											}}
											className="btn-default inline-flex items-center justify-center w-10 h-10 rounded-full hover:shadow transition-all"
											title="Edit Collection"
										>
											<EditIcon className="w-4 h-4" />
										</button>
										<button
											onClick={() => handleDeleteClick(selectedCollection)}
											className="btn-default inline-flex items-center justify-center w-10 h-10 rounded-full hover:shadow transition-all"
											title="Delete Collection"
										>
											<TrashIcon className="w-4 h-4" />
										</button>
									</>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>

			<Suspense fallback={<div>Loading recipes...</div>}>
				<RecipeList
					recipes={recipes}
					collections={collections}
					collectionSlug={collectionSlug}
					isSelecting={isSelecting}
					selectedRecipeIds={selectedRecipeIds}
					onToggleSelection={handleToggleRecipeSelection}
				/>
			</Suspense>

			{/* Delete Confirmation Dialog */}
			<ConfirmDialog
				isOpen={showDeleteConfirm}
				title="Delete Collection"
				message={`Are you sure you want to delete "${collectionToDelete?.title}"? This will permanently delete the collection and all its associated files. This action cannot be undone.`}
				confirmText="Delete Collection"
				cancelText="Cancel"
				onConfirm={handleDeleteConfirm}
				onCancel={handleDeleteCancel}
				isLoading={isDeleting}
			/>

			{/* Copy Recipes Modal */}
			<CopyRecipesModal
				isOpen={showCopyModal}
				onClose={() => setShowCopyModal(false)}
				collections={collections}
				selectedRecipeIds={selectedRecipeIds}
				currentCollectionId={selectedCollection.id}
				onSuccess={() => {
					setIsSelecting(false);
					setSelectedRecipeIds(new Set());
					setShowCopyModal(false);
				}}
			/>
		</>
	);
};

export default CollectionClient;
