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
	image_filename: string;
	pdf_filename: string;
	collection_id: number;
	collection_title: string;
	url_slug?: string;
	collection_url_slug?: string;
}

export interface Meal {
	id: number;
	name: string;
	image_filename: string;
	pdf_filename: string;
	collection_id: number;
	collection_title: string;
	url_slug?: string;
	collection_url_slug?: string;
}

export interface Recipe {
	id: number;
	name: string;
	image_filename: string;
	pdf_filename: string;
	prepTime?: number;
	cookTime?: number;
	cost?: number;
	description?: string;
	seasonName?: string;
	ingredients?: string[];
	collection_id: number;
	collection_title: string;
	url_slug?: string;
	collection_url_slug?: string;
}

export interface RecipeDetail {
	id: number;
	name: string;
	image_filename: string;
	pdf_filename: string;
	description: string;
	prepTime?: number;
	cookTime?: number;
	seasonName?: string;
	primaryTypeName?: string;
	secondaryTypeName?: string;
	collection_id: number;
	collection_title: string;
	url_slug?: string;
	collection_url_slug?: string;
	ingredients: RecipeIngredient[];
}

export interface RecipeIngredient {
	id: number;
	quantity: string;
	quantity4: string;
	ingredient: {
		id: number;
		name: string;
		pantryCategory: {
			id: number;
			name: string;
		};
	};
	preperation?: {
		name: string;
	};
	measure?: {
		id: number;
		name: string;
	};
}
