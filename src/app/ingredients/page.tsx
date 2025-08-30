import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getSupermarketCategories, getPantryCategories } from '@/lib/queries/shop';
import { getMyIngredients } from '@/lib/queries/menus';
import HeaderPage from '@/app/components/HeaderPage';
import { IngredientsTable } from './components/IngredientsTable';

export const dynamic = 'force-dynamic'; // Important for authenticated pages

export interface IngredientData {
	id: number;
	name: string;
	fresh: boolean;
	price: number | null;
	stockcode: number | null;
	supermarketCategory: string | null;
	pantryCategory: string | null;
	recipeCount: number;
}

export interface CategoryData {
	id: number;
	name: string;
}

export default async function IngredientsPage() {
	const session = await getServerSession(authOptions);
	if (!session || !session.user?.household_id) {
		redirect('/auth/signin');
	}
	const household_id = session.user.household_id;

	const [ingredients, supermarketCategories, pantryCategories] = await Promise.all([
		getMyIngredients(household_id),
		getSupermarketCategories(),
		getPantryCategories(),
	]);

	return (
		<div className="min-h-screen bg-background">
			<div className="container mx-auto px-4 py-8">
				<HeaderPage
					title="All Ingredients"
					subtitle="Variety is the spice of life, but if you're chasing 3 different kinds of Ciabatta things get confusing. This is your chance to refine and consolidate what you buy."
				/>
				<main className="container mx-auto py-4">
					<div className="bg-white border border-custom rounded-sm shadow-md overflow-visible">
						<IngredientsTable ingredients={ingredients} supermarketCategories={supermarketCategories} pantryCategories={pantryCategories} />
					</div>
				</main>
			</div>
		</div>
	);
}
