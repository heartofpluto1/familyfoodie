export interface StructuredIngredient {
	name: string;
	quantity: string;
	unit?: string;
}

export interface AIIngredient {
	name: string;
	quantity_2_servings: string;
	quantity_4_servings: string;
	unit: string;
	existing_ingredient_id?: number; // If ingredient exists in database
	fresh?: boolean; // For new ingredients
	pantryCategory_id?: number; // For new ingredients
	supermarketCategory_id?: number; // For new ingredients
}

export interface ImportedRecipe {
	title: string;
	description: string;
	prepTime?: number;
	cookTime?: number;
	serves?: number;
	season?: string;
	seasonReason?: string;
	primaryType?: string;
	secondaryType?: string;
	hasHeroImage?: boolean;
	imageLocation?: {
		pageIndex: number;
		x: number;
		y: number;
		width: number;
		height: number;
	};
	selectedCollection?: {
		id: number;
		title: string;
	};
	ingredients: AIIngredient[];
	instructions?: string[];
	cuisine?: string;
	difficulty?: string;
}

export interface Category {
	id: number;
	name: string;
}

export interface PreviewResponse {
	success: boolean;
	recipe: ImportedRecipe;
	categories: {
		pantryCategories: Category[];
		supermarketCategories: Category[];
	};
}
