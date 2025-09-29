import { useState } from 'react';
import {
	KeyboardSensor,
	PointerSensor,
	TouchSensor,
	useSensor,
	useSensors,
	DragEndEvent,
	DragOverEvent,
	DragStartEvent,
	UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ShoppingListData, ListItem, DateStamp } from '@/types/shop';
import { ShoppingListService } from '@/app/shop/services/shoppingListService';
import { useToast } from '@/app/components/ToastProvider';

export function useDndKit(ingredients: ShoppingListData, setIngredients: (value: React.SetStateAction<ShoppingListData>) => void, datestamp: DateStamp) {
	const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
	const [overId, setOverId] = useState<UniqueIdentifier | null>(null);
	const [originalState, setOriginalState] = useState<ShoppingListData | null>(null);
	const { showToast } = useToast();

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
		useSensor(TouchSensor, {
			activationConstraint: {
				delay: 150,
				tolerance: 8,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const handleDragStart = (event: DragStartEvent) => {
		setActiveId(event.active.id);
		// Store the original state in case we need to revert
		setOriginalState({ fresh: [...ingredients.fresh], pantry: [...ingredients.pantry] });
	};

	const handleDragOver = (event: DragOverEvent) => {
		const { active, over } = event;

		if (!over) {
			setOverId(null);
			// Revert to original state if dragging outside droppable area
			if (originalState) {
				setIngredients(originalState);
			}
			return;
		}

		setOverId(over.id);

		// Get the list types from the IDs
		const activeList = getListFromId(active.id, ingredients);
		const overList = getListFromId(over.id, ingredients);

		// If moving between lists, update state immediately for live preview
		if (activeList !== overList && activeList && overList) {
			const activeItem = findItemById(active.id, ingredients);
			if (!activeItem) return;

			setIngredients(prev => {
				// Calculate insert position BEFORE modifying the arrays
				let insertIndex = 0;
				if (overList === 'fresh') {
					insertIndex = prev.fresh.length; // Default to end
					if (over.id !== 'fresh-droppable') {
						const overIndex = prev.fresh.findIndex(i => i.id.toString() === over.id.toString());
						if (overIndex !== -1) {
							insertIndex = overIndex + 1; // Insert after the target item
						}
					}
				} else {
					insertIndex = prev.pantry.length; // Default to end
					if (over.id !== 'pantry-droppable') {
						const overIndex = prev.pantry.findIndex(i => i.id.toString() === over.id.toString());
						if (overIndex !== -1) {
							insertIndex = overIndex + 1; // Insert after the target item
						}
					}
				}

				const newState = { fresh: [...prev.fresh], pantry: [...prev.pantry] };

				// Remove from source list
				if (activeList === 'fresh') {
					newState.fresh = newState.fresh.filter(i => i.id.toString() !== activeItem.id.toString());
				} else {
					newState.pantry = newState.pantry.filter(i => i.id.toString() !== activeItem.id.toString());
				}

				// Add to target list at the calculated position
				const updatedItem: ListItem = {
					...activeItem,
					fresh: overList === 'fresh',
					purchased: activeItem.purchased || false,
				};

				if (overList === 'fresh') {
					newState.fresh.splice(insertIndex, 0, updatedItem);
					newState.fresh = newState.fresh.map((item, index) => ({ ...item, sort: index }));
				} else {
					newState.pantry.splice(insertIndex, 0, updatedItem);
					newState.pantry = newState.pantry.map((item, index) => ({ ...item, sort: index }));
				}

				return newState;
			});
		}
	};

	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;

		setActiveId(null);
		setOverId(null);

		if (!over) {
			// Revert to original state if dropped outside
			if (originalState) {
				setIngredients(originalState);
			}
			setOriginalState(null);
			return;
		}

		// Use original state to determine source item and lists
		const originalActiveItem = originalState ? findItemById(active.id, originalState) : null;
		const originalActiveList = originalState ? getListFromId(active.id, originalState) : null;
		const overList = getListFromId(over.id, ingredients);

		if (!originalActiveItem || !originalActiveList) {
			setOriginalState(null);
			return;
		}

		try {
			if (originalActiveList === overList) {
				// Reordering within the same list - need to handle this properly since state might have been modified
				if (active.id !== over.id) {
					// Revert to original state first, then do the reorder
					setIngredients(prev => {
						const baseState = originalState || prev;
						const newState = { fresh: [...baseState.fresh], pantry: [...baseState.pantry] };
						const list = originalActiveList === 'fresh' ? 'fresh' : 'pantry';
						const oldIndex = baseState[list].findIndex(item => item.id.toString() === active.id.toString());
						const newIndex = baseState[list].findIndex(item => item.id.toString() === over.id.toString());

						if (oldIndex !== -1 && newIndex !== -1) {
							newState[list] = arrayMove(baseState[list], oldIndex, newIndex);
							// Update sort values
							newState[list] = newState[list].map((item, index) => ({ ...item, sort: index }));
						}

						return newState;
					});

					// Update backend
					const targetList = originalActiveList === 'fresh' ? originalState?.fresh || ingredients.fresh : originalState?.pantry || ingredients.pantry;
					const newIndex = targetList.findIndex(item => item.id.toString() === over.id.toString());
					const newFresh = originalActiveList === 'fresh';

					await ShoppingListService.moveItem(originalActiveItem.ids || Number(active.id), newFresh, newIndex, datestamp.week, datestamp.year);
				}
			} else if (overList) {
				// Moving between lists - state has already been updated during dragOver, just need to persist to backend
				const newFresh = overList === 'fresh';

				// Find the actual position where the item was inserted
				let targetIndex = 0;
				if (overList === 'fresh') {
					targetIndex = ingredients.fresh.findIndex(i => i.id.toString() === active.id.toString());
				} else {
					targetIndex = ingredients.pantry.findIndex(i => i.id.toString() === active.id.toString());
				}

				// If not found, default to end of list
				if (targetIndex === -1) {
					targetIndex = overList === 'fresh' ? ingredients.fresh.length - 1 : ingredients.pantry.length - 1;
				}

				await ShoppingListService.moveItem(originalActiveItem.ids || Number(active.id), newFresh, targetIndex, datestamp.week, datestamp.year);
			}

			showToast('success', 'Saved', '');
		} catch (error) {
			// Revert on error to original state
			if (originalState) {
				setIngredients(originalState);
			}
			showToast('error', 'Error', error instanceof Error ? error.message : 'Failed to move item');
		} finally {
			setOriginalState(null);
		}
	};

	return {
		sensors,
		activeId,
		overId,
		handleDragStart,
		handleDragOver,
		handleDragEnd,
	};
}

// Helper functions
function getListFromId(id: UniqueIdentifier, ingredients: ShoppingListData): 'fresh' | 'pantry' | null {
	const idString = id.toString();

	const freshItem = ingredients.fresh.find(item => item.id.toString() === idString);
	if (freshItem) return 'fresh';

	const pantryItem = ingredients.pantry.find(item => item.id.toString() === idString);
	if (pantryItem) return 'pantry';

	// Check if it's a droppable container ID
	if (id === 'fresh-droppable') return 'fresh';
	if (id === 'pantry-droppable') return 'pantry';

	return null;
}

function findItemById(id: UniqueIdentifier, ingredients: ShoppingListData): ListItem | null {
	const idString = id.toString();

	const freshItem = ingredients.fresh.find(item => item.id.toString() === idString);
	if (freshItem) return freshItem;

	const pantryItem = ingredients.pantry.find(item => item.id.toString() === idString);
	if (pantryItem) return pantryItem;

	return null;
}
