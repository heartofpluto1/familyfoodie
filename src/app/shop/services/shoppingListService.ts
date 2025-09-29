export class ShoppingListService {
	static async addItem(week: number, year: number, name: string, ingredientId?: number | null) {
		const response = await fetch('/api/shop/add', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				week,
				year,
				name,
				ingredient_id: ingredientId,
			}),
		});

		if (!response.ok) {
			const errorResult = await response.json();
			throw new Error(errorResult.error || `Failed to add item: ${response.statusText}`);
		}

		const result = await response.json();
		// Extract just the data portion to maintain backward compatibility
		return result.data;
	}

	static async removeItem(id: number | number[]) {
		const isArray = Array.isArray(id);
		const response = await fetch('/api/shop/remove', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(isArray ? { ids: id } : { id }),
		});

		if (!response.ok) {
			throw new Error(`Failed to remove item: ${response.statusText}`);
		}

		return response.json();
	}

	static async moveItem(id: number | number[], fresh: boolean, sort: number, week: number, year: number) {
		const isArray = Array.isArray(id);
		const response = await fetch('/api/shop/move', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...(isArray ? { ids: id } : { id }), fresh, sort, week, year }),
		});

		if (!response.ok) {
			throw new Error(`Failed to move item: ${response.statusText}`);
		}

		return response.json();
	}

	static async togglePurchase(id: number | number[], purchased: boolean) {
		const isArray = Array.isArray(id);
		const response = await fetch('/api/shop/purchase', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...(isArray ? { ids: id } : { id }), purchased }),
		});

		if (!response.ok) {
			throw new Error(`Failed to toggle purchase: ${response.statusText}`);
		}

		return response.json();
	}

	static async resetList(week: number, year: number) {
		const response = await fetch('/api/shop/reset', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ week, year }),
		});

		if (!response.ok) {
			throw new Error(`Failed to reset list: ${response.statusText}`);
		}

		return response.json();
	}
}
