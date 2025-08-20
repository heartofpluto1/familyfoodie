import { Metadata } from 'next';
import withAdminAuth from '@/app/components/withAdminAuth';
import HeaderPage from '@/app/components/HeaderPage';
import UsersClient from './users-client';

export const metadata: Metadata = {
	title: 'User Management | Admin',
	description: 'Manage FamilyFoodie users',
};

async function UsersPage() {
	return (
		<main className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<HeaderPage title="User Management" subtitle="Manage user accounts, permissions, and access levels for FamilyFoodie" />
			</div>
			<UsersClient />
		</main>
	);
}

// Force dynamic rendering for admin pages
export const dynamic = 'force-dynamic';

export default withAdminAuth(UsersPage);
