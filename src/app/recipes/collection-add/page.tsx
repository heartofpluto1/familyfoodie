import { auth } from '@/auth';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import CollectionAddClient from './collection-add-client';

export const dynamic = 'force-dynamic'; // Important for authenticated pages

export const metadata: Metadata = {
	title: 'Add Collection | Family Foodie',
	description: 'Create a new recipe collection',
};

export default async function CollectionAddPage() {
	const session = await auth();
	if (!session || !session.user?.household_id) {
		redirect('/auth/signin');
	}

	return <CollectionAddClient />;
}
