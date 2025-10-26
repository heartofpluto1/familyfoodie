import React from 'react';
import { ListItem } from '@/types/shop';
import { ShoppingListRowDnd } from './ShoppingListRowDnd';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface ShoppingListTableDndProps {
	items: ListItem[];
	onTogglePurchase: (itemId: number | number[], purchased: boolean) => void;
	onRemoveItem: (itemId: number | number[], itemName: string) => void;
	overId?: string | number | null;
}

export function ShoppingListTableDnd({ items, onTogglePurchase, onRemoveItem, overId }: ShoppingListTableDndProps) {
	const { setNodeRef } = useDroppable({
		id: 'fresh-droppable',
	});

	const itemIds = items.map(item => item.id.toString());

	return (
		<div className="overflow-visible" data-list-type="fresh">
			<table className="w-full">
				<thead>
					<tr className="border-b border-light">
						<th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium">Ingredients</th>
						<th className="px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm font-medium w-30 sm:w-30">Qty</th>
						<th className="px-0 py-2 sm:py-3 text-right text-xs sm:text-sm font-medium w-16 sm:w-16">Price</th>
						<th className="px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm font-medium w-16"></th>
					</tr>
				</thead>
				<tbody ref={setNodeRef}>
					<SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
						{items.map((item, index) => (
							<ShoppingListRowDnd
								key={item.id}
								item={item}
								index={index}
								onTogglePurchase={onTogglePurchase}
								onRemoveItem={onRemoveItem}
								isOver={overId === item.id.toString()}
							/>
						))}
					</SortableContext>
				</tbody>
			</table>
		</div>
	);
}
