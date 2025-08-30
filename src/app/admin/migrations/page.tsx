import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import HeaderPage from '@/app/components/HeaderPage';
import MigrationsClient from './migrations-client';

export const dynamic = 'force-dynamic'; // Important for authenticated pages

export const metadata: Metadata = {
	title: 'Database Migrations | Admin',
	description: 'View and manage database migrations',
};

export default async function MigrationsPage() {
	const session = await getServerSession(authOptions);
	if (!session || !session.user?.is_admin) {
		redirect('/auth/signin');
	}

	return (
		<main className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<HeaderPage title="Database Migrations" subtitle="View migration status and run pending migrations" />
			</div>

			<MigrationsClient />
		</main>
	);
}
