import React, { useState, useRef, useEffect } from 'react';
import { ShoppingListData, ShoppingListItem, PantryItem, DateStamp } from '@/types/shop';
import { ShoppingListService } from '@/app/shop/services/shoppingListService';
import { useToast } from '@/app/components/ToastProvider';

export function useDragAndDrop(ingredients: ShoppingListData, setIngredients: (value: React.SetStateAction<ShoppingListData>) => void, datestamp: DateStamp) {
	const [isDragging, setIsDragging] = useState<boolean>(false);
	const [dragOverIndex, setDragOverIndex] = useState<{ list: 'fresh' | 'pantry'; index: number } | null>(null);
	const { showToast } = useToast();

	// Touch drag state
	const touchDragData = useRef<{
		item: ShoppingListItem | PantryItem;
		sourceList: 'fresh' | 'pantry';
		sourceIndex: number;
		startY: number;
		currentY: number;
		dragElement: HTMLElement | null;
	} | null>(null);

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

		// Set the custom drag image - offset by table width so it appears to the left of cursor
		e.dataTransfer.setDragImage(tempTable, dragRow.offsetWidth, 0);

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
				const updatedItem = { ...item, fresh: newFresh === 1 };
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

	// Touch event handlers for mobile drag and drop
	const handleTouchStart = (e: React.TouchEvent, item: ShoppingListItem | PantryItem, listType: 'fresh' | 'pantry') => {
		const touch = e.touches[0];
		const sourceIndex = listType === 'fresh' ? ingredients.fresh.findIndex(i => i.id === item.id) : ingredients.pantry.findIndex(i => i.id === item.id);

		// Find the parent table row (same pattern as mouse drag)
		const dragHandle = e.currentTarget as HTMLElement;
		const dragRow = dragHandle.closest('tr') as HTMLTableRowElement;
		if (!dragRow) return;

		// Create drag element using same approach as mouse drag
		const dragImage = dragRow.cloneNode(true) as HTMLTableRowElement;

		// Create a temporary table to hold just this row (same as mouse drag)
		const tempTable = document.createElement('table');
		tempTable.style.position = 'fixed';
		tempTable.style.pointerEvents = 'none';
		tempTable.style.zIndex = '1000';
		tempTable.style.width = dragRow.offsetWidth + 'px';
		tempTable.className = 'bg-gray-50';
		tempTable.style.border = '1px solid rgba(0, 0, 0, 0.1)';
		tempTable.style.borderRadius = '4px';
		tempTable.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
		tempTable.style.left = touch.clientX - dragRow.offsetWidth + 'px';
		tempTable.style.top = touch.clientY - 20 + 'px';
		tempTable.appendChild(dragImage);

		document.body.appendChild(tempTable);

		// Disable page scroll and text selection during drag
		document.body.style.overflow = 'hidden';
		document.body.style.userSelect = 'none';
		document.body.style.webkitUserSelect = 'none';

		touchDragData.current = {
			item,
			sourceList: listType,
			sourceIndex,
			startY: touch.clientY,
			currentY: touch.clientY,
			dragElement: tempTable,
		};

		setIsDragging(true);
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		e.preventDefault(); // Prevent scrolling

		if (!touchDragData.current) return;

		const touch = e.touches[0];
		touchDragData.current.currentY = touch.clientY;

		// Update drag element position
		if (touchDragData.current.dragElement) {
			const dragRowWidth = touchDragData.current.dragElement.offsetWidth;
			touchDragData.current.dragElement.style.left = touch.clientX - dragRowWidth + 'px';
			touchDragData.current.dragElement.style.top = touch.clientY - 20 + 'px';
		}

		// Find the element under the touch point
		const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
		const tableRow = elementBelow?.closest('tr');

		if (tableRow && tableRow.draggable) {
			// Determine if this is fresh or pantry table
			const table = tableRow.closest('table');
			const tableContainer = table?.closest('[data-list-type]');
			const listType = tableContainer?.getAttribute('data-list-type') as 'fresh' | 'pantry';

			if (listType) {
				const rows = Array.from(table!.querySelectorAll('tr[draggable="true"]'));
				const targetIndex = rows.indexOf(tableRow);

				if (targetIndex >= 0) {
					setDragOverIndex({ list: listType, index: targetIndex });
				}
			}
		} else {
			setDragOverIndex(null);
		}
	};

	const handleTouchEnd = async (e: React.TouchEvent) => {
		if (!touchDragData.current) return;

		const touch = e.changedTouches[0];

		// Clean up drag element and restore page behavior
		if (touchDragData.current.dragElement) {
			document.body.removeChild(touchDragData.current.dragElement);
		}

		// Re-enable page scroll and text selection
		document.body.style.overflow = '';
		document.body.style.userSelect = '';
		document.body.style.webkitUserSelect = '';

		// Find drop target
		const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
		const tableRow = elementBelow?.closest('tr');

		if (tableRow && tableRow.draggable) {
			const table = tableRow.closest('table');
			const tableContainer = table?.closest('[data-list-type]');
			const targetList = tableContainer?.getAttribute('data-list-type') as 'fresh' | 'pantry';

			if (targetList) {
				const rows = Array.from(table!.querySelectorAll('tr[draggable="true"]'));
				const targetIndex = rows.indexOf(tableRow);

				if (targetIndex >= 0) {
					// Perform the drop operation
					const { item, sourceList, sourceIndex } = touchDragData.current;

					// Don't do anything if dropped in the same position
					if (sourceList === targetList && sourceIndex === targetIndex) {
						setDragOverIndex(null);
						setIsDragging(false);
						touchDragData.current = null;
						return;
					}

					try {
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
							const updatedItem = {
								...item,
								fresh: newFresh === 1,
								purchased: 'purchased' in item ? item.purchased : false,
							};
							if (targetList === 'fresh') {
								const actualIndex = targetIndex === undefined || targetIndex > newState.fresh.length ? newState.fresh.length : targetIndex;
								newState.fresh.splice(actualIndex, 0, updatedItem as ShoppingListItem);
								// Update sort values to match array indices
								newState.fresh = newState.fresh.map((item, index) => ({ ...item, sort: index }));
							} else {
								const actualIndex = targetIndex === undefined || targetIndex > newState.pantry.length ? newState.pantry.length : targetIndex;
								newState.pantry.splice(actualIndex, 0, updatedItem as PantryItem);
								// Update sort values to match array indices
								newState.pantry = newState.pantry.map((item, index) => ({ ...item, sort: index }));
							}

							return newState;
						});

						// Send API request to update item
						const finalTargetIndex =
							targetIndex === undefined ? (targetList === 'fresh' ? ingredients.fresh.length : ingredients.pantry.length) : targetIndex;
						await ShoppingListService.moveItem(item.id, newFresh, finalTargetIndex, datestamp.week, datestamp.year);
						showToast('success', 'Saved', '');
					} catch (error) {
						// Revert the optimistic update on error
						setIngredients(ingredients);
						showToast('error', 'Error', error instanceof Error ? error.message : 'Failed to move item');
					}
				}
			}
		}

		setDragOverIndex(null);
		setIsDragging(false);
		touchDragData.current = null;
	};

	// Cleanup function to restore page behavior if component unmounts during drag
	const cleanupTouchDrag = () => {
		if (touchDragData.current?.dragElement) {
			document.body.removeChild(touchDragData.current.dragElement);
		}
		document.body.style.overflow = '';
		document.body.style.userSelect = '';
		document.body.style.webkitUserSelect = '';
		touchDragData.current = null;
	};

	// Cleanup on unmount
	useEffect(() => {
		return cleanupTouchDrag;
	}, []);

	return {
		isDragging,
		dragOverIndex,
		handleDragStart,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		handleTouchStart,
		handleTouchMove,
		handleTouchEnd,
	};
}
