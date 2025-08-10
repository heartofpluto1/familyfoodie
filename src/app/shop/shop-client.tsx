'use client';

import React from 'react';
import { ShoppingListData, Ingredient, DateStamp } from '../../types/shop';
import { ShoppingListProvider, useShoppingListContext } from './contexts/ShoppingListContext';
import { ShoppingListTable } from './components/ShoppingListTable';
import { PantryTable } from './components/PantryTable';
import { AddItemInput } from './components/AddItemInput';
import { formatPrice } from './utils/shoppingListUtils';

interface ShoppingListClientProps {
	initialData: ShoppingListData;
	allIngredients: Ingredient[];
	datestamp: DateStamp;
	firstDay: string;
	lastDay: string;
}

function ShoppingListContent({ firstDay, lastDay }: { firstDay: string; lastDay: string }) {
	const {
		ingredients,
		cost,
		isResetting,
		datestamp,
		allIngredients,
		removeItem,
		togglePurchase,
		resetList,
		isDragging,
		dragOverIndex,
		handleDragStart,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		addItemValue,
		handleInputChange,
		addItem,
	} = useShoppingListContext();

	return (
		<div className="container mx-auto px-4 py-6">
			<div className="mb-6">
				<div className="flex justify-between items-center mb-2">
					<h2 className="text-2xl font-bold">Week {datestamp.week}</h2>
					<button
						onClick={resetList}
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

					<ShoppingListTable
						items={ingredients.fresh}
						dragOverIndex={dragOverIndex}
						isDragging={isDragging}
						onTogglePurchase={togglePurchase}
						onRemoveItem={removeItem}
						onDragStart={handleDragStart}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
					/>

					<AddItemInput value={addItemValue} onChange={handleInputChange} onAddItem={addItem} allIngredients={allIngredients} />
				</div>

				{/* Pantry */}
				<div className="bg-white border border-custom rounded-lg shadow-md overflow-visible">
					<div className="bg-gray-50 px-6 py-4">
						<h3 className="text-xl font-semibold">Pantry</h3>
					</div>

					<PantryTable
						items={ingredients.pantry}
						dragOverIndex={dragOverIndex}
						isDragging={isDragging}
						onDragStart={handleDragStart}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
					/>
				</div>
			</div>
		</div>
	);
}

export default function ShoppingListClient({ initialData, allIngredients, datestamp, firstDay, lastDay }: ShoppingListClientProps) {
	return (
		<ShoppingListProvider initialData={initialData} datestamp={datestamp} allIngredients={allIngredients}>
			<ShoppingListContent firstDay={firstDay} lastDay={lastDay} />
		</ShoppingListProvider>
	);
}
