import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import RecipesPageClient from './recipes-client';
import { getAllRecipesWithDetails } from '@/lib/queries/menus';
import { getEncryptedSession } from '@/lib/session';

export async function generateMetadata(): Promise<Metadata> {
	return {
		title: `List all recipes`,
		description: 'List of all recipes available in the system',
	};
}

export default async function RecipesPage() {
	const session = await getEncryptedSession();
	if (!session) {
		redirect('login');
	}

	const recipes = await getAllRecipesWithDetails();

	return (
		<main className="container mx-auto px-4 py-8">
			<RecipesPageClient recipes={recipes} />
		</main>
	);
}
