import React from 'react';
import { PantryItem } from '@/types/shop';
import { DragHandleIcon } from './Icons';
import Tooltip from '../../components/Tooltip';
import { getPantryCategoryColor } from '../utils/categoryColors';
import { roundToTwo, capitalizeFirstLetter } from '../utils/shoppingListUtils';

interface PantryRowProps {
	item: PantryItem;
	index: number;
	dragOverIndex: { list: 'fresh' | 'pantry'; index: number } | null;
	isDragging: boolean;
	onDragStart: (e: React.DragEvent, item: PantryItem, listType: 'fresh' | 'pantry') => void;
	onDragOver: (e: React.DragEvent, targetList?: 'fresh' | 'pantry', targetIndex?: number) => void;
	onDrop: (e: React.DragEvent, targetList: 'fresh' | 'pantry', targetIndex?: number) => void;
}

export function PantryRow({ item, index, dragOverIndex, isDragging, onDragStart, onDragOver, onDrop }: PantryRowProps) {
	return (
		<React.Fragment key={`fragment-pantry-${item.name}-${item.id}`}>
			{/* Drop indicator above the row */}
			{dragOverIndex?.list === 'pantry' && dragOverIndex.index === index && (
				<tr>
					<td colSpan={3} className="p-0">
						<div className="h-1 bg-blue-500 rounded"></div>
					</td>
				</tr>
			)}
			<tr
				draggable
				onDragStart={e => onDragStart(e, item, 'pantry')}
				onDragOver={e => onDragOver(e, 'pantry', index)}
				onDrop={e => onDrop(e, 'pantry', index)}
				className="hover:bg-gray-50"
			>
				<td className="p-0">
					<div className="flex items-stretch h-full">
						<button
							className="relative group h-full flex items-center justify-center"
							style={{
								backgroundColor: getPantryCategoryColor(item.pantryCategory || '', true),
								width: '15px',
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
								text={item.pantryCategory ? capitalizeFirstLetter(item.pantryCategory) : ''}
								backgroundColor={getPantryCategoryColor(item.pantryCategory || '', false)}
								forceHide={isDragging}
							/>
						</button>
						<div className="flex items-center px-2 py-2 flex-1">
							<span className="text-sm">{item.name}</span>
						</div>
					</div>
				</td>
				<td className="px-2 py-2 text-center text-sm">
					{roundToTwo(parseFloat(item.quantity || '0'))} {item.quantityMeasure}
					{parseFloat(item.quantity || '0') > 1 ? 's' : ''}
				</td>
			</tr>
		</React.Fragment>
	);
}
