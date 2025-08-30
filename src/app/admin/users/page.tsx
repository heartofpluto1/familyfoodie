import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import HeaderPage from '@/app/components/HeaderPage';
import UsersClient from './users-client';

export const dynamic = 'force-dynamic'; // Important for authenticated pages

export const metadata: Metadata = {
	title: 'User Management | Admin',
	description: 'Manage FamilyFoodie users',
};

export default async function UsersPage() {
	const session = await getServerSession(authOptions);
	if (!session || !session.user?.is_admin) {
		redirect('/auth/signin');
	}

	return (
		<main className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<HeaderPage title="User Management" subtitle="Manage user accounts, permissions, and access levels for FamilyFoodie" />
			</div>
			<UsersClient />
		</main>
	);
}
