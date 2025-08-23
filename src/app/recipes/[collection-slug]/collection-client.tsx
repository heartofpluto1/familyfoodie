'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { Recipe } from '@/types/menus';
import { Collection } from '@/lib/queries/collections';
import RecipeList from '@/app/components/RecipeList';
import CollectionCardSmall from '@/app/components/CollectionCardSmall';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import { useToast } from '@/app/components/ToastProvider';
import { EditIcon, TrashIcon } from '@/app/components/Icons';
import { getCollectionImageUrl, getCollectionDarkImageUrl } from '@/lib/utils/secureFilename';
import { generateSlugPath, generateSlugFromTitle } from '@/lib/utils/urlHelpers';

interface CollectionClientProps {
	recipes: Recipe[];
	collections: Collection[];
	selectedCollection?: Collection | null;
}

const CollectionClient = ({ recipes, collections, selectedCollection }: CollectionClientProps) => {
	const { showToast } = useToast();

	// Generate collection slug for import URL
	const collectionSlug = selectedCollection
		? selectedCollection.url_slug
			? generateSlugPath(selectedCollection.id, selectedCollection.url_slug)
			: generateSlugFromTitle(selectedCollection.id, selectedCollection.title)
		: null;
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const getSubtitle = () => {
		if (selectedCollection) {
			return `${recipes.length} recipes in this collection`;
		}
		return `Discover from ${recipes.length} delicious recipes in our collection`;
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

	return (
		<>
			<div className="mb-8">
				{selectedCollection && (
					<div className="mb-4">
						<Link href="/recipes" className="text-muted text-sm">
							← Back to Collections
						</Link>
					</div>
				)}
			</div>

			{/* Small Collection Card Display */}
			{selectedCollection && (
				<div className="mb-8">
					<div className="flex items-center gap-6">
						<CollectionCardSmall
							coverImage={getCollectionImageUrl(selectedCollection.filename)}
							darkCoverImage={getCollectionDarkImageUrl(selectedCollection.filename_dark)}
							title={selectedCollection.title}
							subtitle={selectedCollection.subtitle || undefined}
							subscribed={true}
						/>
						<div className="group">
							<h2 className="text-2xl text-foreground">{selectedCollection.title}</h2>
							{selectedCollection.subtitle && <p className="text-sm text-muted">{selectedCollection.subtitle}</p>}
							<p className="text-sm text-muted pt-4">{getSubtitle()}</p>

							{/* Edit and Delete Buttons */}
							<div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
								<button
									onClick={() => {
										// TODO: Handle edit
										console.log('Edit collection:', selectedCollection.id);
									}}
									className="btn-default inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
									title="Edit collection"
								>
									<EditIcon className="w-3 h-3" />
									Edit
								</button>
								<button
									onClick={() => handleDeleteClick(selectedCollection)}
									className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-full text-sm transition-colors"
									title="Delete collection"
								>
									<TrashIcon className="w-3 h-3" />
									Delete
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			<Suspense fallback={<div>Loading recipes...</div>}>
				{selectedCollection && collectionSlug ? (
					<RecipeList recipes={recipes} collections={collections} collectionSlug={collectionSlug} />
				) : (
					<div>Loading collection...</div>
				)}
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
		</>
	);
};

export default CollectionClient;
