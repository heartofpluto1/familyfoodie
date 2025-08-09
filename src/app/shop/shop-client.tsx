// app/shopping/[...params]/shopping-client.tsx
'use client';

import { useState, useEffect } from 'react';
import { ShoppingListData, Ingredient, ShoppingListItem, PantryItem, DateStamp } from '../../types/shop';

interface ShoppingListClientProps {
	initialData: ShoppingListData;
	allIngredients: Ingredient[];
	datestamp: DateStamp;
	firstDay: string;
	lastDay: string;
}

const LinkIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
	<svg className={className} viewBox="0 0 24 24" fill="none">
		<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

const DeleteIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
	<svg className={className} viewBox="0 0 24 24" fill="none">
		<line x1="18" y1="6" x2="6" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		<line x1="6" y1="6" x2="18" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

export default function ShoppingListClient({ initialData, allIngredients, datestamp, firstDay, lastDay }: ShoppingListClientProps) {
	const [ingredients] = useState<ShoppingListData>(initialData);
	const [cost, setCost] = useState<number>(0);
	const [isResetting, setIsResetting] = useState<boolean>(false);

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

	const getSupermarketCategoryClass = (category?: string): string => {
		if (!category) return '';
		return `supermarket-category-${category.replace(/ & /g, '').replace(/ /g, '-')}`;
	};

	const getPantryCategoryClass = (category?: string): string => {
		if (!category) return '';
		return `pantry-category-${category.replace(/ /g, '-')}`;
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
				console.error('Failed to reset shopping list:', data.error);
				alert('Failed to reset shopping list. Please try again.');
			}
		} catch (error) {
			console.error('Error resetting shopping list:', error);
			alert('An error occurred while resetting the shopping list.');
		} finally {
			setIsResetting(false);
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
				<div className="bg-white border border-custom rounded-lg shadow-md overflow-hidden">
					<div className="bg-gray-50 px-6 py-4">
						<div className="flex justify-between items-center">
							<h3 className="text-xl font-semibold">Shopping List</h3>
							<span className="text-lg font-bold">{formatPrice(cost)}</span>
						</div>
					</div>

					<div className="overflow-x-auto">
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
							<tbody>
								{ingredients.fresh.map((item: ShoppingListItem) => (
									<tr
										key={`ingredient-${item.name}-${item.id}`}
										className={`border-b border-light transition-colors
                      ${getSupermarketCategoryClass(item.supermarketCategory)}
                    `}
									>
										<td className="px-2 py-2">
											<div className="flex items-center">
												<input type="checkbox" checked={item.purchased} className="mr-3 h-4 w-4 text-blue-600 rounded" readOnly />
												<span className={`text-sm ${item.purchased ? 'opacity-50 line-through' : ''}`}>{item.name}</span>
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
											{item.ingredientId === null && (
												<button title="Remove item">
													<DeleteIcon className="w-6 h-6" />
												</button>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					{/* Add new item input */}
					<div className="p-4 bg-gray-50">
						<input
							type="text"
							className="w-full px-2 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="add item..."
							list="all-ingredients"
						/>
						<datalist id="all-ingredients">
							{allIngredients.map(ing => (
								<option key={ing.id} value={ing.ingredient__name} />
							))}
						</datalist>
					</div>
				</div>

				{/* Pantry */}
				<div className="bg-white border border-custom rounded-lg shadow-md overflow-hidden">
					<div className="bg-gray-50 px-6 py-4">
						<h3 className="text-xl font-semibold">Pantry</h3>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b border-light">
									<th className="px-2 py-3 text-left text-sm font-medium">Ingredients</th>
									<th className="px-2 py-3 text-center text-sm font-medium w-30">2p</th>
								</tr>
							</thead>
							<tbody>
								{ingredients.pantry.map((item: PantryItem) => (
									<tr
										key={`ingredient-${item.name}-${item.id}`}
										className={`border-b border-light transition-colors ${getPantryCategoryClass(item.pantryCategory)}`}
									>
										<td className="px-2 py-2">
											<span className="text-sm">{item.name}</span>
										</td>
										<td className="px-2 py-2 text-center text-sm">
											{roundToTwo(parseFloat(item.quantity || '0'))} {item.quantityMeasure}
											{parseFloat(item.quantity || '0') > 1 ? 's' : ''}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
}
