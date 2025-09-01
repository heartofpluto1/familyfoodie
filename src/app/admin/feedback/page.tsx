import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import HeaderPage from '@/app/components/HeaderPage';
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
		<main className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<HeaderPage title="Feedback Dashboard" subtitle="Review and manage user feedback to improve the platform" />
			</div>
			<FeedbackDashboard />
		</main>
	);
}
