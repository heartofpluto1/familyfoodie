import { Metadata } from 'next';
import withAdminAuth from '@/app/components/withAdminAuth';
import HeaderPage from '@/app/components/HeaderPage';
import MigrationsClient from './migrations-client';

export const metadata: Metadata = {
	title: 'Database Migrations | Admin',
	description: 'View and manage database migrations',
};

async function MigrationsPage() {
	return (
		<main className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<HeaderPage title="Database Migrations" subtitle="View migration status and run pending migrations" />
			</div>

			<MigrationsClient />
		</main>
	);
}

// Force dynamic rendering for admin pages
export const dynamic = 'force-dynamic';

export default withAdminAuth(MigrationsPage);
