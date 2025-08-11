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

function getOrdinalSuffix(day: number): string {
	if (day > 3 && day < 21) return 'th';
	switch (day % 10) {
		case 1:
			return 'st';
		case 2:
			return 'nd';
		case 3:
			return 'rd';
		default:
			return 'th';
	}
}

function formatDateWithOrdinal(date: Date, includeYear: boolean): string {
	const weekday = date.toLocaleDateString('en-AU', { weekday: 'long' });
	const month = date.toLocaleDateString('en-AU', { month: 'short' });
	const day = date.getDate();
	const year = date.getFullYear();

	const dayWithOrdinal = `${day}${getOrdinalSuffix(day)}`;

	if (includeYear) {
		return `${weekday}, ${dayWithOrdinal} ${month} ${year}`;
	}
	return `${weekday}, ${dayWithOrdinal} ${month}`;
}

export function formatWeekDateRange(week: number, year: number): string {
	const { firstDay, lastDay } = getWeekDates(week, year);
	const currentYear = new Date().getFullYear();
	const includeYear = year < currentYear;

	const firstDayFormatted = formatDateWithOrdinal(firstDay, includeYear);
	const lastDayFormatted = formatDateWithOrdinal(lastDay, includeYear);

	return `${firstDayFormatted} → ${lastDayFormatted}`;
}
