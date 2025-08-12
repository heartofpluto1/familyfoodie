export const getSupermarketCategoryColor = (category: string, opacity: boolean): string => {
	const defaultGray = '#6b7280';

	const colorMap: Record<string, string> = {
		meat: '#ef4444',
		'fresh-fruitvege': '#22c55e',
		'fresh-herbs': '#84cc16',
		'nuts-root-vege': '#a3a3a3',
		deli: '#f59e0b',
		bakery: '#d97706',
		'center-aisles': '#6b7280',
		dairy: '#3b82f6',
		other: '#8b5cf6',
	};

	const colorMapOpacity: Record<string, string> = {
		meat: 'rgba(239, 68, 68, 0.75)',
		'fresh-fruitvege': 'rgba(34, 197, 94, 0.75)',
		'fresh-herbs': 'rgba(132, 204, 22, 0.75)',
		'nuts-root-vege': 'rgba(163, 163, 163, 0.75)',
		deli: 'rgba(245, 158, 11, 0.75)',
		bakery: 'rgba(217, 119, 6, 0.75)',
		'center-aisles': 'rgba(107, 114, 128, 0.75)',
		dairy: 'rgba(59, 130, 246, 0.75)',
		other: 'rgba(139, 92, 246, 0.75)',
	};

	const className = category.replace(/ & /g, '').replace(/ /g, '-');
	const color = opacity ? colorMapOpacity[className] : colorMap[className];
	return color || defaultGray; // Default gray for unknown categories
};

export const getPantryCategoryColor = (category: string, opacity: boolean): string => {
	const defaultGray = '#6b7280';

	const colorMap: Record<string, string> = {
		pantry: '#666666',
		'kitchen-cupboard': '#aaaaaa',
		fridge: '#95cddb',
		freezer: '#95cddb',
		'breezeway-cupboard': '#dddddd',
		garden: '#13a40b',
		other: '#ffffff',
	};

	const colorMapOpacity: Record<string, string> = {
		pantry: 'rgba(102, 102, 102, 0.75)',
		'kitchen-cupboard': 'rgba(170, 170, 170, 0.75)',
		fridge: 'rgba(149, 205, 219, 0.75)',
		freezer: 'rgba(149, 205, 219, 0.75)',
		'breezeway-cupboard': 'rgba(221, 221, 221, 0.75)',
		garden: 'rgba(19, 164, 11, 0.75)',
		other: 'rgba(255, 255, 255, 0.75)',
	};

	const className = category.replace(/ /g, '-');
	const color = opacity ? colorMapOpacity[className] : colorMap[className];
	return color || defaultGray; // Default pantry gray for unknown categories
};
