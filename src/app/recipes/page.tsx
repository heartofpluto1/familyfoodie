import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import HeaderPage from '../components/HeaderPage';
import RecipeCard from '../components/RecipeCard';
import { getAllRecipes } from '@/lib/queries/menus';
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

	const recipes = await getAllRecipes();

	return (
		<main className="container mx-auto px-4 py-8">
			<div className="mb-8">
				<HeaderPage title="All Recipes" subtitle={`Discover from ${recipes.length} delicious recipes in our collection`} />
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
				{recipes.map(recipe => (
					<RecipeCard key={recipe.id} recipe={recipe} />
				))}
			</div>

			{recipes.length === 0 && (
				<div className="text-center py-12">
					<p className="text-muted text-lg">No recipes found.</p>
				</div>
			)}
		</main>
	);
}
