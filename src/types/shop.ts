// types/shopping.ts
// Place this file in your project root under a 'types' folder

export interface Ingredient {
	id: number;
	ingredient__name: string;
}

export interface ShoppingListItem {
	id: number;
	ingredient: string;
	name: string;
	cost?: number;
	defaultCost?: number;
	stockcode?: number;
	purchased: boolean;
	sort: number;
	quantity?: string;
	quantityMeasure?: string;
	ingredientId?: number;
	supermarketCategory?: string;
	fresh: boolean;
	isPurchasable?: boolean;
	dragover?: boolean;
}

export interface PantryItem {
	id: number;
	ingredient: string;
	name: string;
	sort: number;
	quantity?: string;
	quantityMeasure?: string;
	pantryCategory?: string;
	fresh: boolean;
	dragover?: boolean;
}

export interface ShoppingListData {
	fresh: ShoppingListItem[];
	pantry: PantryItem[];
}

export interface DateStamp {
	week: number;
	year: number;
}

// Additional types for database models
export interface Recipe {
	id: number;
	name: string;
	prepTime?: number;
	cookTime: number;
	filename?: string;
	description?: string;
	duplicate: boolean;
	public: boolean;
}

export interface RecipeIngredient {
	id: number;
	recipe: number;
	ingredient: number;
	quantity: string;
	quantity4: string;
	quantityMeasure?: number;
	preperation?: number;
	primaryIngredient: boolean;
}

export interface SupermarketCategory {
	id: number;
	name: string;
}

export interface PantryCategory {
	id: number;
	name: string;
}

export interface Measure {
	id: number;
	name: string;
}

export interface Preparation {
	id: number;
	name: string;
}

// API Response types
export interface ApiResponse<T> {
	data?: T;
	error?: string;
	message?: string;
}

// Props interfaces for components
export interface ShoppingPageProps {
	initialData: ShoppingListData;
	allIngredients: Ingredient[];
	datestamp: DateStamp;
	firstDay: string;
	lastDay: string;
}

export interface ShoppingListClientProps {
	initialData: ShoppingListData;
	allIngredients: Ingredient[];
	datestamp: DateStamp;
	firstDay: string;
	lastDay: string;
}
