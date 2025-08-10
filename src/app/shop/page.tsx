import { Metadata } from 'next';
import { getIngredients, getShoppingList } from '@/lib/queries/shop';
import { ShoppingListData, Ingredient, DateStamp } from '@/types/shop';
import ShoppingListClient from './shop-client';
import withAuth from '@/app/components/withAuth';
import { formatWeekDateRange } from '@/lib/utils/weekDates';

interface PageProps {
	searchParams: Promise<{ week?: string; year?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
	const week = await searchParams;
	return {
		title: `Shopping List - Week ${week || 'Current'}`,
		description: 'Weekly shopping list',
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
		const shoppingData = await getShoppingList(week, year);
		const allIngredients = await getIngredients();
		return { shoppingData, allIngredients };
	} catch {
		return {
			shoppingData: { fresh: [], pantry: [] },
			allIngredients: [],
		};
	}
}

function getWeekNumber(date: Date): number {
	const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
	const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
	return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

async function ShopPage({ searchParams }: PageProps) {
	const { week, year } = await searchParams;

	// Default to current week if no params provided
	const currentDate = new Date();
	const currentWeek = getWeekNumber(currentDate);
	const currentYear = currentDate.getFullYear();

	const actualWeek = week || currentWeek.toString();
	const actualYear = year || currentYear.toString();

	const { shoppingData, allIngredients } = await getShoppingData(actualWeek, actualYear);

	const datestamp: DateStamp = {
		week: parseInt(actualWeek),
		year: parseInt(actualYear),
	};

	const weekDateRange = formatWeekDateRange(parseInt(actualWeek), parseInt(actualYear));

	return (
		<>
			<ShoppingListClient initialData={shoppingData} allIngredients={allIngredients} datestamp={datestamp} weekDateRange={weekDateRange} />
		</>
	);
}

export default withAuth(ShopPage);
