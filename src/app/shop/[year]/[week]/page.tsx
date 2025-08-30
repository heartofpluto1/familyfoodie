import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getIngredients, getShoppingList } from '@/lib/queries/shop';
import { ShoppingListData, Ingredient, DateStamp } from '@/types/shop';
import ShoppingListClient from '../../shop-client';
import { formatWeekDateRange } from '@/lib/utils/weekDates';

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
	year: string,
	household_id: number
): Promise<{
	shoppingData: ShoppingListData;
	allIngredients: Ingredient[];
}> {
	try {
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

export default async function ShopPage({ params }: PageProps) {
	const session = await getServerSession(authOptions);
	if (!session || !session.user?.household_id) {
		redirect('/auth/signin');
	}

	const household_id = session.user.household_id;
	const { week, year } = await params;
	const { shoppingData, allIngredients } = await getShoppingData(week, year, household_id);
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
