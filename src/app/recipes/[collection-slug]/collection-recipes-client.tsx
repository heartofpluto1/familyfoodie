'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { Recipe } from '@/types/menus';
import { Collection } from '@/lib/queries/collections';
import RecipeCard from '@/app/components/RecipeCard';
import { SparklesIcon } from '@/app/components/Icons';
import { getCollectionImageUrl, getCollectionDarkImageUrl } from '@/lib/utils/secureFilename';
import { generateSlugPath, generateSlugFromTitle } from '@/lib/utils/urlHelpers';

interface CollectionRecipesClientProps {
	recipes: Recipe[];
	collection: Collection;
}

const CollectionRecipesClient = ({ recipes, collection }: CollectionRecipesClientProps) => {
	const collectionSlug = collection.url_slug ? generateSlugPath(collection.id, collection.url_slug) : generateSlugFromTitle(collection.id, collection.title);

	return (
		<>
			<div className="mb-8">
				<div className="mb-4">
					<Link href="/recipes" className="text-muted text-sm">
						← Back to Collections
					</Link>
				</div>

				{/* Collection Header */}
				<div className="flex items-center gap-6">
					<div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 shadow-md">
						<picture className="w-full h-full">
							<source srcSet={getCollectionDarkImageUrl(collection.filename_dark)} media="(prefers-color-scheme: dark)" />
							<source srcSet={getCollectionImageUrl(collection.filename)} media="(prefers-color-scheme: light)" />
							<img src={getCollectionImageUrl(collection.filename)} alt={collection.title} className="w-full h-full object-cover" />
						</picture>
					</div>
					<div className="flex-1">
						<div className="flex items-center justify-between">
							<div>
								<h1 className="text-2xl font-bold text-foreground">{collection.title}</h1>
								{collection.subtitle && <p className="text-sm text-muted mt-1">{collection.subtitle}</p>}
								<p className="text-sm text-muted mt-2">{recipes.length} recipes in this collection</p>
							</div>
							<Link
								href={`/recipes/${collectionSlug}/import`}
								className="inline-flex items-center bg-blue-600 hover:bg-blue-700 gap-2 px-4 py-2 text-white rounded-sm transition-colors shadow-md hover:shadow-lg"
							>
								<SparklesIcon className="w-4 h-4" />
								Import Recipe
							</Link>
						</div>
					</div>
				</div>
			</div>

			{/* Recipes Grid */}
			<Suspense fallback={<div>Loading recipes...</div>}>
				{recipes.length === 0 ? (
					<div className="text-center py-16">
						<div className="max-w-md mx-auto">
							<h3 className="text-xl font-medium text-foreground mb-2">No recipes yet</h3>
							<p className="text-muted mb-6">Start building your collection by importing your first recipe using our AI-powered PDF import.</p>
							<Link
								href={`/recipes/${collectionSlug}/import`}
								className="inline-flex items-center bg-blue-600 hover:bg-blue-700 gap-2 px-4 py-2 text-white rounded-sm transition-colors shadow-md hover:shadow-lg"
							>
								<SparklesIcon className="w-4 h-4" />
								Import First Recipe
							</Link>
						</div>
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
						{recipes.map(recipe => (
							<RecipeCard key={recipe.id} recipe={recipe} />
						))}
					</div>
				)}
			</Suspense>
		</>
	);
};

export default CollectionRecipesClient;
