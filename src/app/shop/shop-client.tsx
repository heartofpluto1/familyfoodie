// app/shopping/[...params]/shopping-client.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingListData, Ingredient, ShoppingListItem, PantryItem, DateStamp } from '../../types/shop';
import { useToast } from '../components/ToastProvider';
import Tooltip from '../components/Tooltip';

interface ShoppingListClientProps {
	initialData: ShoppingListData;
	allIngredients: Ingredient[];
	datestamp: DateStamp;
	firstDay: string;
	lastDay: string;
}

const LinkIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
	<svg className={className} viewBox="0 0 24 24" fill="none">
		<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		<polyline points="15,3 21,3 21,9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		<line x1="10" y1="14" x2="21" y2="3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

const DeleteIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
	<svg className={className} viewBox="0 0 24 24" fill="none">
		<line x1="18" y1="6" x2="6" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		<line x1="6" y1="6" x2="18" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

const DragHandleIcon = ({ className = 'w-3 h-6' }: { className?: string }) => (
	<svg className={className} viewBox="0 0 12 24" fill="currentColor">
		<circle cx="3" cy="4" r="1.5" />
		<circle cx="3" cy="12" r="1.5" />
		<circle cx="3" cy="20" r="1.5" />
		<circle cx="9" cy="4" r="1.5" />
		<circle cx="9" cy="12" r="1.5" />
		<circle cx="9" cy="20" r="1.5" />
	</svg>
);

