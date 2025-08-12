import { Recipe } from './menus';

export interface PlanState {
	recipes: Recipe[];
	isEditMode: boolean;
	isLoading: boolean;
	week: number;
	year: number;
}

export interface PlanActions {
	handleEdit: () => void;
	handleCancel: () => void;
	handleSave: () => Promise<void>;
	handleDelete: () => Promise<void>;
	handleAutomate: () => Promise<void>;
}

export interface RecipeManagementActions {
	handleSwapRecipe: (recipeToReplace: Recipe) => Promise<Recipe | null>;
	commitSwapRecipe: (recipeToReplace: Recipe, newRecipe: Recipe) => void;
	handleRemoveRecipe: (recipeToRemove: Recipe) => void;
	handleAddRecipe: (recipe: Recipe) => void;
	handleAddRandomRecipe: () => Promise<void>;
}

export interface ApiResponse<T = unknown> {
	success?: boolean;
	error?: string;
	recipes?: Recipe[];
	data?: T;
}

export interface WeekPlan {
	week: number;
	year: number;
	weekDates: string;
	recipes: Recipe[];
	initialRecipes: Recipe[];
	initialEditMode?: boolean;
}

export interface MultiWeekPlanState {
	weeks: WeekPlan[];
	allRecipes: Recipe[];
}

export interface PlanContextType {
	// State
	state: PlanState;

	// Actions
	planActions: PlanActions;
	recipeActions: RecipeManagementActions;

	// Data
	allRecipes: Recipe[];
	weekDates: string;
	initialRecipes: Recipe[];

	// Animation state for automate
	animatingAutomate?: boolean;
	pendingRecipes?: Recipe[] | null;
}

export interface MultiWeekPlanContextType {
	// State
	multiWeekState: MultiWeekPlanState;

	// Actions
	addNextWeek: () => Promise<void>;
	removeWeek: (weekId: string) => void;

	// Individual week contexts
	getWeekContext: (weekId: string) => PlanContextType;
}

export interface SearchState {
	searchTerm: string;
	showResults: boolean;
}

export interface RecipeFilterOptions {
	searchTerm: string;
	excludeIds: number[];
	maxResults?: number;
}
