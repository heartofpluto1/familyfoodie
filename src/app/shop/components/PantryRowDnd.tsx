import React from 'react';
import { ListItem } from '@/types/shop';
import { DragHandleIcon } from '@/app/components/Icons';
import Tooltip from '@/app/components/Tooltip';
import { roundToTwo } from '@/app/shop/utils/shoppingListUtils';
import { getPantryCategoryColor } from '@/app/utils/categoryColors';
import { useSortable } from '@dnd-kit/sortable';

interface PantryRowDndProps {
	item: ListItem;
	index: number;
	isDragOverlay?: boolean;
	isOver?: boolean;
}

export function PantryRowDnd({ item, isDragOverlay = false }: PantryRowDndProps) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: item.id.toString(),
		disabled: isDragOverlay,
	});

	const style = {
		transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<tr
			ref={setNodeRef}
			style={{
				...style,
			}}
			className={`${isDragging ? 'opacity-50' : ''} border-b border-light`}
			{...attributes}
		>
			<td className="p-0">
				<div className="flex items-stretch h-full">
					{item.pantryCategory && (
						<div className="flex items-center relative group">
							<div
								className="block w-1 h-full min-h-10"
								style={{ cursor: 'pointer', backgroundColor: getPantryCategoryColor(item.pantryCategory, true) }}
							></div>
							<Tooltip text={item.pantryCategory} backgroundColor={getPantryCategoryColor(item.pantryCategory, false)} />
						</div>
					)}

					<div className="flex items-stretch h-full">
						<div className="flex items-center px-1 sm:px-2 py-1.5 sm:py-2 flex-1 relative group">
							<span className="text-xs sm:text-sm">{item.name}</span>
						</div>
					</div>
				</div>
			</td>
			<td className="px-1 sm:px-2 py-1.5 sm:py-2 text-center text-xs sm:text-sm">
				{roundToTwo(parseFloat(item.quantity || '0'))} {item.quantityMeasure}
				{parseFloat(item.quantity || '0') > 1 ? 's' : ''}
			</td>
			<td className="p-0" style={{ width: '24px' }}>
				<button
					className="relative group h-full my-2 px-2 py-1 flex items-center justify-center border-l border-light"
					style={{
						cursor: isDragging ? 'grabbing' : 'grab',
						touchAction: 'none',
					}}
					{...listeners}
				>
					<DragHandleIcon className="w-4 h-4" />
				</button>
			</td>
		</tr>
	);
}
