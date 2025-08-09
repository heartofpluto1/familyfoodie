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

	return (
		<>
			<div className="container mx-auto px-4 py-6">
				<div className="mb-6">
					<div className="flex justify-between items-center mb-2">
						<h2 className="text-2xl font-bold">Week {datestamp.week}</h2>
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
											className={`border-b border-light hover:bg-gray-50 transition-colors
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

			<style jsx>{`
				.supermarket-category-meat {
					border-left: 4px solid #ef4444;
				}
				.supermarket-category-fresh-fruitvege {
					border-left: 4px solid #22c55e;
				}
				.supermarket-category-fresh-herbs {
					border-left: 4px solid #84cc16;
				}
				.supermarket-category-nuts-root-vege {
					border-left: 4px solid #a3a3a3;
				}
				.supermarket-category-deli {
					border-left: 4px solid #f59e0b;
				}
				.supermarket-category-bakery {
					border-left: 4px solid #d97706;
				}
				.supermarket-category-center-aisles {
					border-left: 4px solid #6b7280;
				}
				.supermarket-category-dairy {
					border-left: 4px solid #3b82f6;
				}
				.supermarket-category-other {
					border-left: 4px solid #8b5cf6;
				}
			`}</style>
		</>
	);
}
