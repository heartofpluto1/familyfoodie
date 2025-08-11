import React from 'react';
import { ShoppingListItem } from '@/types/shop';
import { ShoppingListRow } from './ShoppingListRow';

interface ShoppingListTableProps {
	items: ShoppingListItem[];
	dragOverIndex: { list: 'fresh' | 'pantry'; index: number } | null;
	isDragging: boolean;
	onTogglePurchase: (itemId: number, purchased: boolean) => void;
	onRemoveItem: (itemId: number, itemName: string) => void;
	onDragStart: (e: React.DragEvent, item: ShoppingListItem, listType: 'fresh' | 'pantry') => void;
	onDragOver: (e: React.DragEvent, targetList?: 'fresh' | 'pantry', targetIndex?: number) => void;
	onDragLeave: (e: React.DragEvent) => void;
	onDrop: (e: React.DragEvent, targetList: 'fresh' | 'pantry', targetIndex?: number) => void;
	onTouchStart?: (e: React.TouchEvent, item: ShoppingListItem, listType: 'fresh' | 'pantry') => void;
	onTouchMove?: (e: React.TouchEvent) => void;
	onTouchEnd?: (e: React.TouchEvent) => void;
}

export function ShoppingListTable({
	items,
	dragOverIndex,
	isDragging,
	onTogglePurchase,
	onRemoveItem,
	onDragStart,
	onDragOver,
	onDragLeave,
	onDrop,
	onTouchStart,
	onTouchMove,
	onTouchEnd,
}: ShoppingListTableProps) {
	return (
		<div className="overflow-visible" data-list-type="fresh">
			<table className="w-full">
				<thead>
					<tr className="border-b border-light">
						<th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium">Ingredients</th>
						<th className="px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm font-medium w-20 sm:w-20">2p</th>
						<th className="px-1 sm:px-2 py-2 sm:py-3 text-right text-xs sm:text-sm font-medium w-8 sm:w-24">Price</th>
						<th className="px-1 sm:px-2 py-2 sm:py-3 text-right text-xs sm:text-sm font-medium w-8" colSpan={2}>
							Edit
						</th>
					</tr>
				</thead>
				<tbody onDragLeave={onDragLeave} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
					{items.map((item, index) => (
						<ShoppingListRow
							key={`ingredient-${item.name}-${item.id}`}
							item={item}
							index={index}
							dragOverIndex={dragOverIndex}
							isDragging={isDragging}
							onTogglePurchase={onTogglePurchase}
							onRemoveItem={onRemoveItem}
							onDragStart={onDragStart}
							onDragOver={onDragOver}
							onDrop={onDrop}
							onTouchStart={onTouchStart}
						/>
					))}
					{/* Drop zone at the end of the list */}
					<tr onDragOver={e => onDragOver(e, 'fresh', items.length)} onDrop={e => onDrop(e, 'fresh', items.length)} className="h-1">
						<td colSpan={6} className="p-0">
							{dragOverIndex?.list === 'fresh' && dragOverIndex.index === items.length && <div className="h-1 bg-blue-500 rounded"></div>}
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	);
}
