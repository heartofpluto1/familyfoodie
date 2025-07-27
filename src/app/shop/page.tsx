// app/shop/page.tsx (App Router version)
import { Metadata } from 'next';
import ShoppingListClient from './shop-client';
import { ShoppingListData, Ingredient, DateStamp } from '../../types/shop';
import { getEncryptedSession } from '@/lib/session';
import { redirect } from 'next/navigation';

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

function getBaseUrl() {
	if (process.env.GOOGLE_CLOUD_PROJECT || process.env.K_SERVICE) {
		// Running on Cloud Run - use internal port
		const port = process.env.PORT || 8080;
		return `http://localhost:${port}`;
	}

	// Development
	return 'http://localhost:3000';
}

async function getShoppingData(
	week: string,
	year: string,
	session: string
): Promise<{
	shoppingData: ShoppingListData;
	allIngredients: Ingredient[];
}> {
	try {
		// Build the correct URL for server-side requests
		const baseUrl = getBaseUrl();

		const [shoppingResponse, ingredientsResponse] = await Promise.all([
			await fetch(`${baseUrl}/api/shop?week=${week}&year=${year}&endpoint=week`, {
				cache: 'no-store',
				headers: { 'Content-Type': 'application/json', Cookie: `session=${session}` },
			}),
			await fetch(`${baseUrl}/api/shop?week=${week}&year=${year}&endpoint=ingredients`, {
				headers: { 'Content-Type': 'application/json', Cookie: `session=${session}` },
			}),
		]);

		const shoppingRes = await shoppingResponse.json();
		const allIngRes = await ingredientsResponse.json();

		if (!shoppingRes.success) {
			throw new Error(`Database error! status: ${shoppingRes.error}`);
		}
		if (!allIngRes.success) {
			throw new Error(`Database error! status: ${allIngRes.error}`);
		}

		const shoppingData = shoppingRes.data;
		const allIngredients = allIngRes.data;

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
	const session = await getEncryptedSession();
	if (!session) {
		redirect('login');
	}

	const { week, year } = await searchParams;

	// Default to current week if no params provided
	const currentDate = new Date();
	const currentWeek = getWeekNumber(currentDate);
	const currentYear = currentDate.getFullYear();

	const actualWeek = week || currentWeek.toString();
	const actualYear = year || currentYear.toString();

	const { shoppingData, allIngredients } = await getShoppingData(actualWeek, actualYear, session);

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

	return (
		<>
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
