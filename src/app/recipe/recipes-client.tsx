'use client';

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

			<RecipeList recipes={recipes} />
		</>
	);
};

export default RecipesPageClient;
