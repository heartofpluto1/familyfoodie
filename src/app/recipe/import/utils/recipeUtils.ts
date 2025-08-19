export interface RecipeOptions {
	seasons: { id: number; name: string }[];
	primaryTypes: { id: number; name: string }[];
	secondaryTypes: { id: number; name: string }[];
	ingredients: {
		id: number;
		name: string;
		pantryCategory_id: number;
		pantryCategory_name: string;
	}[];
	measures: { id: number; name: string }[];
	preparations: { id: number; name: string }[];
}

// Function to calculate quantity and quantity4 based on serving size
export const calculateQuantities = (quantity: string, servings: number = 4, unit: string = '') => {
	const numQuantity = parseFloat(quantity);
	if (isNaN(numQuantity)) {
		return { quantity: '1', quantity4: '1' };
	}

	// For whole items (no unit or "item"), we need to be careful with scaling
	const isWholeItem = !unit || unit === 'item' || unit === '';

	if (servings === 4) {
		// Recipe serves 4, so quantity4 is correct as-is
		if (isWholeItem && numQuantity < 4) {
			// For whole items less than 4, keep the same for both
			return {
				quantity: quantity,
				quantity4: quantity,
			};
		} else {
			return {
				quantity: (numQuantity / 2).toString(),
				quantity4: quantity,
			};
		}
	} else if (servings === 2) {
		// Recipe serves 2, so quantity is correct
		return {
			quantity: quantity,
			quantity4: (numQuantity * 2).toString(),
		};
	} else {
		// For other serving sizes, scale to get quantity4 (for 4 servings)
		const scalingFactor = 4 / servings;
		return {
			quantity: (numQuantity / 2).toString(),
			quantity4: (numQuantity * scalingFactor).toString(),
		};
	}
};

// Function to find measure by unit name
export const findMeasureByUnit = (unit: string, options: RecipeOptions | null) => {
	if (!options?.measures || !unit) return undefined;

	// Try exact match first
	let measure = options.measures.find(m => m.name.toLowerCase() === unit.toLowerCase());

	// Try common variations
	if (!measure) {
		const unitVariations: { [key: string]: string[] } = {
			cup: ['cups', 'c'],
			tsp: ['teaspoon', 'teaspoons', 't'],
			tbsp: ['tablespoon', 'tablespoons', 'T'],
			oz: ['ounce', 'ounces'],
			lb: ['pound', 'pounds', 'lbs'],
			g: ['gram', 'grams'],
			kg: ['kilogram', 'kilograms'],
			ml: ['milliliter', 'milliliters'],
			l: ['liter', 'liters'],
			item: ['', 'each', 'piece', 'pieces', 'whole'],
			clove: ['cloves'],
			slice: ['slices'],
		};

		for (const [standardUnit, variations] of Object.entries(unitVariations)) {
			if (variations.includes(unit.toLowerCase())) {
				measure = options.measures.find(m => m.name.toLowerCase() === standardUnit);
				break;
			}
		}
	}

	return measure;
};
