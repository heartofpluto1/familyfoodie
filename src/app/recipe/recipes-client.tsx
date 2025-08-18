'use client';

import { Suspense } from 'react';
import { Recipe } from '@/types/menus';
import HeaderPage from '@/app/components/HeaderPage';
import RecipeList from '@/app/components/RecipeList';

interface RecipesPageClientProps {
	recipes: Recipe[];
}

const RecipesPageClient = ({ recipes }: RecipesPageClientProps) => {
	return (
		<>
			<div className="mb-8">
				<HeaderPage title="All Recipes" subtitle={`Discover from ${recipes.length} delicious recipes in our collection`} />
			</div>

			<Suspense fallback={<div>Loading recipes...</div>}>
				<RecipeList recipes={recipes} />
			</Suspense>
		</>
	);
};

export default RecipesPageClient;
