import { Metadata } from 'next';
import CollectionAddClient from './collection-add-client';
import withAuth from '@/app/components/withAuth';

export const metadata: Metadata = {
	title: 'Add Collection | Family Foodie',
	description: 'Create a new recipe collection',
};

function CollectionAddPage() {
	return <CollectionAddClient />;
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
export default withAuth(CollectionAddPage);
