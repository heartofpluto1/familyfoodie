import { useState, useMemo } from 'react';
import { IngredientData } from '../page';

export type SortColumn = 'name' | 'supermarketCategory' | 'fresh' | 'recipeCount' | 'price' | 'stockcode';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
	column: SortColumn;
	direction: SortDirection;
}

export function useTableSort(ingredients: IngredientData[]) {
	// Default sort by supermarketCategory
	const [sortConfig, setSortConfig] = useState<SortConfig>({
		column: 'supermarketCategory',
		direction: 'asc',
	});

	const handleSort = (column: SortColumn) => {
		setSortConfig(prevConfig => {
			// If clicking the same column, toggle direction
			if (prevConfig.column === column) {
				return {
					column,
					direction: prevConfig.direction === 'asc' ? 'desc' : 'asc',
				};
			}
			// If clicking a different column, default to ascending
			return {
				column,
				direction: 'asc',
			};
		});
	};

	const sortedIngredients = useMemo(() => {
		const sorted = [...ingredients].sort((a, b) => {
			const { column, direction } = sortConfig;

			// Special handling for Location column (supermarketCategory)
			// Sort by supermarketCategory first, then by pantryCategory as secondary
			if (column === 'supermarketCategory') {
				let aSuper = a.supermarketCategory || '';
				let bSuper = b.supermarketCategory || '';
				let aPantry = a.pantryCategory || '';
				let bPantry = b.pantryCategory || '';

				aSuper = aSuper.toLowerCase();
				bSuper = bSuper.toLowerCase();
				aPantry = aPantry.toLowerCase();
				bPantry = bPantry.toLowerCase();

				// First compare supermarket categories
				if (aSuper < bSuper) return direction === 'asc' ? -1 : 1;
				if (aSuper > bSuper) return direction === 'asc' ? 1 : -1;

				// If supermarket categories are equal, compare pantry categories
				if (aPantry < bPantry) return direction === 'asc' ? -1 : 1;
				if (aPantry > bPantry) return direction === 'asc' ? 1 : -1;

				return 0;
			}

			let aValue: string | number | boolean | null = a[column];
			let bValue: string | number | boolean | null = b[column];

			// Handle null/undefined values - put them at the end
			if (aValue === null || aValue === undefined) aValue = '';
			if (bValue === null || bValue === undefined) bValue = '';

			// Special handling for different column types
			if (column === 'fresh') {
				// Convert boolean to number for sorting
				aValue = aValue ? 1 : 0;
				bValue = bValue ? 1 : 0;
			} else if (column === 'price' || column === 'stockcode' || column === 'recipeCount') {
				// Numeric columns - treat null/empty as 0
				aValue = aValue || 0;
				bValue = bValue || 0;
			} else {
				// String columns - case insensitive
				aValue = String(aValue).toLowerCase();
				bValue = String(bValue).toLowerCase();
			}

			// Compare values
			if (aValue < bValue) {
				return direction === 'asc' ? -1 : 1;
			}
			if (aValue > bValue) {
				return direction === 'asc' ? 1 : -1;
			}
			return 0;
		});

		return sorted;
	}, [ingredients, sortConfig]);

	return {
		sortedIngredients,
		sortConfig,
		handleSort,
	};
}
