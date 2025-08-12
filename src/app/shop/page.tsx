import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

function getWeekNumber(date: Date): number {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default async function ShopPage() {
	// Check authentication
	const session = await getSession();
	if (!session) {
		redirect('/login');
	}

	// Redirect to current week
	const currentDate = new Date();
	const currentWeek = getWeekNumber(currentDate);
	const currentYear = currentDate.getFullYear();

	redirect(`/shop/${currentYear}/${currentWeek}`);
}
