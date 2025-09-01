import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import HeaderPage from '@/app/components/HeaderPage';

export const dynamic = 'force-dynamic'; // Important for authenticated pages

export const metadata: Metadata = {
	title: 'Admin Dashboard',
	description: 'Administration tools and settings',
};

export default async function AdminPage() {
	const session = await getServerSession(authOptions);
	if (!session || !session.user?.is_admin) {
		redirect('/auth/signin');
	}

	return (
		<main className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<HeaderPage title="Admin Dashboard" subtitle="System administration and management tools" />
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{/* Database Migrations Card */}
				<Link
					href="/admin/migrations"
					className="block bg-surface dark:bg-gray-800 border border-custom dark:border-gray-700 rounded-sm shadow-sm hover:shadow-md dark:hover:shadow-lg transition-all p-6 hover:border-accent dark:hover:border-blue-400"
				>
					<div className="flex items-center mb-4">
						<div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-sm">
							<svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
								/>
							</svg>
						</div>
					</div>
					<h3 className="text-lg mb-2 text-foreground dark:text-gray-100">Database Migrations</h3>
					<p className="text-muted dark:text-gray-400 text-sm">View migration history, check pending migrations, and manually run database updates.</p>
				</Link>

				{/* User Management Card */}
				<Link
					href="/admin/users"
					className="block bg-surface dark:bg-gray-800 border border-custom dark:border-gray-700 rounded-sm shadow-sm hover:shadow-md dark:hover:shadow-lg transition-all p-6 hover:border-accent dark:hover:border-green-400"
				>
					<div className="flex items-center mb-4">
						<div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-sm">
							<svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
								/>
							</svg>
						</div>
					</div>
					<h3 className="text-lg mb-2 text-foreground dark:text-gray-100">User Management</h3>
					<p className="text-muted dark:text-gray-400 text-sm">Manage user accounts, permissions, and access levels for FamilyFoodie.</p>
				</Link>

				{/* Feedback Dashboard Card */}
				<Link
					href="/admin/feedback"
					className="block bg-surface dark:bg-gray-800 border border-custom dark:border-gray-700 rounded-sm shadow-sm hover:shadow-md dark:hover:shadow-lg transition-all p-6 hover:border-accent dark:hover:border-yellow-400"
				>
					<div className="flex items-center mb-4">
						<div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-sm">
							<svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
								/>
							</svg>
						</div>
					</div>
					<h3 className="text-lg mb-2 text-foreground dark:text-gray-100">Feedback Dashboard</h3>
					<p className="text-muted dark:text-gray-400 text-sm">Review and manage user feedback, track satisfaction ratings, and identify improvement areas.</p>
				</Link>

				{/* System Analytics Card */}
				<Link
					href="/admin/analytics"
					className="block bg-surface dark:bg-gray-800 border border-custom dark:border-gray-700 rounded-sm shadow-sm hover:shadow-md dark:hover:shadow-lg transition-all p-6 hover:border-accent dark:hover:border-purple-400"
				>
					<div className="flex items-center mb-4">
						<div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-sm">
							<svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
								/>
							</svg>
						</div>
					</div>
					<h3 className="text-lg mb-2 text-foreground dark:text-gray-100">System Analytics</h3>
					<p className="text-muted dark:text-gray-400 text-sm">Identify orphaned assets and monitor system resource usage.</p>
				</Link>
			</div>
		</main>
	);
}
