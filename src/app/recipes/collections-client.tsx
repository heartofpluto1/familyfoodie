'use client';

import React from 'react';
import Link from 'next/link';
import { Collection } from '@/lib/queries/collections';
import CollectionCard from '@/app/components/CollectionCard';
import HeaderPage from '@/app/components/HeaderPage';
import { PlusIcon } from '@/app/components/Icons';
import { generateSlugPath, generateSlugFromTitle } from '@/lib/utils/urlHelpers';
import { getCollectionImageUrl } from '@/lib/utils/secureFilename';

interface CollectionsPageClientProps {
	collections: Collection[];
}

const CollectionsPageClient = ({ collections }: CollectionsPageClientProps) => {
	return (
		<>
			<div className="mb-8">
				<div className="flex items-center justify-between">
					<HeaderPage title="My Recipe Collections" subtitle="" />
					<Link
						href="/recipes/collection-add"
						className="inline-flex items-center justify-center btn-default w-10 h-10 rounded-full hover:shadow-sm"
						title="Add Collection"
					>
						<PlusIcon className="w-5 h-5 text-background" />
					</Link>
				</div>
			</div>

			{/* Collections Grid */}
			{collections.length > 0 ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{collections.map(collection => (
						<Link
							key={collection.id}
							href={`/recipes/${collection.url_slug ? generateSlugPath(collection.id, collection.url_slug) : generateSlugFromTitle(collection.id, collection.title)}`}
							className="block hover:scale-105 hover:rotate-1 transition-transform duration-200"
						>
							<CollectionCard
								coverImage={getCollectionImageUrl(collection.filename)}
								title={collection.title}
								subtitle={collection.subtitle || undefined}
								subscribed={true}
								recipeCount={collection.recipe_count}
							/>
						</Link>
					))}
				</div>
			) : (
				<div className="text-center py-12">
					<p className="text-muted text-lg">No collections found.</p>
				</div>
			)}
		</>
	);
};

export default CollectionsPageClient;
