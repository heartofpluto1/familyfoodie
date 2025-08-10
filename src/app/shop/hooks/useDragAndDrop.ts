import React, { useState } from 'react';
import { ShoppingListData, ShoppingListItem, PantryItem, DateStamp } from '@/types/shop';
import { ShoppingListService } from '@/app/shop/services/shoppingListService';
import { useToast } from '@/app/components/ToastProvider';

export function useDragAndDrop(ingredients: ShoppingListData, setIngredients: (value: React.SetStateAction<ShoppingListData>) => void, datestamp: DateStamp) {
	const [isDragging, setIsDragging] = useState<boolean>(false);
	const [dragOverIndex, setDragOverIndex] = useState<{ list: 'fresh' | 'pantry'; index: number } | null>(null);
	const { showToast } = useToast();

	const handleDragStart = (e: React.DragEvent, item: ShoppingListItem | PantryItem, listType: 'fresh' | 'pantry') => {
		setIsDragging(true);

		e.dataTransfer.setData(
			'text/plain',
			JSON.stringify({
				item,
				sourceList: listType,
				sourceIndex: listType === 'fresh' ? ingredients.fresh.findIndex(i => i.id === item.id) : ingredients.pantry.findIndex(i => i.id === item.id),
			})
		);
		e.dataTransfer.effectAllowed = 'move';

		// Create a custom drag image that only shows the current row
		const dragRow = e.currentTarget as HTMLTableRowElement;
		const dragImage = dragRow.cloneNode(true) as HTMLTableRowElement;

		// Create a temporary table to hold just this row
		const tempTable = document.createElement('table');
		tempTable.style.position = 'absolute';
		tempTable.style.top = '-9999px';
		tempTable.style.left = '-9999px';
		tempTable.style.width = dragRow.offsetWidth + 'px';
		tempTable.className = 'bg-gray-50';
		tempTable.style.border = '1px solid rgba(0, 0, 0, 0.1)';
		tempTable.style.borderRadius = '4px';
		tempTable.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
		tempTable.appendChild(dragImage);

		document.body.appendChild(tempTable);

		// Set the custom drag image
		e.dataTransfer.setDragImage(tempTable, 0, 0);

		// Clean up the temporary element after drag starts
		setTimeout(() => {
			if (document.body.contains(tempTable)) {
				document.body.removeChild(tempTable);
			}
		}, 0);
	};

	const handleDragOver = (e: React.DragEvent, targetList?: 'fresh' | 'pantry', targetIndex?: number) => {
		e.preventDefault();
		e.stopPropagation(); // Prevent event bubbling
		e.dataTransfer.dropEffect = 'move';

		if (targetList !== undefined && targetIndex !== undefined) {
			setDragOverIndex({ list: targetList, index: targetIndex });
		}
	};

	const handleDragLeave = (e: React.DragEvent) => {
		// Only clear if we're leaving the table area
		if (!e.currentTarget.contains(e.relatedTarget as Node)) {
			setDragOverIndex(null);
		}
	};

	const handleDrop = async (e: React.DragEvent, targetList: 'fresh' | 'pantry', targetIndex?: number) => {
		e.preventDefault();
		e.stopPropagation(); // Prevent event bubbling
		setDragOverIndex(null); // Clear the drop indicator
		setIsDragging(false); // Reset dragging state

		try {
			const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
			const { item, sourceList, sourceIndex } = dragData;

			// Don't do anything if dropped in the same position
			if (sourceList === targetList && sourceIndex === targetIndex) {
				return;
			}

			const newFresh = targetList === 'fresh' ? 1 : 0;

			// Update local state optimistically
			setIngredients(prev => {
				const newState = { fresh: [...prev.fresh], pantry: [...prev.pantry] };

				// Remove item from source list first
				if (sourceList === 'fresh') {
					newState.fresh = newState.fresh.filter(i => i.id !== item.id);
				} else {
					newState.pantry = newState.pantry.filter(i => i.id !== item.id);
				}

				// Add item to target list at the correct position
				const updatedItem = { ...item, fresh: newFresh };
				if (targetList === 'fresh') {
					const actualIndex = targetIndex === undefined || targetIndex > newState.fresh.length ? newState.fresh.length : targetIndex;
					newState.fresh.splice(actualIndex, 0, updatedItem);
					// Update sort values to match array indices
					newState.fresh = newState.fresh.map((item, index) => ({ ...item, sort: index }));
				} else {
					const actualIndex = targetIndex === undefined || targetIndex > newState.pantry.length ? newState.pantry.length : targetIndex;
					newState.pantry.splice(actualIndex, 0, updatedItem);
					// Update sort values to match array indices
					newState.pantry = newState.pantry.map((item, index) => ({ ...item, sort: index }));
				}

				return newState;
			});

			// Send API request to update item - simplified to just send the new position
			const finalTargetIndex = targetIndex === undefined ? (targetList === 'fresh' ? ingredients.fresh.length : ingredients.pantry.length) : targetIndex;

			await ShoppingListService.moveItem(item.id, newFresh, finalTargetIndex, datestamp.week, datestamp.year);
			showToast('success', 'Saved', '');
		} catch (error) {
			// Revert the optimistic update on error
			setIngredients(ingredients);
			showToast('error', 'Error', error instanceof Error ? error.message : 'Failed to move item');
		} finally {
			setIsDragging(false); // Ensure dragging state is reset
		}
	};

	return {
		isDragging,
		dragOverIndex,
		handleDragStart,
		handleDragOver,
		handleDragLeave,
		handleDrop,
	};
}
