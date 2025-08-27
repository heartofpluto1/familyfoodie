import { Metadata } from 'next';
import { getIngredients, getShoppingList } from '@/lib/queries/shop';
import { ShoppingListData, Ingredient, DateStamp } from '@/types/shop';
import ShoppingListClient from '../../shop-client';
import withAuth from '@/app/components/withAuth';
import { formatWeekDateRange } from '@/lib/utils/weekDates';
import { getSession } from '@/lib/session';

interface PageProps {
	params: Promise<{ year: string; week: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
	const { week, year } = await params;
	return {
		title: `Shopping List - Week ${week}, ${year}`,
		description: `Weekly shopping list for Week ${week}, ${year}`,
	};
}

async function getShoppingData(
	week: string,
	year: string
): Promise<{
	shoppingData: ShoppingListData;
	allIngredients: Ingredient[];
}> {
	try {
		const session = await getSession();
		const household_id = session?.household_id;

		if (!household_id) {
			throw new Error('No household_id found in session');
		}

		const shoppingData = await getShoppingList(week, year, household_id);
		const allIngredients = await getIngredients(household_id);
		return { shoppingData, allIngredients };
	} catch {
		return {
			shoppingData: { fresh: [], pantry: [] },
			allIngredients: [],
		};
	}
}

async function ShopPage({ params }: PageProps) {
	const { week, year } = await params;

	const { shoppingData, allIngredients } = await getShoppingData(week, year);

	const datestamp: DateStamp = {
		week: parseInt(week),
		year: parseInt(year),
	};

	const weekDateRange = formatWeekDateRange(parseInt(week), parseInt(year));

	return (
		<>
			<ShoppingListClient initialData={shoppingData} allIngredients={allIngredients} datestamp={datestamp} weekDateRange={weekDateRange} />
		</>
	);
}

export default withAuth(ShopPage);
