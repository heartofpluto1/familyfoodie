'use client';

import { RecipeDetail } from '@/types/menus';
import HeaderPage from '@/app/components/HeaderPage';
import RecipeEditor from './components/RecipeEditor';

interface RecipeDetailsClientProps {
	recipe: RecipeDetail;
}

const RecipeDetailsClient = ({ recipe }: RecipeDetailsClientProps) => {
	return (
		<>
			<main className="container mx-auto px-4 py-8">
				<div className="mb-8">
					<HeaderPage title={recipe.name} subtitle={recipe.seasonName ? `${recipe.seasonName} Recipe` : ''} />
				</div>

				{/* Recipe Editor handles both view and edit modes internally */}
				<RecipeEditor recipe={recipe} />
			</main>
		</>
	);
};

export default RecipeDetailsClient;
