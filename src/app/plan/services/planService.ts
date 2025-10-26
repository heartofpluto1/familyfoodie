import { ApiResponse } from '@/types/plan';

class PlanService {
	private async makeRequest<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
		const response = await fetch(url, {
			headers: {
				'Content-Type': 'application/json',
				...options.headers,
			},
			...options,
		});

		const data = await response.json();
		return { success: response.ok, ...data };
	}

	async saveWeekPlan(week: number, year: number, recipes: Array<{ id: number; shop_qty?: 2 | 4 }>): Promise<ApiResponse> {
		return this.makeRequest('/api/plan/save', {
			method: 'POST',
			body: JSON.stringify({ week, year, recipes }),
		});
	}

	async deleteWeekPlan(week: number, year: number): Promise<ApiResponse> {
		return this.makeRequest('/api/plan/delete', {
			method: 'POST',
			body: JSON.stringify({ week, year }),
		});
	}

	async resetShoppingList(week: number, year: number): Promise<ApiResponse> {
		return this.makeRequest('/api/shop/reset', {
			method: 'POST',
			body: JSON.stringify({ week, year }),
		});
	}
}

export const planService = new PlanService();
