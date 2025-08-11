import { redirect } from 'next/navigation';

function getWeekNumber(date: Date): number {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default function ShopPage() {
	// Redirect to current week
	const currentDate = new Date();
	const currentWeek = getWeekNumber(currentDate);
	const currentYear = currentDate.getFullYear();

	redirect(`/shop/${currentYear}/${currentWeek}`);
}
