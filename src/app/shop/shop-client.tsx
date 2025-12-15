'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingListData, Ingredient, DateStamp } from '@/types/shop';
import { ShoppingListProvider, useShoppingListContext } from './contexts/ShoppingListContext';
import { ShoppingListTableDnd } from './components/ShoppingListTableDnd';
import { PantryTableDnd } from './components/PantryTableDnd';
import { AddItemInput } from './components/AddItemInput';
import { formatPrice } from '@/lib/utils/formatting';
import HeaderPage from '@/app/components/HeaderPage';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import { DndContext, closestCenter } from '@dnd-kit/core';
import Link from 'next/link';

interface ShoppingListClientProps {
	initialData: ShoppingListData;
	allIngredients: Ingredient[];
	datestamp: DateStamp;
	weekDateRange: string;
}

function ShoppingListContent({ weekDateRange }: { weekDateRange: string }) {
	const {
		ingredients,
		cost,
		isResetting,
		datestamp,
		allIngredients,
		removeItem,
		togglePurchase,
		resetListClick,
		resetListConfirm,
		resetListCancel,
		showResetConfirm,
		dndKitHandlers,
		addItemValue,
		handleInputChange,
		addItem,
	} = useShoppingListContext();

	const [isClient, setIsClient] = useState(() => typeof window !== 'undefined');

	// Check if both lists are empty
	const isListEmpty = ingredients.fresh.length === 0 && ingredients.pantry.length === 0;

	if (!isClient) {
		// Server-side render without DndContext
		return (
			<div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
				<div className="mb-4 sm:mb-8">
					<HeaderPage title={`Week ${datestamp.week} Shop`} subtitle={weekDateRange} />
				</div>

				{isListEmpty ? (
					<div className="bg-white border border-custom rounded-sm shadow-md p-12 text-center">
						<div className="max-w-md mx-auto space-y-4">
							<h2 className="text-2xl font-semibold text-foreground">No Shopping List Yet</h2>
							<p className="text-gray-600 dark:text-gray-400">
								Your shopping list is empty! Head over to the meal planner to choose some delicious recipes for the week.
							</p>
							<Link
								href="/plan"
								className="inline-block bg-accent text-background px-6 py-3 rounded-sm font-medium hover:bg-accent/90 transition-colors mt-4"
							>
								Plan Your Meals
							</Link>
						</div>
					</div>
				) : (
					<>
						<div className="mb-4 sm:mb-6">
							<button
								onClick={resetListClick}
								disabled={isResetting}
								className="btn-default px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50"
							>
								{isResetting ? 'Resetting...' : 'Reset List'}
							</button>
						</div>

						<div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
							{/* Shopping List */}
							<div className="bg-white border border-custom rounded-sm shadow-md overflow-visible">
								<div className="bg-gray-50 px-2 sm:px-3 py-3 sm:py-4">
									<div className="flex justify-between items-center">
										<h3 className="text-lg sm:text-xl px-1">Shopping List</h3>
										<h3 className="text-lg sm:text-xl">{formatPrice(cost)}</h3>
									</div>
								</div>

								<ShoppingListTableDnd
									items={ingredients.fresh}
									onTogglePurchase={togglePurchase}
									onRemoveItem={removeItem}
									overId={dndKitHandlers.overId}
								/>

								<AddItemInput value={addItemValue} onChange={handleInputChange} onAddItem={addItem} allIngredients={allIngredients} />
							</div>

							{/* Pantry */}
							<div className="bg-white border border-custom rounded-sm shadow-md overflow-visible">
								<div className="bg-gray-50 px-4 sm:px-4 py-3 sm:py-4">
									<h3 className="text-lg sm:text-xl">Pantry</h3>
								</div>

								<PantryTableDnd items={ingredients.pantry} overId={dndKitHandlers.overId} />
							</div>
						</div>
					</>
				)}
			</div>
		);
	}

	return (
		<DndContext
			sensors={dndKitHandlers.sensors}
			collisionDetection={closestCenter}
			onDragStart={dndKitHandlers.handleDragStart}
			onDragOver={dndKitHandlers.handleDragOver}
			onDragEnd={dndKitHandlers.handleDragEnd}
			autoScroll={{ enabled: false }}
		>
			<div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
				<div className="mb-4 sm:mb-8">
					<HeaderPage title={`Week ${datestamp.week} Shop`} subtitle={weekDateRange} />
				</div>

				{isListEmpty ? (
					<div className="bg-white border border-custom rounded-sm shadow-md p-12 text-center">
						<div className="max-w-md mx-auto space-y-4">
							<h2 className="text-2xl font-semibold text-foreground">No Shopping List Yet</h2>
							<p className="text-gray-600 dark:text-gray-400">
								Your shopping list is empty! Head over to the meal planner to choose some delicious recipes for the week.
							</p>
							<Link
								href="/plan"
								className="inline-block bg-accent text-background px-6 py-3 rounded-sm font-medium hover:bg-accent/90 transition-colors mt-4"
							>
								Plan Your Meals
							</Link>
						</div>
					</div>
				) : (
					<>
						<div className="mb-4 sm:mb-6">
							<button
								onClick={resetListClick}
								disabled={isResetting}
								className="btn-default px-3 py-1.5 rounded text-sm font-medium disabled:opacity-50"
							>
								{isResetting ? 'Resetting...' : 'Reset List'}
							</button>
						</div>

						<div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
							{/* Shopping List */}
							<div className="bg-white border border-custom rounded-sm shadow-md overflow-visible">
								<div className="bg-gray-50 px-2 sm:px-3 py-3 sm:py-4">
									<div className="flex justify-between items-center">
										<h3 className="text-lg sm:text-xl">Shopping List</h3>
										<h3 className="text-lg sm:text-xl">{formatPrice(cost)}</h3>
									</div>
								</div>

								<ShoppingListTableDnd
									items={ingredients.fresh}
									onTogglePurchase={togglePurchase}
									onRemoveItem={removeItem}
									overId={dndKitHandlers.overId}
								/>

								<AddItemInput value={addItemValue} onChange={handleInputChange} onAddItem={addItem} allIngredients={allIngredients} />
							</div>

							{/* Pantry */}
							<div className="bg-white border border-custom rounded-sm shadow-md overflow-visible">
								<div className="bg-gray-50 px-2 sm:px-3 py-3 sm:py-4">
									<h3 className="text-lg sm:text-xl">Pantry</h3>
								</div>

								<PantryTableDnd items={ingredients.pantry} overId={dndKitHandlers.overId} />
							</div>
						</div>

						{/* Reset Shopping List Confirmation Dialog */}
						<ConfirmDialog
							isOpen={showResetConfirm}
							title="Reset Shopping List"
							message="Are you sure you want to reset the shopping list? This will rebuild it from your planned recipes for this week."
							confirmText="Reset List"
							cancelText="Cancel"
							onConfirm={resetListConfirm}
							onCancel={resetListCancel}
							isLoading={isResetting}
						/>
					</>
				)}
			</div>
		</DndContext>
	);
}

export default function ShoppingListClient({ initialData, allIngredients, datestamp, weekDateRange }: ShoppingListClientProps) {
	return (
		<ShoppingListProvider initialData={initialData} datestamp={datestamp} allIngredients={allIngredients}>
			<ShoppingListContent weekDateRange={weekDateRange} />
		</ShoppingListProvider>
	);
}
