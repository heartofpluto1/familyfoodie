'use client';

import Link from 'next/link';
import { RecipeDetail } from '@/types/menus';
import { Collection } from '@/lib/queries/collections';
import HeaderPage from '@/app/components/HeaderPage';
import RecipeEditor from './components/RecipeEditor';

interface RecipeDetailsClientProps {
	recipe: RecipeDetail;
	collections: Collection[];
}

const RecipeDetailsClient = ({ recipe, collections }: RecipeDetailsClientProps) => {
	// Generate a descriptive subtitle based on prep and cook times
	const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
	let subtitle = '';
	if (totalTime > 0) {
		const hours = Math.floor(totalTime / 60);
		const minutes = totalTime % 60;
		if (hours > 0 && minutes > 0) {
			subtitle = `${hours}h ${minutes}min`;
		} else if (hours > 0) {
			subtitle = `${hours} hour${hours > 1 ? 's' : ''}`;
		} else {
			subtitle = `${minutes} minutes`;
		}
		subtitle = `Ready in ${subtitle}`;
	}

	return (
		<>
			<main className="container mx-auto px-4 py-8">
				{/* Collection breadcrumb link */}
				<div className="mb-4">
					<Link href={`/recipes/${recipe.collection_url_slug || ''}`} className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
						← Back to {recipe.collection_title || 'Collection'}
					</Link>
				</div>

				<div className="mb-8">
					<HeaderPage title={recipe.name} subtitle={subtitle} />
				</div>

				{/* Recipe Editor handles both view and edit modes internally */}
				<RecipeEditor recipe={recipe} collections={collections} />
			</main>
		</>
	);
};

export default RecipeDetailsClient;
