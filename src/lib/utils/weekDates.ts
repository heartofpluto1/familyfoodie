export function getWeekDates(week: number, year: number) {
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

export function formatWeekDateRange(week: number, year: number): string {
	const { firstDay, lastDay } = getWeekDates(week, year);

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

	return `${firstDayFormatted} → ${lastDayFormatted}`;
}
