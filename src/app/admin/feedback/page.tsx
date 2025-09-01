import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import FeedbackDashboard from './feedback-dashboard';

export const metadata: Metadata = {
	title: 'Feedback Dashboard - Admin',
	description: 'Manage and review user feedback',
};

export default async function AdminFeedbackPage() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.is_admin) {
		redirect('/');
	}

	return (
		<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<div className="mb-8">
				<h1 className="text-3xl text-foreground dark:text-gray-100">Feedback Dashboard</h1>
				<p className="mt-2 text-muted dark:text-gray-400">Review and manage user feedback to improve the platform</p>
			</div>
			<FeedbackDashboard />
		</div>
	);
}
