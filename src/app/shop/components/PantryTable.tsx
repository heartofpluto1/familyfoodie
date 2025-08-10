import React from 'react';
import { PantryItem } from '@/types/shop';
import { PantryRow } from './PantryRow';

interface PantryTableProps {
	items: PantryItem[];
	dragOverIndex: { list: 'fresh' | 'pantry'; index: number } | null;
	isDragging: boolean;
	onDragStart: (e: React.DragEvent, item: PantryItem, listType: 'fresh' | 'pantry') => void;
	onDragOver: (e: React.DragEvent, targetList?: 'fresh' | 'pantry', targetIndex?: number) => void;
	onDragLeave: (e: React.DragEvent) => void;
	onDrop: (e: React.DragEvent, targetList: 'fresh' | 'pantry', targetIndex?: number) => void;
}

export function PantryTable({ items, dragOverIndex, isDragging, onDragStart, onDragOver, onDragLeave, onDrop }: PantryTableProps) {
	return (
		<div className="overflow-visible">
			<table className="w-full">
				<thead>
					<tr className="border-b border-light">
						<th className="px-2 py-3 text-left text-sm font-medium">Ingredients</th>
						<th className="px-2 py-3 text-center text-sm font-medium w-30">2p</th>
					</tr>
				</thead>
				<tbody onDragLeave={onDragLeave}>
					{items.map((item, index) => (
						<PantryRow
							key={`pantry-${item.name}-${item.id}`}
							item={item}
							index={index}
							dragOverIndex={dragOverIndex}
							isDragging={isDragging}
							onDragStart={onDragStart}
							onDragOver={onDragOver}
							onDrop={onDrop}
						/>
					))}
					{/* Drop zone at the end of the list */}
					<tr onDragOver={e => onDragOver(e, 'pantry', items.length)} onDrop={e => onDrop(e, 'pantry', items.length)} className="1">
						<td colSpan={3} className="p-0">
							{dragOverIndex?.list === 'pantry' && dragOverIndex.index === items.length && <div className="h-1 bg-blue-500 rounded"></div>}
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	);
}
