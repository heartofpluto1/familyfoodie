// Common recipe-related type definitions

export interface RecipeFormData {
	name: string;
	description: string;
	prepTime?: number;
	cookTime?: number;
	seasonId?: number;
	primaryTypeId?: number;
	secondaryTypeId?: number;
	collectionId?: number;
}

export interface NewIngredient {
	ingredientName: string;
	quantity: string;
	quantity4: string;
	measureId: string;
	preparationId: string;
}

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

export interface RecipeEditMode {
	isEditing: boolean;
	isLoading: boolean;
}

export interface RecipeUploadHandlers {
	onImageUploadComplete?: () => void;
	onPdfUploadComplete?: () => void;
}
