'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Collection } from '@/lib/queries/collections';
import CollectionCard from '@/app/components/CollectionCard';
import CollectionCardSmall from '@/app/components/CollectionCardSmall';
import HeaderPage from '@/app/components/HeaderPage';
import { PlusIcon, BookStackIcon } from '@/app/components/Icons';
import { getCollectionImageUrl, getCollectionDarkImageUrl } from '@/lib/utils/secureFilename';

interface CollectionsPageClientProps {
	myCollections: Collection[];
	publicCollections: Collection[];
}

const CollectionsPageClient = ({ myCollections, publicCollections }: CollectionsPageClientProps) => {
	const [subscriptionLoading, setSubscriptionLoading] = useState<number | null>(null);

	const handleToggleSubscription = async (collection: Collection) => {
		setSubscriptionLoading(collection.id);

		try {
			const response = await fetch(`/api/collections/${collection.id}/toggle-subscription`, {
				method: 'POST',
			});

			if (!response.ok) {
				const error = await response.json();
				console.error('Failed to toggle subscription:', error.error);
				return;
			}

			// Refresh the page to update the collections
			window.location.reload();
		} catch (error) {
			console.error('Error toggling subscription:', error);
		} finally {
			setSubscriptionLoading(null);
		}
	};
	return (
		<>
			{/* Header with Add Collection button */}
			<div className="mb-8">
				<div className="flex items-center justify-between">
					<div>
						<HeaderPage title="My Collections" subtitle="Collections you own or subscribe to - available for meal planning" />
					</div>
					<Link
						href="/recipes/collection-add"
						className="inline-flex items-center justify-center btn-default w-10 h-10 rounded-full hover:shadow-sm"
						title="Add Collection"
					>
						<PlusIcon className="w-5 h-5 text-background" />
					</Link>
				</div>
			</div>

			{/* My Collections Section */}
			<section className="mb-12">
				{myCollections.length > 0 ? (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
						{myCollections.map(collection => (
							<div key={collection.id}>
								{collection.access_type === 'owned' ? (
									// Owned collections - no subscription button, wrap in Link
									<Link href={`/recipes/${collection.url_slug}`} className="block hover:scale-105 hover:rotate-1 transition-transform duration-200">
										<CollectionCard
											coverImage={getCollectionImageUrl(collection.filename)}
											darkCoverImage={getCollectionDarkImageUrl(collection.filename_dark)}
											title={collection.title}
											subtitle={collection.subtitle || undefined}
											subscribed={false}
											recipeCount={collection.recipe_count}
											showOverlay={collection.show_overlay}
										/>
									</Link>
								) : (
									// Subscribed collections - show unsubscribe button, wrap in Link
									<Link href={`/recipes/${collection.url_slug}`} className="block hover:scale-105 hover:rotate-1 transition-transform duration-200">
										<CollectionCard
											coverImage={getCollectionImageUrl(collection.filename)}
											darkCoverImage={getCollectionDarkImageUrl(collection.filename_dark)}
											title={collection.title}
											subtitle={collection.subtitle || undefined}
											subscribed={true}
											recipeCount={collection.recipe_count}
											showOverlay={collection.show_overlay}
											onToggleSubscription={() => handleToggleSubscription(collection)}
											isLoading={subscriptionLoading === collection.id}
										/>
									</Link>
								)}
							</div>
						))}
					</div>
				) : (
					<div className="text-center py-12 bg-surface border border-custom rounded-sm">
						<BookStackIcon className="w-16 h-16 text-muted mx-auto mb-4" />
						<p className="text-muted text-lg mb-2">No collections yet</p>
						<p className="text-muted text-sm">Create your first collection or subscribe to public collections below</p>
					</div>
				)}
			</section>

			{/* Browse Public Collections Section */}
			<section>
				<div className="mb-6">
					<h2 className="text-2xl text-foreground">Browse Public Collections</h2>
					<p className="text-sm text-muted">Discover collections shared by other households</p>
				</div>

				{publicCollections.length > 0 ? (
					<div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
						{publicCollections.map(collection => (
							<div key={collection.id} className="relative">
								{/* All collections should be clickable */}
								<Link href={`/recipes/${collection.url_slug}`} className="block hover:scale-105 hover:rotate-1 transition-transform duration-200">
									<CollectionCardSmall
										coverImage={getCollectionImageUrl(collection.filename)}
										darkCoverImage={getCollectionDarkImageUrl(collection.filename_dark)}
										title={collection.title}
										subtitle={collection.subtitle || undefined}
										subscribed={collection.access_type === 'subscribed'}
										recipeCount={collection.recipe_count}
										showOverlay={collection.show_overlay}
										onToggleSubscription={collection.access_type !== 'owned' ? () => handleToggleSubscription(collection) : undefined}
										isLoading={subscriptionLoading === collection.id}
									/>
								</Link>
							</div>
						))}
					</div>
				) : (
					<div className="text-center py-8 bg-surface border border-custom rounded-sm">
						<p className="text-muted text-lg">No public collections available</p>
					</div>
				)}
			</section>
		</>
	);
};

export default CollectionsPageClient;
