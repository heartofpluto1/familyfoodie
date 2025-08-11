import { planService } from '../services/planService';

export function useShoppingListSync() {
	const resetShoppingList = async (week: number, year: number): Promise<boolean> => {
		try {
			const result = await planService.resetShoppingList(week, year);
			return result.success || false;
		} catch (error) {
			console.error('Error resetting shopping list:', error);
			return false;
		}
	};

	return {
		resetShoppingList,
	};
}
