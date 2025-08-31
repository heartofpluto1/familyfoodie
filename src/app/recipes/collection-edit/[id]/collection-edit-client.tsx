'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import HeaderPage from '@/app/components/HeaderPage';
import CollectionForm from '../../components/CollectionForm';

interface Collection {
	id: number;
	title: string;
	subtitle: string | null;
	filename: string;
	filename_dark: string;
	show_overlay: boolean;
	url_slug: string;
	household_id: number;
}

interface CollectionEditClientProps {
	collection: Collection;
}

const CollectionEditClient: React.FC<CollectionEditClientProps> = ({ collection }) => {
	const router = useRouter();

	const handleSuccess = () => {
		// Navigate back to the collection page after successful update
		router.push(`/recipes/${collection.url_slug}`);
	};

	const handleCancel = () => {
		// Navigate back to the collection page
		router.push(`/recipes/${collection.url_slug}`);
	};

	return (
		<main className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<div className="mb-4">
					<Link href={`/recipes/${collection.url_slug}`} className="text-muted hover:text-foreground text-sm">
						← Back to Collection
					</Link>
				</div>
				<HeaderPage title={`Edit Collection: ${collection.title}`} subtitle="Update your collection details and images" />
			</div>

			<CollectionForm mode="edit" collection={collection} onSuccess={handleSuccess} onCancel={handleCancel} />
		</main>
	);
};

export default CollectionEditClient;
