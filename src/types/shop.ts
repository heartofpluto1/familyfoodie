// types/shopping.ts
// Place this file in your project root under a 'types' folder

export interface Ingredient {
	ingredientId: number;
	name: string;
	cost?: number;
	stockcode?: string;
	supermarketCategory?: string;
	pantryCategory?: string;
}

export interface ListItem {
	id: number;
	ingredient: string;
	name: string;
	cost?: number;
	stockcode?: number;
	purchased?: boolean;
	sort: number;
	quantity?: string;
	quantityMeasure?: string;
	ingredientId?: number;
	supermarketCategory?: string;
	pantryCategory?: string;
	fresh: boolean;
	isPurchasable?: boolean;
	dragover?: boolean;
}

// Type aliases for backward compatibility
export type ShoppingListItem = ListItem;
export type PantryItem = ListItem;

export interface ShoppingListData {
	fresh: ListItem[];
	pantry: ListItem[];
}

export interface DateStamp {
	week: number;
	year: number;
}

// Additional types for database models

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