export default function ShoppingListClient({ initialData, allIngredients, datestamp, firstDay, lastDay }: ShoppingListClientProps) {
	const [ingredients, setIngredients] = useState<ShoppingListData>(initialData);
	const [cost, setCost] = useState<number>(0);
	const [isResetting, setIsResetting] = useState<boolean>(false);
	const [dragOverIndex, setDragOverIndex] = useState<{ list: 'fresh' | 'pantry'; index: number } | null>(null);
	const [isDragging, setIsDragging] = useState<boolean>(false);
	const [addItemValue, setAddItemValue] = useState<string>('');
	const [selectedIngredientId, setSelectedIngredientId] = useState<number | null>(null);
	const { showToast } = useToast();

	// Calculate total cost
	useEffect(() => {
		const totalCost = ingredients.fresh.reduce((sum, item) => {
			return sum + (item.cost || 0);
		}, 0);
		setCost(totalCost);
	}, [ingredients]);

	const roundToTwo = (num?: number): string | null => {
		return num ? `${Math.round(num * 100) / 100}` : null;
	};

	const formatPrice = (price?: number): string => {
		if (!price) return '';
		return price.toLocaleString('en-AU', {
			style: 'currency',
			currency: 'AUD',
		});
	};

	const capitalizeFirstLetter = (text: string): string => {
		return text.charAt(0).toUpperCase() + text.slice(1);
	};

	const getSupermarketCategoryColor = (category: string, opacity: boolean): string => {
		const defaultGray = '#6b7280';

		const colorMap: Record<string, string> = {
			meat: '#ef4444',
			'fresh-fruitvege': '#22c55e',
			'fresh-herbs': '#84cc16',
			'nuts-root-vege': '#a3a3a3',
			deli: '#f59e0b',
			bakery: '#d97706',
			'center-aisles': '#6b7280',
			dairy: '#3b82f6',
			other: '#8b5cf6',
		};

		const colorMapOpacity: Record<string, string> = {
			meat: 'rgba(239, 68, 68, 0.5)',
			'fresh-fruitvege': 'rgba(34, 197, 94, 0.5)',
			'fresh-herbs': 'rgba(132, 204, 22, 0.5)',
			'nuts-root-vege': 'rgba(163, 163, 163, 0.5)',
			deli: 'rgba(245, 158, 11, 0.5)',
			bakery: 'rgba(217, 119, 6, 0.5)',
			'center-aisles': 'rgba(107, 114, 128, 0.5)',
			dairy: 'rgba(59, 130, 246, 0.5)',
			other: 'rgba(139, 92, 246, 0.5)',
		};

		const className = category.replace(/ & /g, '').replace(/ /g, '-');
		const color = opacity ? colorMapOpacity[className] : colorMap[className];
		return color || defaultGray; // Default gray for unknown categories
	};

	const getPantryCategoryColor = (category: string, opacity: boolean): string => {
		const defaultGray = '#6b7280';

		const colorMap: Record<string, string> = {
			pantry: '#666666',
			'kitchen-cupboard': '#aaaaaa',
			fridge: '#95cddb',
			freezer: '95cddb',
			'breezeway-cupboard': '#dddddd',
			garden: '#13a40b',
			other: '#ffffff',
		};

		const colorMapOpacity: Record<string, string> = {
			pantry: 'rgba(102, 102, 102, 0.5)',
			'kitchen-cupboard': 'rgba(170, 170, 170, 0.5)',
			fridge: 'rgba(149, 205, 219, 0.5)',
			freezer: 'rgba(149, 205, 219, 0.5)',
			'breezeway-cupboard': 'rgba(221, 221, 221, 0.5)',
			garden: 'rgba(19, 164, 11, 0.5)',
			other: 'rgba(255, 255, 255, 0.5)',
		};

		const className = category.replace(/ /g, '-');
		const color = opacity ? colorMapOpacity[className] : colorMap[className];
		return color || defaultGray; // Default pantry gray for unknown categories
	};

	const handlePurchaseToggle = async (itemId: number, currentPurchased: boolean) => {
		const newPurchased = !currentPurchased;

		try {
			const response = await fetch('/api/shop/purchase', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					id: itemId,
					purchased: newPurchased,
				}),
			});

			if (response.ok) {
				// Update local state
				setIngredients(prev => ({
					...prev,
					fresh: prev.fresh.map(item => (item.id === itemId ? { ...item, purchased: newPurchased } : item)),
				}));
			} else {
				// Show error toast
				showToast('error', 'Error', 'Failed to update purchase status');
			}
		} catch (error) {
			// Show error toast
			showToast('error', 'Error', error instanceof Error ? error.message : 'An unexpected error occurred');
		}
	};

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

			const response = await fetch('/api/shop/move', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					id: item.id,
					fresh: newFresh,
					sort: finalTargetIndex,
					week: datestamp.week,
					year: datestamp.year,
				}),
			});

			if (response.ok) {
				showToast('success', 'Saved', '');
			} else {
				// Revert the optimistic update on error
				setIngredients(ingredients);
				showToast('error', 'Error', 'Failed to move item');
			}
		} catch (error) {
			// Revert the optimistic update on error
			setIngredients(ingredients);
			showToast('error', 'Error', error instanceof Error ? error.message : 'Failed to move item');
		} finally {
			setIsDragging(false); // Ensure dragging state is reset
		}
	};

	const handleReset = async () => {
		if (!confirm('Are you sure you want to reset the shopping list? This will rebuild it from your planned recipes for this week.')) {
			return;
		}

		setIsResetting(true);
		try {
			const response = await fetch('/api/shop/reset', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					week: datestamp.week,
					year: datestamp.year,
				}),
			});

			if (response.ok) {
				// Refresh the page to get the updated shopping list
				window.location.reload();
			} else {
				const data = await response.json();
				showToast('error', 'Error', `Failed to reset the shopping list: ${data.error}`);
			}
		} catch (error) {
			showToast('error', 'Error', error instanceof Error ? error.message : 'Error resetting shopping list');
		} finally {
			setIsResetting(false);
		}
	};

	const handleAddItem = async () => {
		if (!addItemValue.trim()) return;

		const itemName = addItemValue.trim();

		try {
			const response = await fetch('/api/shop/add', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					week: datestamp.week,
					year: datestamp.year,
					name: itemName,
					ingredient_id: selectedIngredientId,
				}),
			});

			if (response.ok) {
				const data = await response.json();

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
					// Use actual values from the selected ingredient or defaults for manual entry
					cost: matchingIngredient?.cost,
					stockcode: matchingIngredient?.stockcode ? Number(matchingIngredient.stockcode) : undefined,
					supermarketCategory: matchingIngredient?.supermarketCategory || '',
					pantryCategory: matchingIngredient?.pantryCategory || '',
				};

				// Update local state - add to bottom of shopping list
				setIngredients(prev => ({
					...prev,
					fresh: [...prev.fresh, newItem],
				}));

				// Clear the input and selection
				setAddItemValue('');
				setSelectedIngredientId(null);
				showToast('success', 'Saved new item', '');
			} else {
				const data = await response.json();
				showToast('error', 'Error', `Failed to add item: ${data.error}`);
			}
		} catch (error) {
			showToast('error', 'Error', error instanceof Error ? error.message : 'Error adding item');
		}
	};

	const handleRemove = async (itemId: number, itemName: string) => {
		try {
			const response = await fetch('/api/shop/remove', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					id: itemId,
				}),
			});

			if (response.ok) {
				// Update local state - remove item from shopping list
				setIngredients(prev => ({
					...prev,
					fresh: prev.fresh.filter(item => item.id !== itemId),
				}));

				showToast('success', 'Removed', itemName);
			} else {
				const data = await response.json();
				showToast('error', 'Error', `Failed to remove item: ${data.error}`);
			}
		} catch (error) {
			showToast('error', 'Error', error instanceof Error ? error.message : 'Error removing item');
		}
	};

	return (
		<div className="container mx-auto px-4 py-6">
			<div className="mb-6">
				<div className="flex justify-between items-center mb-2">
					<h2 className="text-2xl font-bold">Week {datestamp.week}</h2>
					<button
						onClick={handleReset}
						disabled={isResetting}
						className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
					>
						{isResetting ? 'Resetting...' : 'Reset List'}
					</button>
				</div>
				<h4 className="text-lg">
					{firstDay} → {lastDay}
				</h4>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Shopping List */}
				<div className="bg-white border border-custom rounded-lg shadow-md overflow-visible">
					<div className="bg-gray-50 px-6 py-4">
						<div className="flex justify-between items-center">
							<h3 className="text-xl font-semibold">Shopping List</h3>
							<span className="text-lg font-bold">{formatPrice(cost)}</span>
						</div>
					</div>

					<div className="overflow-visible">
						<table className="w-full">
							<thead>
								<tr className="border-b border-light">
									<th className="px-4 py-3 text-left text-sm font-medium">Ingredients</th>
									<th className="px-2 py-3 text-center text-sm font-medium w-20">2p</th>
									<th className="px-2 py-3 text-right text-sm font-medium w-24">Price</th>
									<th className="px-2 py-3 text-right text-sm font-medium w-8" colSpan={2}>
										Edit
									</th>
								</tr>
							</thead>
							<tbody onDragLeave={handleDragLeave}>
								{ingredients.fresh.map((item: ShoppingListItem, index) => (
									<React.Fragment key={`fragment-ingredient-${item.name}-${item.id}`}>
										{/* Drop indicator above the row */}
										{dragOverIndex?.list === 'fresh' && dragOverIndex.index === index && (
											<tr>
												<td colSpan={6} className="p-0">
													<div className="h-1 bg-blue-500 rounded"></div>
												</td>
											</tr>
										)}
										<tr
											draggable
											onDragStart={e => handleDragStart(e, item, 'fresh')}
											onDragOver={e => handleDragOver(e, 'fresh', index)}
											onDrop={e => handleDrop(e, 'fresh', index)}
											className="hover:bg-gray-50"
										>
											<td className="p-0">
												<div className="flex items-stretch h-full">
													<button
														className="relative group h-full flex items-center justify-center"
														style={{
															backgroundColor: getSupermarketCategoryColor(item.supermarketCategory || '', true),
															width: '15px',
															paddingTop: '12px',
															paddingBottom: '12px',
															cursor: 'grab',
														}}
														onMouseDown={e => {
															// Make the parent tr draggable when mouse down on drag handle
															const tr = e.currentTarget.closest('tr');
															if (tr) tr.draggable = true;
														}}
													>
														<DragHandleIcon className="w-3 h-6 text-white opacity-70" />
														<Tooltip
															text={item.supermarketCategory ? capitalizeFirstLetter(item.supermarketCategory) : ''}
															backgroundColor={getSupermarketCategoryColor(item.supermarketCategory || '', false)}
															forceHide={isDragging}
														/>
													</button>
													<div className="flex items-center px-2 py-2 flex-1">
														<input
															type="checkbox"
															checked={item.purchased}
															onChange={() => handlePurchaseToggle(item.id, item.purchased)}
															className="mr-3 h-4 w-4 text-blue-600 rounded cursor-pointer"
														/>
														<span className={`text-sm ${item.purchased ? 'opacity-50 line-through' : ''}`}>{item.name}</span>
													</div>
												</div>
											</td>
											<td className="text-center text-sm">
												{roundToTwo(parseFloat(item.quantity || '0'))} {item.quantityMeasure}
												{parseFloat(item.quantity || '0') > 1 ? 's' : ''}
											</td>
											<td className="px-2 py-2 text-right text-sm">{item.cost ? formatPrice(item.cost) : ''}</td>
											<td className="text-center">
												{item.stockcode && (
													<a
														href={`https://www.woolworths.com.au/shop/productdetails/${item.stockcode}/`}
														target="_blank"
														rel="noopener noreferrer"
														title="Woolworths details"
													>
														<LinkIcon className="w-4 h-4" />
													</a>
												)}
											</td>
											<td className="text-center">
												{(item.quantity === null || typeof item.quantity === 'undefined') && (
													<button
														title="Remove item"
														onClick={() => handleRemove(item.id, item.name)}
														className="text-red-500 hover:text-red-700 focus:outline-none"
													>
														<DeleteIcon className="w-6 h-6" />
													</button>
												)}
											</td>
										</tr>
									</React.Fragment>
								))}
								{/* Drop zone at the end of the list */}
								<tr
									onDragOver={e => handleDragOver(e, 'fresh', ingredients.fresh.length)}
									onDrop={e => handleDrop(e, 'fresh', ingredients.fresh.length)}
									className="h-1"
								>
									<td colSpan={6} className="p-0">
										{dragOverIndex?.list === 'fresh' && dragOverIndex.index === ingredients.fresh.length && (
											<div className="h-1 bg-blue-500 rounded"></div>
										)}
									</td>
								</tr>
							</tbody>
						</table>
					</div>

					{/* Add new item input */}
					<div className="p-4 bg-gray-50">
						<input
							type="text"
							value={addItemValue}
							onChange={e => {
								const newValue = e.target.value;
								setAddItemValue(newValue);

								// Check if the new value matches an ingredient from the datalist
								const matchingIngredient = allIngredients.find(ing => ing.name === newValue);
								setSelectedIngredientId(matchingIngredient ? matchingIngredient.ingredientId : null);
							}}
							onKeyDown={e => {
								if (e.key === 'Enter') {
									e.preventDefault();
									handleAddItem();
								}
							}}
							className="w-full px-2 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="add item..."
							list="all-ingredients"
						/>
						<datalist id="all-ingredients">
							{allIngredients.map(ing => (
								<option key={ing.ingredientId} value={ing.name} />
							))}
						</datalist>
					</div>
				</div>

				{/* Pantry */}
				<div className="bg-white border border-custom rounded-lg shadow-md overflow-visible">
					<div className="bg-gray-50 px-6 py-4">
						<h3 className="text-xl font-semibold">Pantry</h3>
					</div>

					<div className="overflow-visible">
						<table className="w-full">
							<thead>
								<tr className="border-b border-light">
									<th className="px-2 py-3 text-left text-sm font-medium">Ingredients</th>
									<th className="px-2 py-3 text-center text-sm font-medium w-30">2p</th>
								</tr>
							</thead>
							<tbody onDragLeave={handleDragLeave}>
								{ingredients.pantry.map((item: PantryItem, index) => (
									<React.Fragment key={`fragment-pantry-${item.name}-${item.id}`}>
										{/* Drop indicator above the row */}
										{dragOverIndex?.list === 'pantry' && dragOverIndex.index === index && (
											<tr>
												<td colSpan={3} className="p-0">
													<div className="h-1 bg-blue-500 rounded"></div>
												</td>
											</tr>
										)}
										<tr
											draggable
											onDragStart={e => handleDragStart(e, item, 'pantry')}
											onDragOver={e => handleDragOver(e, 'pantry', index)}
											onDrop={e => handleDrop(e, 'pantry', index)}
											className="hover:bg-gray-50"
										>
											<td className="p-0">
												<div className="flex items-stretch h-full">
													<button
														className="relative group h-full flex items-center justify-center"
														style={{
															backgroundColor: getPantryCategoryColor(item.pantryCategory || '', true),
															width: '15px',
															paddingTop: '12px',
															paddingBottom: '12px',
															cursor: 'grab',
														}}
														onMouseDown={e => {
															// Make the parent tr draggable when mouse down on drag handle
															const tr = e.currentTarget.closest('tr');
															if (tr) tr.draggable = true;
														}}
													>
														<DragHandleIcon className="w-3 h-6 text-white opacity-70" />
														<Tooltip
															text={item.pantryCategory ? capitalizeFirstLetter(item.pantryCategory) : ''}
															backgroundColor={getPantryCategoryColor(item.pantryCategory || '', false)}
															forceHide={isDragging}
														/>
													</button>
													<div className="flex items-center px-2 py-2 flex-1">
														<span className="text-sm">{item.name}</span>
													</div>
												</div>
											</td>
											<td className="px-2 py-2 text-center text-sm">
												{roundToTwo(parseFloat(item.quantity || '0'))} {item.quantityMeasure}
												{parseFloat(item.quantity || '0') > 1 ? 's' : ''}
											</td>
										</tr>
									</React.Fragment>
								))}
								{/* Drop zone at the end of the list */}
								<tr
									onDragOver={e => handleDragOver(e, 'pantry', ingredients.pantry.length)}
									onDrop={e => handleDrop(e, 'pantry', ingredients.pantry.length)}
									className="1"
								>
									<td colSpan={3} className="p-0">
										{dragOverIndex?.list === 'pantry' && dragOverIndex.index === ingredients.pantry.length && (
											<div className="h-1 bg-blue-500 rounded"></div>
										)}
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
}
