import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getRecipeDetails } from '@/lib/queries/menus';
import withAuth from '../../components/withAuth';
import RecipeDetailsClient from './recipe-details-client';

interface PageProps {
	params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { id } = await params;
	const recipe = await getRecipeDetails(id);

	return {
		title: recipe ? `${recipe.name} - Recipe Details` : 'Recipe Not Found',
		description: recipe ? recipe.description : 'Recipe details not available',
	};
}

async function RecipeDetailsPage({ params }: PageProps) {
	const { id } = await params;
	const recipe = await getRecipeDetails(id);

	if (!recipe) {
		notFound();
	}

	return <RecipeDetailsClient recipe={recipe} />;
}

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';
export default withAuth(RecipeDetailsPage);
