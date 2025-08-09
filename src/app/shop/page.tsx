//import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { getIngredients, getShoppingList } from '@/lib/queries/shop';
import { ShoppingListData, Ingredient, DateStamp } from '@/types/shop';
import { getEncryptedSession } from '@/lib/session';
import ShoppingListClient from './shop-client';
import { addToast, getPendingToasts } from '@/lib/toast';
import ToastServer from '../components/ToastServer';

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
	} catch (error) {
		console.error('Error fetching data:', error);
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

function getWeekDates(week: number, year: number) {
	const firstDayOfYear = new Date(year, 0, 1);
	const daysToAdd = (week - 1) * 7;
	const firstDay = new Date(firstDayOfYear.getTime() + daysToAdd * 86400000);

	// Adjust to start on Monday
	const dayOfWeek = firstDay.getDay();
	const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
	const monday = new Date(firstDay.getTime() + mondayOffset * 86400000);

	const sunday = new Date(monday.getTime() + 6 * 86400000);

	return {
		firstDay: monday,
		lastDay: sunday,
	};
}

export default async function ShopPage({ searchParams }: PageProps) {
	// Add debug toast messages
	addToast('info', 'Environment Check', `NODE_ENV: ${process.env.NODE_ENV}, Has Session Key: ${!!process.env.SESSION_SECRET_KEY}`);

	const session = await getEncryptedSession();
	addToast(session ? 'success' : 'error', 'Session Status', session ? 'Session found' : 'No session found');

	if (!session) {
		addToast('error', 'Authentication Failed', 'Redirecting to login');
		//redirect('login');
		return <p>error</p>;
	}

	const { week, year } = await searchParams;

	// Default to current week if no params provided
	const currentDate = new Date();
	const currentWeek = getWeekNumber(currentDate);
	const currentYear = currentDate.getFullYear();

	const actualWeek = week || currentWeek.toString();
	const actualYear = year || currentYear.toString();

	const { shoppingData, allIngredients } = await getShoppingData(actualWeek, actualYear);

	// Calculate week dates
	const { firstDay, lastDay } = getWeekDates(parseInt(actualWeek), parseInt(actualYear));

	const datestamp: DateStamp = {
		week: parseInt(actualWeek),
		year: parseInt(actualYear),
	};

	const firstDayFormatted = firstDay.toLocaleDateString('en-AU', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});

	const lastDayFormatted = lastDay.toLocaleDateString('en-AU', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});

	const pendingToasts = getPendingToasts();

	return (
		<>
			<ToastServer toasts={pendingToasts} />
			<ShoppingListClient
				initialData={shoppingData}
				allIngredients={allIngredients}
				datestamp={datestamp}
				firstDay={firstDayFormatted}
				lastDay={lastDayFormatted}
			/>
		</>
	);
}
