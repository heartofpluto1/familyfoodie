import { formatWeekDateRange } from '@/lib/utils/weekDates';

export interface WeekInfo {
	week: number;
	year: number;
	weekDates: string;
}

export function getNextWeek(currentWeek: number, currentYear: number): WeekInfo {
	let nextWeek = currentWeek + 1;
	let nextYear = currentYear;

	// Handle year rollover (assuming 52 weeks per year)
	if (nextWeek > 52) {
		nextWeek = 1;
		nextYear = currentYear + 1;
	}

	const weekDates = formatWeekDateRange(nextWeek, nextYear);

	return {
		week: nextWeek,
		year: nextYear,
		weekDates,
	};
}

export function createWeekId(week: number, year: number): string {
	return `${year}-W${week.toString().padStart(2, '0')}`;
}
