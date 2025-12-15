'use client';

import { DndContext, closestCenter, DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core';
import { SensorDescriptor } from '@dnd-kit/core/dist/sensors';
import { ReactNode } from 'react';

interface ShoppingListWithDndProps {
	children: ReactNode;
	sensors: SensorDescriptor<any>[];
	onDragStart: (event: DragStartEvent) => void;
	onDragOver: (event: DragOverEvent) => void;
	onDragEnd: (event: DragEndEvent) => void;
}

export default function ShoppingListWithDnd({ children, sensors, onDragStart, onDragOver, onDragEnd }: ShoppingListWithDndProps) {
	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragStart={onDragStart}
			onDragOver={onDragOver}
			onDragEnd={onDragEnd}
			autoScroll={{ enabled: false }}
		>
			{children}
		</DndContext>
	);
}
