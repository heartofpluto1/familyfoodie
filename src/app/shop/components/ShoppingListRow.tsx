import React from 'react';
import { ShoppingListItem } from '@/types/shop';
import { DragHandleIcon, LinkIcon, DeleteIcon } from '@/app/components/Icons';
import Tooltip from '@/app/components/Tooltip';
import { getSupermarketCategoryColor } from '@/app/shop/utils/categoryColors';
import { roundToTwo, formatPrice, capitalizeFirstLetter } from '@/app/shop/utils/shoppingListUtils';

interface ShoppingListRowProps {
	item: ShoppingListItem;
	index: number;
	dragOverIndex: { list: 'fresh' | 'pantry'; index: number } | null;
	isDragging: boolean;
	onTogglePurchase: (itemId: number, purchased: boolean) => void;
	onRemoveItem: (itemId: number, itemName: string) => void;
	onDragStart: (e: React.DragEvent, item: ShoppingListItem, listType: 'fresh' | 'pantry') => void;
	onDragOver: (e: React.DragEvent, targetList?: 'fresh' | 'pantry', targetIndex?: number) => void;
	onDrop: (e: React.DragEvent, targetList: 'fresh' | 'pantry', targetIndex?: number) => void;
}

export function ShoppingListRow({
	item,
	index,
	dragOverIndex,
	isDragging,
	onTogglePurchase,
	onRemoveItem,
	onDragStart,
	onDragOver,
	onDrop,
}: ShoppingListRowProps) {
	return (
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
				onDragStart={e => onDragStart(e, item, 'fresh')}
				onDragOver={e => onDragOver(e, 'fresh', index)}
				onDrop={e => onDrop(e, 'fresh', index)}
				className="hover:bg-gray-50"
			>
				<td className="p-0">
					<div className="flex items-stretch h-full">
						<button
							className="relative group h-full flex items-center justify-center"
							style={{
								backgroundColor: getSupermarketCategoryColor(item.supermarketCategory || '', true),
								width: '8px',
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
						<div className="flex items-center px-1 py-1 flex-1">
							<input
								type="checkbox"
								checked={item.purchased}
								onChange={() => onTogglePurchase(item.id, item.purchased)}
								className="ml-2 mr-2 sm:ml-2 sm:mr-3 h-4 w-4 text-blue-600 rounded cursor-pointer"
							/>
							<span className={`text-xs sm:text-sm ${item.purchased ? 'opacity-50 line-through' : ''}`}>{item.name}</span>
						</div>
					</div>
				</td>
				<td className="text-center text-xs sm:text-sm px-1 py-1">
					{roundToTwo(parseFloat(item.quantity || '0'))} {item.quantityMeasure}
					{parseFloat(item.quantity || '0') > 1 ? 's' : ''}
				</td>
				<td className="px-1 py-1 text-right text-xs sm:text-sm">{item.cost ? formatPrice(item.cost) : ''}</td>
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
						<button title="Remove item" onClick={() => onRemoveItem(item.id, item.name)} className="focus:outline-none">
							<DeleteIcon className="w-5 h-5 mt-2" />
						</button>
					)}
				</td>
			</tr>
		</React.Fragment>
	);
}
