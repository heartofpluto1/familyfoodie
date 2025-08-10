'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { ShoppingListData, ShoppingListItem, PantryItem, Ingredient, DateStamp } from '@/types/shop';
import { useShoppingList } from '../hooks/useShoppingList';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useAddItem } from '../hooks/useAddItem';

interface ShoppingListContextType {
	// Shopping list state
	ingredients: ShoppingListData;
	cost: number;
	isResetting: boolean;
	datestamp: DateStamp;
	allIngredients: Ingredient[];

	// Shopping list actions
	addItem: () => Promise<void>;
	removeItem: (itemId: number, itemName: string) => Promise<void>;
	togglePurchase: (itemId: number, currentPurchased: boolean) => Promise<void>;
	resetList: () => Promise<void>;

	// Drag and drop state
	isDragging: boolean;
	dragOverIndex: { list: 'fresh' | 'pantry'; index: number } | null;

	// Drag and drop actions
	handleDragStart: (e: React.DragEvent, item: ShoppingListItem | PantryItem, listType: 'fresh' | 'pantry') => void;
	handleDragOver: (e: React.DragEvent, targetList?: 'fresh' | 'pantry', targetIndex?: number) => void;
	handleDragLeave: (e: React.DragEvent) => void;
	handleDrop: (e: React.DragEvent, targetList: 'fresh' | 'pantry', targetIndex?: number) => void;

	// Add item state
	addItemValue: string;
	selectedIngredientId: number | null;

	// Add item actions
	handleInputChange: (value: string) => void;
	clearInput: () => void;
}

const ShoppingListContext = createContext<ShoppingListContextType | null>(null);

interface ShoppingListProviderProps {
	children: ReactNode;
	initialData: ShoppingListData;
	datestamp: DateStamp;
	allIngredients: Ingredient[];
}

export function ShoppingListProvider({ children, initialData, datestamp, allIngredients }: ShoppingListProviderProps) {
	const shoppingList = useShoppingList(initialData, datestamp);
	const dragAndDrop = useDragAndDrop(shoppingList.ingredients, shoppingList.setIngredients, datestamp);
	const addItemHook = useAddItem(allIngredients);

	const handleAddItem = async () => {
		if (!addItemHook.addItemValue.trim()) return;

		await shoppingList.addItem(addItemHook.addItemValue.trim(), addItemHook.selectedIngredientId, allIngredients);

		addItemHook.clearInput();
	};

	const contextValue: ShoppingListContextType = {
		// Shopping list
		ingredients: shoppingList.ingredients,
		cost: shoppingList.cost,
		isResetting: shoppingList.isResetting,
		datestamp,
		allIngredients,
		addItem: handleAddItem,
		removeItem: shoppingList.removeItem,
		togglePurchase: shoppingList.togglePurchase,
		resetList: shoppingList.resetList,

		// Drag and drop
		isDragging: dragAndDrop.isDragging,
		dragOverIndex: dragAndDrop.dragOverIndex,
		handleDragStart: dragAndDrop.handleDragStart,
		handleDragOver: dragAndDrop.handleDragOver,
		handleDragLeave: dragAndDrop.handleDragLeave,
		handleDrop: dragAndDrop.handleDrop,

		// Add item
		addItemValue: addItemHook.addItemValue,
		selectedIngredientId: addItemHook.selectedIngredientId,
		handleInputChange: addItemHook.handleInputChange,
		clearInput: addItemHook.clearInput,
	};

	return <ShoppingListContext.Provider value={contextValue}>{children}</ShoppingListContext.Provider>;
}

export const useShoppingListContext = () => {
	const context = useContext(ShoppingListContext);
	if (!context) {
		throw new Error('useShoppingListContext must be used within ShoppingListProvider');
	}
	return context;
};
