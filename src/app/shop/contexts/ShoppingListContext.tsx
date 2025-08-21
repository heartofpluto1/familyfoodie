'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { ShoppingListData, Ingredient, DateStamp } from '@/types/shop';
import { useShoppingList } from '@/app/shop/hooks/useShoppingList';
import { useDndKit } from '@/app/shop/hooks/useDndKit';
import { useAddItem } from '@/app/shop/hooks/useAddItem';
import { UniqueIdentifier, DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core';
import { SensorDescriptor, SensorOptions } from '@dnd-kit/core';

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
	resetListClick: () => void;
	resetListConfirm: () => Promise<void>;
	resetListCancel: () => void;
	showResetConfirm: boolean;

	// Drag and drop state and actions (dnd-kit)
	dndKitHandlers: {
		sensors: SensorDescriptor<SensorOptions>[];
		activeId: UniqueIdentifier | null;
		overId: UniqueIdentifier | null;
		handleDragStart: (event: DragStartEvent) => void;
		handleDragOver: (event: DragOverEvent) => void;
		handleDragEnd: (event: DragEndEvent) => void;
	};

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
	const dndKit = useDndKit(shoppingList.ingredients, shoppingList.setIngredients, datestamp);
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
		resetListClick: shoppingList.resetListClick,
		resetListConfirm: shoppingList.resetListConfirm,
		resetListCancel: shoppingList.resetListCancel,
		showResetConfirm: shoppingList.showResetConfirm,

		// Drag and drop (dnd-kit)
		dndKitHandlers: {
			sensors: dndKit.sensors,
			activeId: dndKit.activeId,
			overId: dndKit.overId,
			handleDragStart: dndKit.handleDragStart,
			handleDragOver: dndKit.handleDragOver,
			handleDragEnd: dndKit.handleDragEnd,
		},

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
