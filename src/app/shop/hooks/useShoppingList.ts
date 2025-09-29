import { useState, useEffect } from 'react';
import { ShoppingListData, ShoppingListItem, Ingredient, DateStamp } from '@/types/shop';
import { ShoppingListService } from '@/app/shop/services/shoppingListService';
import { useToast } from '@/app/components/ToastProvider';

export function useShoppingList(initialData: ShoppingListData, datestamp: DateStamp) {
	const [ingredients, setIngredients] = useState<ShoppingListData>(initialData);
	const [cost, setCost] = useState<number>(0);
	const [isResetting, setIsResetting] = useState<boolean>(false);
	const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
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

	const removeItem = async (itemId: number | number[], itemName: string) => {
		try {
			await ShoppingListService.removeItem(itemId);

			// Get all IDs to remove (either single ID or array of IDs)
			const idsToRemove = Array.isArray(itemId) ? itemId : [itemId];

			// Update local state - remove all grouped items from shopping list
			setIngredients(prev => ({
				...prev,
				fresh: prev.fresh.filter(item => !idsToRemove.includes(item.id)),
			}));

			showToast('success', 'Removed', itemName);
		} catch (error) {
			showToast('error', 'Error', error instanceof Error ? error.message : 'Error removing item');
		}
	};

	const togglePurchase = async (itemId: number | number[], currentPurchased: boolean) => {
		const newPurchased = !currentPurchased;

		try {
			await ShoppingListService.togglePurchase(itemId, newPurchased);

			// Get all IDs to update (either single ID or array of IDs)
			const idsToUpdate = Array.isArray(itemId) ? itemId : [itemId];

			// Update local state for all grouped items
			setIngredients(prev => ({
				...prev,
				fresh: prev.fresh.map(item => (idsToUpdate.includes(item.id) ? { ...item, purchased: newPurchased } : item)),
			}));
		} catch (error) {
			showToast('error', 'Error', error instanceof Error ? error.message : 'Failed to update purchase status');
		}
	};

	const resetListClick = () => {
		setShowResetConfirm(true);
	};

	const resetListConfirm = async () => {
		setShowResetConfirm(false);
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

	const resetListCancel = () => {
		setShowResetConfirm(false);
	};

	return {
		ingredients,
		setIngredients,
		cost,
		isResetting,
		addItem,
		removeItem,
		togglePurchase,
		resetListClick,
		resetListConfirm,
		resetListCancel,
		// Confirmation state
		showResetConfirm,
	};
}
