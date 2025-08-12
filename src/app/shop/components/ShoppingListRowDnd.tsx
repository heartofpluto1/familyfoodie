import React from 'react';
import { ListItem } from '@/types/shop';
import { DragHandleIcon, LinkIcon, DeleteIcon } from '@/app/components/Icons';
import Tooltip from '@/app/components/Tooltip';
import { roundToTwo, formatPrice } from '@/app/shop/utils/shoppingListUtils';
import { getSupermarketCategoryColor } from '@/lib/utils/categoryColors';
import { useSortable } from '@dnd-kit/sortable';

interface ShoppingListRowDndProps {
	item: ListItem;
	index: number;
	onTogglePurchase: (itemId: number, purchased: boolean) => void;
	onRemoveItem: (itemId: number, itemName: string) => void;
	isDragOverlay?: boolean;
	isOver?: boolean;
}

export function ShoppingListRowDnd({ item, onTogglePurchase, onRemoveItem, isDragOverlay = false }: ShoppingListRowDndProps) {
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
					{item.supermarketCategory && (
						<div className="flex items-center relative group">
							<div
								className="block w-1 h-full min-h-10"
								style={{ cursor: 'pointer', backgroundColor: getSupermarketCategoryColor(item.supermarketCategory, true) }}
							></div>
							<Tooltip text={item.supermarketCategory} backgroundColor={getSupermarketCategoryColor(item.supermarketCategory, false)} />
						</div>
					)}
					<div className="flex items-center px-2 py-1 flex-1">
						<input
							type="checkbox"
							checked={item.purchased || false}
							onChange={() => onTogglePurchase(item.id, item.purchased || false)}
							className="ml-1 mr-2 sm:ml-1 sm:mr-3 h-4 w-4 text-blue-600 rounded cursor-pointer"
							disabled={isDragOverlay}
						/>
						<span className={`text-xs sm:text-sm ${item.purchased ? 'opacity-50 line-through' : ''}`}>{item.name}</span>
					</div>
				</div>
			</td>
			<td className="text-center text-xs sm:text-sm px-1 py-1">
				{roundToTwo(parseFloat(item.quantity || '0'))} {item.quantityMeasure}
				{parseFloat(item.quantity || '0') > 1 ? 's' : ''}
			</td>
			<td className="text-right text-xs sm:text-sm">{item.cost ? formatPrice(item.cost) : ''}</td>
			<td className="text-right p-0">
				<div className="flex items-stretch h-full justify-end">
					<div className="flex items-center gap-2 pr-2">
						{item.stockcode && (
							<a
								href={`https://www.woolworths.com.au/shop/productdetails/${item.stockcode}/`}
								target="_blank"
								rel="noopener noreferrer"
								title="Woolworths details"
								className="flex items-center"
							>
								<LinkIcon className="w-4 h-4" />
							</a>
						)}
						<div className="flex items-center w-4 h-4">
							{(item.quantity === null || typeof item.quantity === 'undefined') && (
								<button title="Remove item" onClick={() => onRemoveItem(item.id, item.name)} className="focus:outline-none" disabled={isDragOverlay}>
									<DeleteIcon className="w-4 h-4" />
								</button>
							)}
						</div>
					</div>
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
				</div>
			</td>
		</tr>
	);
}
