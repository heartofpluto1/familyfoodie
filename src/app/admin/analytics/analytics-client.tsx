'use client';

import { useState } from 'react';
import { TrashIcon } from '@/app/components/Icons';
import ConfirmDialog from '@/app/components/ConfirmDialog';

interface OrphanedFile {
	filename: string;
	type: 'collection' | 'recipe-image' | 'recipe-pdf';
	size?: number;
}

interface OrphanedRecord {
	id: number;
	name: string;
	type: string;
	household_id?: number;
}

interface FileStats {
	total: number;
	totalSize: number;
	orphaned: number;
	orphanedSize: number;
}

interface AnalyticsData {
	orphanedCollectionFiles: OrphanedFile[];
	collectionStats: FileStats;
	orphanedRecipeImages: OrphanedFile[];
	orphanedRecipePdfs: OrphanedFile[];
	imageStats: FileStats;
	pdfStats: FileStats;
	orphanedCollections: OrphanedRecord[];
	orphanedIngredients: OrphanedRecord[];
	orphanedRecipes: OrphanedRecord[];
	useGCS: boolean;
	bucketName?: string;
}

function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function AnalyticsContent({ data }: { data: AnalyticsData }) {
	const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
	const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());
	const [confirmDialog, setConfirmDialog] = useState<{
		isOpen: boolean;
		title: string;
		message: string;
		onConfirm: () => void;
	}>({
		isOpen: false,
		title: '',
		message: '',
		onConfirm: () => {},
	});

	const handleDelete = async (type: string, id?: number, filename?: string) => {
		const itemKey = `${type}-${id || filename}`;
		
		// Determine the item description for the confirm dialog
		let itemDescription = '';
		if (type === 'collection-file') {
			itemDescription = `collection file "${filename}"`;
		} else if (type === 'recipe-image') {
			itemDescription = `recipe image "${filename}"`;
		} else if (type === 'recipe-pdf') {
			itemDescription = `recipe PDF "${filename}"`;
		} else if (type === 'collection') {
			itemDescription = 'this empty collection';
		} else if (type === 'ingredient') {
			itemDescription = 'this orphaned ingredient';
		} else if (type === 'recipe') {
			itemDescription = 'this orphaned recipe';
		}

		setConfirmDialog({
			isOpen: true,
			title: 'Confirm Deletion',
			message: `Are you sure you want to delete ${itemDescription}? This action cannot be undone.`,
			onConfirm: async () => {
				setConfirmDialog(prev => ({ ...prev, isOpen: false }));
				setDeletingItems(prev => new Set(prev).add(itemKey));

				try {
					const response = await fetch('/api/admin/delete-orphaned', {
						method: 'DELETE',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ type, id, filename }),
					});

					if (!response.ok) {
						throw new Error('Failed to delete');
					}

					// Hide the item after successful deletion
					setHiddenItems(prev => new Set(prev).add(itemKey));
				} catch (error) {
					console.error('Error deleting item:', error);
					alert('Failed to delete item. Please try again.');
				} finally {
					setDeletingItems(prev => {
						const newSet = new Set(prev);
						newSet.delete(itemKey);
						return newSet;
					});
				}
			},
		});
	};

	const isHidden = (type: string, id?: number, filename?: string) => {
		return hiddenItems.has(`${type}-${id || filename}`);
	};

	const isDeleting = (type: string, id?: number, filename?: string) => {
		return deletingItems.has(`${type}-${id || filename}`);
	};

	// Filter out hidden items from counts
	const visibleCollectionFiles = data.orphanedCollectionFiles.filter(f => !isHidden('collection-file', undefined, f.filename));
	const visibleRecipeImages = data.orphanedRecipeImages.filter(f => !isHidden('recipe-image', undefined, f.filename));
	const visibleRecipePdfs = data.orphanedRecipePdfs.filter(f => !isHidden('recipe-pdf', undefined, f.filename));
	const visibleCollections = data.orphanedCollections.filter(c => !isHidden('collection', c.id));
	const visibleIngredients = data.orphanedIngredients.filter(i => !isHidden('ingredient', i.id));
	const visibleRecipes = data.orphanedRecipes.filter(r => !isHidden('recipe', r.id));

	return (
		<div className="space-y-8">
			{/* Orphaned Collection Files */}
			<section className="bg-surface border border-custom rounded-sm shadow-sm p-6">
				<h2 className="text-xl font-normal mb-4 text-foreground flex items-center gap-2">
					<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
					Collection Files
				</h2>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
					<div>
						<div className="text-sm text-muted">Total Files</div>
						<div className="text-lg font-semibold">{data.collectionStats.total}</div>
					</div>
					<div>
						<div className="text-sm text-muted">Total Size</div>
						<div className="text-lg font-semibold">{formatFileSize(data.collectionStats.totalSize)}</div>
					</div>
					<div>
						<div className="text-sm text-muted">Orphaned</div>
						<div className="text-lg font-semibold text-orange-600">{visibleCollectionFiles.length}</div>
					</div>
					<div>
						<div className="text-sm text-muted">Orphaned Size</div>
						<div className="text-lg font-semibold text-orange-600">
							{formatFileSize(visibleCollectionFiles.reduce((sum, f) => sum + (f.size || 0), 0))}
						</div>
					</div>
				</div>
				{visibleCollectionFiles.length > 0 ? (
					<div className="bg-gray-50 dark:bg-gray-800 rounded p-4 max-h-64 overflow-y-auto">
						<ul className="space-y-1 text-sm">
							{visibleCollectionFiles.map((file, index) => (
								<li key={index} className="text-muted flex items-center justify-between hover:bg-gray-300 dark:hover:bg-gray-900 px-2 py-1 rounded transition-colors">
									{data.useGCS ? (
										<span className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
											{`gs://${data.bucketName}/collections/${file.filename}`}
										</span>
									) : (
										<a 
											href={`/collections/${file.filename}`} 
											target="_blank" 
											rel="noopener noreferrer"
											className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
										>
											{`/collections/${file.filename}`}
										</a>
									)}
									<button
										onClick={() => handleDelete('collection-file', undefined, file.filename)}
										disabled={isDeleting('collection-file', undefined, file.filename)}
										className="text-red-600 hover:text-red-700 disabled:opacity-50 ml-2"
										title="Delete"
									>
										{isDeleting('collection-file', undefined, file.filename) ? (
											<span className="text-xs">Deleting...</span>
										) : (
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
											</svg>
										)}
									</button>
								</li>
							))}
						</ul>
					</div>
				) : (
					<p className="text-muted">No orphaned collection files found.</p>
				)}
			</section>

			{/* Orphaned Recipe Images */}
			<section className="bg-surface border border-custom rounded-sm shadow-sm p-6">
				<h2 className="text-xl font-normal mb-4 text-foreground flex items-center gap-2">
					<svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
					Recipe Images
				</h2>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
					<div>
						<div className="text-sm text-muted">Total Files</div>
						<div className="text-lg font-semibold">{data.imageStats.total}</div>
					</div>
					<div>
						<div className="text-sm text-muted">Total Size</div>
						<div className="text-lg font-semibold">{formatFileSize(data.imageStats.totalSize)}</div>
					</div>
					<div>
						<div className="text-sm text-muted">Orphaned</div>
						<div className="text-lg font-semibold text-orange-600">{visibleRecipeImages.length}</div>
					</div>
					<div>
						<div className="text-sm text-muted">Orphaned Size</div>
						<div className="text-lg font-semibold text-orange-600">
							{formatFileSize(visibleRecipeImages.reduce((sum, f) => sum + (f.size || 0), 0))}
						</div>
					</div>
				</div>
				{visibleRecipeImages.length > 0 ? (
					<div className="bg-gray-50 dark:bg-gray-800 rounded p-4 max-h-64 overflow-y-auto">
						<ul className="space-y-1 text-sm">
							{visibleRecipeImages.map((file, index) => (
								<li key={index} className="text-muted flex items-center justify-between hover:bg-gray-300 dark:hover:bg-gray-900 px-2 py-1 rounded transition-colors">
									{data.useGCS ? (
										<span className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
											{`gs://${data.bucketName}/${file.filename}`}
										</span>
									) : (
										<a 
											href={`/static/${file.filename}`} 
											target="_blank" 
											rel="noopener noreferrer"
											className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
										>
											{`/static/${file.filename}`}
										</a>
									)}
									<button
										onClick={() => handleDelete('recipe-image', undefined, file.filename)}
										disabled={isDeleting('recipe-image', undefined, file.filename)}
										className="text-red-600 hover:text-red-700 disabled:opacity-50 ml-2"
										title="Delete"
									>
										{isDeleting('recipe-image', undefined, file.filename) ? (
											<span className="text-xs">Deleting...</span>
										) : (
											<TrashIcon className="w-4 h-4" />
										)}
									</button>
								</li>
							))}
						</ul>
					</div>
				) : (
					<p className="text-muted">No orphaned recipe images found.</p>
				)}
			</section>

			{/* Orphaned Recipe PDFs */}
			<section className="bg-surface border border-custom rounded-sm shadow-sm p-6">
				<h2 className="text-xl font-normal mb-4 text-foreground flex items-center gap-2">
					<svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
					</svg>
					Recipe PDFs
				</h2>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
					<div>
						<div className="text-sm text-muted">Total Files</div>
						<div className="text-lg font-semibold">{data.pdfStats.total}</div>
					</div>
					<div>
						<div className="text-sm text-muted">Total Size</div>
						<div className="text-lg font-semibold">{formatFileSize(data.pdfStats.totalSize)}</div>
					</div>
					<div>
						<div className="text-sm text-muted">Orphaned</div>
						<div className="text-lg font-semibold text-orange-600">{visibleRecipePdfs.length}</div>
					</div>
					<div>
						<div className="text-sm text-muted">Orphaned Size</div>
						<div className="text-lg font-semibold text-orange-600">
							{formatFileSize(visibleRecipePdfs.reduce((sum, f) => sum + (f.size || 0), 0))}
						</div>
					</div>
				</div>
				{visibleRecipePdfs.length > 0 ? (
					<div className="bg-gray-50 dark:bg-gray-800 rounded p-4 max-h-64 overflow-y-auto">
						<ul className="space-y-1 text-sm">
							{visibleRecipePdfs.map((file, index) => (
								<li key={index} className="text-muted flex items-center justify-between hover:bg-gray-300 dark:hover:bg-gray-900 px-2 py-1 rounded transition-colors">
									{data.useGCS ? (
										<span className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
											{`gs://${data.bucketName}/${file.filename}`}
										</span>
									) : (
										<a 
											href={`/static/${file.filename}`} 
											target="_blank" 
											rel="noopener noreferrer"
											className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
										>
											{`/static/${file.filename}`}
										</a>
									)}
									<button
										onClick={() => handleDelete('recipe-pdf', undefined, file.filename)}
										disabled={isDeleting('recipe-pdf', undefined, file.filename)}
										className="text-red-600 hover:text-red-700 disabled:opacity-50 p-1 ml-2"
										title="Delete"
									>
										{isDeleting('recipe-pdf', undefined, file.filename) ? (
											<span className="text-xs">Deleting...</span>
										) : (
											<TrashIcon className="w-4 h-4" />
										)}
									</button>
								</li>
							))}
						</ul>
					</div>
				) : (
					<p className="text-muted">No orphaned recipe PDFs found.</p>
				)}
			</section>

			{/* Empty Collections */}
			<section className="bg-surface border border-custom rounded-sm shadow-sm p-6">
				<h2 className="text-xl font-normal mb-4 text-foreground flex items-center gap-2">
					<svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
					</svg>
					Empty Collections
					<span className="text-sm font-normal text-muted">({visibleCollections.length} found)</span>
				</h2>
				<p className="text-sm text-muted mb-2">Collections with no recipes</p>
				{visibleCollections.length > 0 ? (
					<div className="bg-gray-50 dark:bg-gray-800 rounded p-4 max-h-64 overflow-y-auto">
						<ul className="space-y-1 text-sm">
							{visibleCollections.map(collection => (
								<li key={collection.id} className="text-muted flex items-center justify-between hover:bg-gray-300 dark:hover:bg-gray-900 px-2 py-1 rounded transition-colors">
									<span>
										<span className="font-mono text-xs text-gray-400">[HH:{collection.household_id}]</span>
										<span className="font-mono text-xs text-gray-500 ml-2">#{collection.id}</span> {collection.name}
									</span>
									<button
										onClick={() => handleDelete('collection', collection.id)}
										disabled={isDeleting('collection', collection.id)}
										className="text-red-600 hover:text-red-700 disabled:opacity-50 p-1 ml-2"
										title="Delete"
									>
										{isDeleting('collection', collection.id) ? (
											<span className="text-xs">Deleting...</span>
										) : (
											<TrashIcon className="w-4 h-4" />
										)}
									</button>
								</li>
							))}
						</ul>
					</div>
				) : (
					<p className="text-muted">No empty collections found.</p>
				)}
			</section>

			{/* Orphaned Ingredients */}
			<section className="bg-surface border border-custom rounded-sm shadow-sm p-6">
				<h2 className="text-xl font-normal mb-4 text-foreground flex items-center gap-2">
					<svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
					</svg>
					Orphaned Ingredients
					<span className="text-sm font-normal text-muted">({visibleIngredients.length} found)</span>
				</h2>
				{visibleIngredients.length > 0 ? (
					<div className="bg-gray-50 dark:bg-gray-800 rounded p-4 max-h-64 overflow-y-auto">
						<ul className="space-y-1 text-sm">
							{visibleIngredients.map(ingredient => (
								<li key={ingredient.id} className="text-muted flex items-center justify-between hover:bg-gray-300 dark:hover:bg-gray-900 px-2 py-1 rounded transition-colors">
									<span>
										<span className="font-mono text-xs text-gray-400">[HH:{ingredient.household_id}]</span>
										<span className="font-mono text-xs text-gray-500 ml-2">#{ingredient.id}</span> {ingredient.name}
									</span>
									<button
										onClick={() => handleDelete('ingredient', ingredient.id)}
										disabled={isDeleting('ingredient', ingredient.id)}
										className="text-red-600 hover:text-red-700 disabled:opacity-50 p-1 ml-2"
										title="Delete"
									>
										{isDeleting('ingredient', ingredient.id) ? (
											<span className="text-xs">Deleting...</span>
										) : (
											<TrashIcon className="w-4 h-4" />
										)}
									</button>
								</li>
							))}
						</ul>
					</div>
				) : (
					<p className="text-muted">No orphaned ingredients found.</p>
				)}
			</section>

			{/* Orphaned Recipes */}
			<section className="bg-surface border border-custom rounded-sm shadow-sm p-6">
				<h2 className="text-xl font-normal mb-4 text-foreground flex items-center gap-2">
					<svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
					</svg>
					Orphaned Recipes
					<span className="text-sm font-normal text-muted">({visibleRecipes.length} found)</span>
				</h2>
				<p className="text-sm text-muted mb-2">Recipes not referenced in any collection or meal plan</p>
				{visibleRecipes.length > 0 ? (
					<div className="bg-gray-50 dark:bg-gray-800 rounded p-4 max-h-64 overflow-y-auto">
						<ul className="space-y-1 text-sm">
							{visibleRecipes.map(recipe => (
								<li key={recipe.id} className="text-muted flex items-center justify-between hover:bg-gray-300 dark:hover:bg-gray-900 px-2 py-1 rounded transition-colors">
									<span>
										<span className="font-mono text-xs text-gray-400">[HH:{recipe.household_id}]</span>
										<span className="font-mono text-xs text-gray-500 ml-2">#{recipe.id}</span> {recipe.name}
									</span>
									<button
										onClick={() => handleDelete('recipe', recipe.id)}
										disabled={isDeleting('recipe', recipe.id)}
										className="text-red-600 hover:text-red-700 disabled:opacity-50 p-1 ml-2"
										title="Delete"
									>
										{isDeleting('recipe', recipe.id) ? (
											<span className="text-xs">Deleting...</span>
										) : (
											<TrashIcon className="w-4 h-4" />
										)}
									</button>
								</li>
							))}
						</ul>
					</div>
				) : (
					<p className="text-muted">No orphaned recipes found.</p>
				)}
			</section>

			{/* Summary Statistics */}
			<section className="bg-surface border border-custom rounded-sm shadow-sm p-6">
				<h2 className="text-xl font-normal mb-4 text-foreground">
					Summary {data.useGCS && <span className="text-sm font-normal text-muted">(GCS: {data.bucketName})</span>}
				</h2>
				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
					<div className="text-center">
						<div className="text-2xl font-bold text-blue-600">{visibleCollectionFiles.length}</div>
						<div className="text-sm text-muted">Collection Files</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold text-green-600">{visibleRecipeImages.length}</div>
						<div className="text-sm text-muted">Recipe Images</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold text-red-600">{visibleRecipePdfs.length}</div>
						<div className="text-sm text-muted">Recipe PDFs</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold text-indigo-600">{visibleCollections.length}</div>
						<div className="text-sm text-muted">Empty Collections</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold text-yellow-600">{visibleIngredients.length}</div>
						<div className="text-sm text-muted">Ingredients</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold text-purple-600">{visibleRecipes.length}</div>
						<div className="text-sm text-muted">Recipes</div>
					</div>
				</div>
				<div className="mt-4 pt-4 border-t border-custom space-y-2">
					<p className="text-sm text-muted">
						Total orphaned assets:{' '}
						<span className="font-semibold text-foreground">
							{visibleCollectionFiles.length +
								visibleRecipeImages.length +
								visibleRecipePdfs.length +
								visibleCollections.length +
								visibleIngredients.length +
								visibleRecipes.length}
						</span>
					</p>
					<p className="text-sm text-muted">
						Total storage usage:{' '}
						<span className="font-semibold text-foreground">
							{formatFileSize(data.collectionStats.totalSize + data.imageStats.totalSize + data.pdfStats.totalSize)}
						</span>
						{' '}across{' '}
						<span className="font-semibold text-foreground">
							{data.collectionStats.total + data.imageStats.total + data.pdfStats.total}
						</span>
						{' '}files
					</p>
					<p className="text-sm text-muted">
						Orphaned storage:{' '}
						<span className="font-semibold text-orange-600">
							{formatFileSize(
								visibleCollectionFiles.reduce((sum, f) => sum + (f.size || 0), 0) +
								visibleRecipeImages.reduce((sum, f) => sum + (f.size || 0), 0) +
								visibleRecipePdfs.reduce((sum, f) => sum + (f.size || 0), 0)
							)}
						</span>
						{' '}({Math.round(((data.collectionStats.orphanedSize + data.imageStats.orphanedSize + data.pdfStats.orphanedSize) /
							(data.collectionStats.totalSize + data.imageStats.totalSize + data.pdfStats.totalSize || 1)) * 100)}% of total)
					</p>
				</div>
			</section>

			{/* Confirm Dialog */}
			<ConfirmDialog
				isOpen={confirmDialog.isOpen}
				title={confirmDialog.title}
				message={confirmDialog.message}
				confirmText="Delete"
				cancelText="Cancel"
				onConfirm={confirmDialog.onConfirm}
				onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
			/>
		</div>
	);
}