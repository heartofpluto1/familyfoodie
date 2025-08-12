import React from 'react';
import HeaderPage from '@/app/components/HeaderPage';

interface PlanHeaderProps {
	week: number;
	weekDates: string;
}

export function PlanHeader({ week, weekDates }: PlanHeaderProps) {
	return (
		<div className="mb-6">
			<HeaderPage title={`Week ${week} Meal Plan`} subtitle={weekDates} />
		</div>
	);
}
