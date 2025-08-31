'use client';

import Link from 'next/link';
import HeaderPage from '@/app/components/HeaderPage';
import CollectionForm from '../components/CollectionForm';

const CollectionAddClient = () => {
	return (
		<main className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<div className="mb-4">
					<Link href="/recipes" className="text-muted hover:text-foreground text-sm">
						← Back to Collections
					</Link>
				</div>
				<HeaderPage title="Add New Collection" subtitle="Create a new recipe collection with light and dark mode images" />
			</div>

			<CollectionForm mode="create" />
		</main>
	);
};

export default CollectionAddClient;
