export interface UpdateIngredientRequest {
	id: number;
	name: string;
	fresh: boolean;
	price: number | null;
	stockcode: number | null;
	supermarketCategoryId: number | null;
	pantryCategoryId: number | null;
}

export interface AddIngredientRequest {
	name: string;
	fresh: boolean;
	price: number | null;
	stockcode: number | null;
	supermarketCategoryId: number | null;
	pantryCategoryId: number | null;
}

export const ingredientService = {
	async updateIngredient(data: UpdateIngredientRequest): Promise<{ success: boolean; message?: string; error?: string }> {
		const response = await fetch('/api/ingredients/update', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(data),
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.error || 'Failed to update ingredient');
		}

		return result;
	},

	async addIngredient(data: AddIngredientRequest): Promise<{ success: boolean; message?: string; error?: string; id?: number }> {
		const response = await fetch('/api/ingredients/add', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(data),
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.error || 'Failed to add ingredient');
		}

		return result;
	},

	async deleteIngredient(id: number): Promise<{ success: boolean; message?: string; error?: string }> {
		const response = await fetch('/api/ingredients/delete', {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ id }),
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.message || result.error || 'Failed to delete ingredient');
		}

		return result;
	},
};
