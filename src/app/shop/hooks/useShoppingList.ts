import { useState, useEffect } from 'react';
import { ShoppingListData, ShoppingListItem, Ingredient, DateStamp } from '@/types/shop';
import { ShoppingListService } from '../services/shoppingListService';
import { useToast } from '../../components/ToastProvider';

export function useShoppingList(initialData: ShoppingListData, datestamp: DateStamp) {
	const [ingredients, setIngredients] = useState<ShoppingListData>(initialData);
	const [cost, setCost] = useState<number>(0);
	const [isResetting, setIsResetting] = useState<boolean>(false);
	const { showToast } = useToast();

	// Calculate total cost
	useEffect(() => {
		const totalCost = ingredients.fresh.reduce((sum, item) => {
			return sum + (item.cost || 0);
		}, 0);
		setCost(totalCost);
	}, [ingredients]);

	const addItem = async (itemName: string, selectedIngredientId: number | null, allIngredients: Ingredient[]) => {
		if (!itemName.trim()) return;

		try {
			const data = await ShoppingListService.addItem(datestamp.week, datestamp.year, itemName, selectedIngredientId);

			// Get the matching ingredient data for local state if one was selected
			const matchingIngredient = selectedIngredientId ? allIngredients.find(ing => ing.ingredientId === selectedIngredientId) : null;

			// Create new item for local state using the returned ID and proper values
			const newItem: ShoppingListItem = {
				id: data.id,
				ingredient: itemName,
				name: itemName,
				purchased: false,
				sort: ingredients.fresh.length,
				fresh: true,
				// Use actual values from the selected ingredient if available
				cost: matchingIngredient?.cost,
				stockcode: matchingIngredient?.stockcode ? Number(matchingIngredient.stockcode) : undefined,
				supermarketCategory: matchingIngredient?.supermarketCategory || '',
				pantryCategory: matchingIngredient?.pantryCategory || '',
				quantity: undefined, // Manually added items have null quantity to show remove button
				quantityMeasure: undefined,
				ingredientId: undefined, // No ingredient ID for manually added items
			};

			// Update local state - add to bottom of shopping list
			setIngredients(prev => ({
				...prev,
				fresh: [...prev.fresh, newItem],
			}));

			showToast('success', 'Added', itemName);
		} catch (error) {
			showToast('error', 'Error', error instanceof Error ? error.message : 'Error adding item');
		}
	};

	const removeItem = async (itemId: number, itemName: string) => {
		try {
			await ShoppingListService.removeItem(itemId);

			// Update local state - remove item from shopping list
			setIngredients(prev => ({
				...prev,
				fresh: prev.fresh.filter(item => item.id !== itemId),
			}));

			showToast('success', 'Removed', itemName);
		} catch (error) {
			showToast('error', 'Error', error instanceof Error ? error.message : 'Error removing item');
		}
	};

	const togglePurchase = async (itemId: number, currentPurchased: boolean) => {
		const newPurchased = !currentPurchased;

		try {
			await ShoppingListService.togglePurchase(itemId, newPurchased);

			// Update local state
			setIngredients(prev => ({
				...prev,
				fresh: prev.fresh.map(item => (item.id === itemId ? { ...item, purchased: newPurchased } : item)),
			}));
		} catch (error) {
			showToast('error', 'Error', error instanceof Error ? error.message : 'Failed to update purchase status');
		}
	};

	const resetList = async () => {
		if (!confirm('Are you sure you want to reset the shopping list? This will rebuild it from your planned recipes for this week.')) {
			return;
		}

		setIsResetting(true);
		try {
			await ShoppingListService.resetList(datestamp.week, datestamp.year);
			// Refresh the page to get the updated shopping list
			window.location.reload();
		} catch (error) {
			showToast('error', 'Error', error instanceof Error ? error.message : 'Error resetting shopping list');
		} finally {
			setIsResetting(false);
		}
	};

	return {
		ingredients,
		setIngredients,
		cost,
		isResetting,
		addItem,
		removeItem,
		togglePurchase,
		resetList,
	};
}
