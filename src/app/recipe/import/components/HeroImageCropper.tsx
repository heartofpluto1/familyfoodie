'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface HeroImageCropperProps {
	pageImageDataUrl: string; // The base64 image data URL from the AI processing
	initialCrop: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	onCropChange: (croppedImageDataUrl: string, cropCoordinates: { x: number; y: number; width: number; height: number }) => void;
}

const HeroImageCropper = ({ pageImageDataUrl, initialCrop, onCropChange }: HeroImageCropperProps) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const cropCanvasRef = useRef<HTMLCanvasElement>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [dragMode, setDragMode] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | 'create' | null>(null);
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
	const [initialCropRect, setInitialCropRect] = useState(initialCrop);
	const [cropRect, setCropRect] = useState(initialCrop);
	const [scale, setScale] = useState(1);
	const [pageImage, setPageImage] = useState<HTMLImageElement | null>(null);

	// Load the image from data URL
	useEffect(() => {
		if (!pageImageDataUrl) {
			setError('No image data provided');
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		setError(null);

		const img = new Image();
		img.onload = () => {
			// Calculate scale for display (fit to container)
			const containerWidth = 600; // Max display width
			const displayScale = Math.min(containerWidth / img.width, 1);
			setScale(displayScale);

			setPageImage(img);
			setIsLoading(false);
		};

		img.onerror = () => {
			setError('Failed to load image');
			setIsLoading(false);
		};

		img.src = pageImageDataUrl;
	}, [pageImageDataUrl]);

	// Draw image to canvas when both image and canvas are ready
	useEffect(() => {
		if (!pageImage || !canvasRef.current) return;

		const canvas = canvasRef.current;
		const context = canvas.getContext('2d');
		if (!context) {
			setError('Could not get canvas context');
			return;
		}

		// Set canvas size to image size
		canvas.width = pageImage.width;
		canvas.height = pageImage.height;

		// Draw the image to canvas
		context.drawImage(pageImage, 0, 0);
	}, [pageImage]);

	const updateCropPreview = useCallback(() => {
		const cropCanvas = cropCanvasRef.current;
		const mainCanvas = canvasRef.current;
		if (!cropCanvas || !mainCanvas || !pageImage) return;

		const cropContext = cropCanvas.getContext('2d');
		if (!cropContext) return;

		// Set crop canvas size
		cropCanvas.width = cropRect.width;
		cropCanvas.height = cropRect.height;

		// Extract the cropped portion from the main canvas
		cropContext.drawImage(mainCanvas, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 0, 0, cropRect.width, cropRect.height);

		// Convert to data URL and notify parent
		const croppedImageDataUrl = cropCanvas.toDataURL('image/jpeg', 0.8);
		onCropChange(croppedImageDataUrl, cropRect);
	}, [cropRect, pageImage, onCropChange]);

	// Update crop preview whenever crop changes
	useEffect(() => {
		if (!pageImage || !cropCanvasRef.current) return;

		updateCropPreview();
	}, [cropRect, pageImage, updateCropPreview]);

	const handleDragStart = (e: React.MouseEvent, mode: 'move' | 'nw' | 'ne' | 'sw' | 'se') => {
		e.preventDefault();
		e.stopPropagation();

		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const x = (e.clientX - rect.left) / scale;
		const y = (e.clientY - rect.top) / scale;

		setIsDragging(true);
		setDragMode(mode);
		setDragStart({ x, y });
		setInitialCropRect(cropRect);
	};

	const handleCanvasMouseDown = (e: React.MouseEvent) => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const x = (e.clientX - rect.left) / scale;
		const y = (e.clientY - rect.top) / scale;

		// Check if click is inside crop area
		if (x >= cropRect.x && x <= cropRect.x + cropRect.width && y >= cropRect.y && y <= cropRect.y + cropRect.height) {
			// Start moving existing crop
			handleDragStart(e, 'move');
		} else {
			// Start creating new crop
			setIsDragging(true);
			setDragMode('create');
			setDragStart({ x, y });
			setInitialCropRect({ x, y, width: 0, height: 0 });
		}
	};

	const handleMouseMove = useCallback(
		(e: MouseEvent | React.MouseEvent) => {
			if (!isDragging || !canvasRef.current || !dragMode) return;

			const canvas = canvasRef.current;
			const rect = canvas.getBoundingClientRect();
			const currentX = (e.clientX - rect.left) / scale;
			const currentY = (e.clientY - rect.top) / scale;

			const deltaX = currentX - dragStart.x;
			const deltaY = currentY - dragStart.y;

			let newRect = { ...initialCropRect };

			if (dragMode === 'move') {
				// Move the entire crop area
				newRect.x = Math.max(0, Math.min(canvas.width - newRect.width, initialCropRect.x + deltaX));
				newRect.y = Math.max(0, Math.min(canvas.height - newRect.height, initialCropRect.y + deltaY));
			} else if (dragMode === 'create') {
				// Create new crop area
				const newX = Math.min(dragStart.x, currentX);
				const newY = Math.min(dragStart.y, currentY);
				const newWidth = Math.abs(currentX - dragStart.x);
				const newHeight = Math.abs(currentY - dragStart.y);

				newRect = { x: newX, y: newY, width: newWidth, height: newHeight };
			} else {
				// Resize crop area based on corner
				switch (dragMode) {
					case 'nw':
						newRect.x = Math.min(currentX, initialCropRect.x + initialCropRect.width);
						newRect.y = Math.min(currentY, initialCropRect.y + initialCropRect.height);
						newRect.width = initialCropRect.x + initialCropRect.width - newRect.x;
						newRect.height = initialCropRect.y + initialCropRect.height - newRect.y;
						break;
					case 'ne':
						newRect.y = Math.min(currentY, initialCropRect.y + initialCropRect.height);
						newRect.width = Math.max(0, currentX - initialCropRect.x);
						newRect.height = initialCropRect.y + initialCropRect.height - newRect.y;
						break;
					case 'sw':
						newRect.x = Math.min(currentX, initialCropRect.x + initialCropRect.width);
						newRect.width = initialCropRect.x + initialCropRect.width - newRect.x;
						newRect.height = Math.max(0, currentY - initialCropRect.y);
						break;
					case 'se':
						newRect.width = Math.max(0, currentX - initialCropRect.x);
						newRect.height = Math.max(0, currentY - initialCropRect.y);
						break;
				}
			}

			// Constrain to canvas bounds
			newRect.x = Math.max(0, Math.min(newRect.x, canvas.width - newRect.width));
			newRect.y = Math.max(0, Math.min(newRect.y, canvas.height - newRect.height));
			newRect.width = Math.min(newRect.width, canvas.width - newRect.x);
			newRect.height = Math.min(newRect.height, canvas.height - newRect.y);

			// Enforce 3:2.2 aspect ratio
			const aspectRatio = 3 / 2.2;
			if (newRect.width / newRect.height > aspectRatio) {
				newRect.width = newRect.height * aspectRatio;
			} else {
				newRect.height = newRect.width / aspectRatio;
			}

			// Ensure minimum size
			const minSize = 50;
			if (newRect.width < minSize || newRect.height < minSize) {
				newRect.width = Math.max(minSize, minSize * aspectRatio);
				newRect.height = newRect.width / aspectRatio;
			}

			setCropRect(newRect);
		},
		[isDragging, dragMode, scale, dragStart, initialCropRect]
	);

	const handleMouseUp = () => {
		setIsDragging(false);
		setDragMode(null);
	};

	// Add global mouse event listeners when dragging for better responsiveness
	useEffect(() => {
		if (!isDragging) return;

		const handleGlobalMouseMove = (e: MouseEvent) => {
			e.preventDefault();
			handleMouseMove(e);
		};

		const handleGlobalMouseUp = (e: MouseEvent) => {
			e.preventDefault();
			handleMouseUp();
		};

		document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
		document.addEventListener('mouseup', handleGlobalMouseUp, { passive: false });

		return () => {
			document.removeEventListener('mousemove', handleGlobalMouseMove);
			document.removeEventListener('mouseup', handleGlobalMouseUp);
		};
	}, [isDragging, handleMouseMove]);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-48 bg-gray-100 rounded">
				<div className="text-gray-500">Loading PDF page...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center h-48 bg-red-50 border border-red-200 rounded">
				<div className="text-red-600 mb-2">❌ Error loading PDF page</div>
				<div className="text-sm text-red-500">{error}</div>
				<div className="text-xs text-gray-500 mt-2">Check console for details</div>
			</div>
		);
	}

	return (
		<div className="space-y-4 flex flex-col items-center">
			{/* PDF Page with Crop Overlay */}
			<div className="relative inline-block overflow-hidden">
				<canvas
					ref={canvasRef}
					className="block cursor-crosshair"
					style={{
						maxWidth: '600px',
						width: pageImage ? `${pageImage.width * scale}px` : '600px',
						height: pageImage ? `${pageImage.height * scale}px` : `${600 * (3 / 4)}px`, // Use 4:3 ratio as fallback
					}}
					onMouseDown={handleCanvasMouseDown}
				/>

				{/* Dark overlay for non-cropped areas - top */}
				<div
					className="absolute pointer-events-none"
					style={{
						left: 0,
						top: 0,
						width: '100%',
						height: `${cropRect.y * scale}px`,
						backgroundColor: 'rgba(0, 0, 0, 0.5)',
					}}
				/>

				{/* Dark overlay for non-cropped areas - bottom */}
				<div
					className="absolute pointer-events-none"
					style={{
						left: 0,
						top: `${(cropRect.y + cropRect.height) * scale}px`,
						width: '100%',
						height: `calc(100% - ${(cropRect.y + cropRect.height) * scale}px)`,
						backgroundColor: 'rgba(0, 0, 0, 0.5)',
					}}
				/>

				{/* Dark overlay for non-cropped areas - left */}
				<div
					className="absolute pointer-events-none"
					style={{
						left: 0,
						top: `${cropRect.y * scale}px`,
						width: `${cropRect.x * scale}px`,
						height: `${cropRect.height * scale}px`,
						backgroundColor: 'rgba(0, 0, 0, 0.5)',
					}}
				/>

				{/* Dark overlay for non-cropped areas - right */}
				<div
					className="absolute pointer-events-none"
					style={{
						left: `${(cropRect.x + cropRect.width) * scale}px`,
						top: `${cropRect.y * scale}px`,
						width: `calc(100% - ${(cropRect.x + cropRect.width) * scale}px)`,
						height: `${cropRect.height * scale}px`,
						backgroundColor: 'rgba(0, 0, 0, 0.5)',
					}}
				/>

				{/* Crop Overlay */}
				<div
					className="absolute border-2 border-dashed border-white pointer-events-none"
					style={{
						left: `${cropRect.x * scale}px`,
						top: `${cropRect.y * scale}px`,
						width: `${cropRect.width * scale}px`,
						height: `${cropRect.height * scale}px`,
					}}
				>
					{/* Drag handle in center */}
					<div
						className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 border-2 border-white bg-blue-500 bg-opacity-75 rounded-full cursor-move pointer-events-auto"
						onMouseDown={e => handleDragStart(e, 'move')}
					>
						<div className="flex items-center justify-center w-full h-full text-white text-xs">⊕</div>
					</div>

					{/* Resize handles */}
					<div
						className="absolute -top-1 -left-1 w-3 h-3 bg-white border border-blue-500 cursor-nw-resize pointer-events-auto"
						onMouseDown={e => handleDragStart(e, 'nw')}
					/>
					<div
						className="absolute -top-1 -right-1 w-3 h-3 bg-white border border-blue-500 cursor-ne-resize pointer-events-auto"
						onMouseDown={e => handleDragStart(e, 'ne')}
					/>
					<div
						className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border border-blue-500 cursor-sw-resize pointer-events-auto"
						onMouseDown={e => handleDragStart(e, 'sw')}
					/>
					<div
						className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border border-blue-500 cursor-se-resize pointer-events-auto"
						onMouseDown={e => handleDragStart(e, 'se')}
					/>

					{/* Dimensions label */}
					<div className="absolute -top-6 left-0 text-xs text-white bg-black bg-opacity-75 px-2 py-1 rounded pointer-events-none">
						{Math.round(cropRect.width)} × {Math.round(cropRect.height)}
					</div>
				</div>
			</div>

			{/* Hidden canvas for crop extraction */}
			<canvas ref={cropCanvasRef} style={{ display: 'none' }} />
			<div className="text-sm text-gray-600 text-center">📸 Drag to adjust the hero image crop area (maintains 3:2.2 aspect ratio)</div>
		</div>
	);
};

export default HeroImageCropper;
