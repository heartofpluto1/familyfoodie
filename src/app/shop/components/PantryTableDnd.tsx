import React from 'react';
import { ListItem } from '@/types/shop';
import { PantryRowDnd } from './PantryRowDnd';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface PantryTableDndProps {
	items: ListItem[];
	overId?: string | number | null;
}

export function PantryTableDnd({ items, overId }: PantryTableDndProps) {
	const { setNodeRef } = useDroppable({
		id: 'pantry-droppable',
	});

	const itemIds = items.map(item => item.id.toString());

	return (
		<div className="overflow-visible" data-list-type="pantry">
			<table className="w-full">
				<thead>
					<tr className="border-b border-light">
						<th className="px-3 sm:px-3 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium">Ingredients</th>
						<th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-medium w-30 sm:w-30">Qty</th>
					</tr>
				</thead>
				<tbody ref={setNodeRef}>
					<SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
						{items.map((item, index) => (
							<PantryRowDnd key={item.id} item={item} index={index} isOver={overId === item.id.toString()} />
						))}
					</SortableContext>
				</tbody>
			</table>
		</div>
	);
}
