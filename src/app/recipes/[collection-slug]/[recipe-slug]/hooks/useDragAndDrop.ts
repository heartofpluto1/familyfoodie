import { useState } from 'react';

export const useDragAndDrop = (onFileDrop: (file: File) => boolean) => {
	const [isDragOver, setIsDragOver] = useState(false);

	const handleDragOver = (event: React.DragEvent) => {
		event.preventDefault();
		setIsDragOver(true);
	};

	const handleDragLeave = (event: React.DragEvent) => {
		event.preventDefault();
		setIsDragOver(false);
	};

	const handleDrop = (event: React.DragEvent) => {
		event.preventDefault();
		setIsDragOver(false);

		const files = event.dataTransfer.files;
		if (files.length > 0) {
			const file = files[0];
			onFileDrop(file);
		}
	};

	return {
		isDragOver,
		handleDragOver,
		handleDragLeave,
		handleDrop,
	};
};
