//import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import RecipesPageClient from './recipes-client';
import { getAllRecipesWithDetails } from '@/lib/queries/menus';
import { getEncryptedSession } from '@/lib/session';
import { addToast, getPendingToasts } from '@/lib/toast';
import ToastServer from '../components/ToastServer';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: `List all recipes`,
		description: 'List of all recipes available in the system',
	};
}

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default async function RecipesPage() {
	// Add debug toast messages
	addToast('info', 'Environment Check', `NODE_ENV: ${process.env.NODE_ENV}, Has Session Key: ${!!process.env.SESSION_SECRET_KEY}`);

	const session = await getEncryptedSession();
	addToast(session ? 'success' : 'error', 'Session Status', session ? 'Session found' : 'No session found');

	if (!session) {
		addToast('error', 'Authentication Failed', 'Redirecting to login');
		//redirect('login');
		const pendingToasts = getPendingToasts();
		return <ToastServer toasts={pendingToasts} />;
	}

	const recipes = await getAllRecipesWithDetails();
	addToast('success', 'Recipes Loaded', `Found ${recipes.length} recipes`);

	const pendingToasts = getPendingToasts();

	return (
		<main className="container mx-auto px-4 py-8">
			<ToastServer toasts={pendingToasts} />
			<RecipesPageClient recipes={recipes} />
		</main>
	);
}
