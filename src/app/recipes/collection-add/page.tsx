import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import CollectionAddClient from './collection-add-client';

export const dynamic = 'force-dynamic'; // Important for authenticated pages

export const metadata: Metadata = {
	title: 'Add Collection | Family Foodie',
	description: 'Create a new recipe collection',
};

export default async function CollectionAddPage() {
	const session = await getServerSession(authOptions);
	if (!session || !session.user?.household_id) {
		redirect('/auth/signin');
	}

	return <CollectionAddClient />;
}
