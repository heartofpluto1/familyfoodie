export type QueryResult = {
	data?: Menu[];
	stats?: Stats;
	error?: string;
};

export interface Menu {
	year: number;
	week: number;
	meals: Meal[];
}

export interface Stats {
	totalWeeks: number;
	totalRecipes: number;
	avgRecipesPerWeek: number;
}

export interface PlannedMeal {
	id: number;
	week: number;
	year: number;
	recipe_id: number;
	recipe_name: string;
	filename: string;
}

export interface Meal {
	id: number;
	name: string;
	filename: string;
}

export interface Recipe {
	id: number;
	name: string;
	filename: string;
	prepTime?: number;
	cookTime?: number;
	cost?: number;
}
