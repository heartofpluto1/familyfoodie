import { Metadata } from 'next';
import withAuth from '@/app/components/withAuth';
import UsersClient from './users-client';

export const metadata: Metadata = {
	title: 'User Management | Admin',
	description: 'Manage FamilyFoodie users',
};

async function UsersPage() {
	return (
		<main className="container mx-auto px-4 py-8">
			<UsersClient />
		</main>
	);
}

// Force dynamic rendering for admin pages
export const dynamic = 'force-dynamic';

export default withAuth(UsersPage);
