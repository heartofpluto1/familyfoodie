'use client';

import { useRef, useState } from 'react';
import { UploadIcon } from '@/app/components/Icons';

interface ImageUploadSectionProps {
	label: string;
	selectedFile: File | null;
	onFileSelect: (file: File) => void;
	onFileValidationError: (title: string, message: string) => void;
	accept?: string;
	disabled?: boolean;
	previewUrl?: string | null;
	defaultBackgroundImage?: string;
	showOverlay?: boolean;
	overlayImage?: string;
	mode?: 'light' | 'dark';
}

const ImageUploadSection = ({
	label,
	selectedFile,
	onFileSelect,
	onFileValidationError,
	accept = 'image/*',
	disabled = false,
	previewUrl = null,
	defaultBackgroundImage,
	showOverlay = false,
	overlayImage,
	mode = 'dark',
}: ImageUploadSectionProps) => {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isDragOver, setIsDragOver] = useState(false);

	const validateFile = (file: File): boolean => {
		// Check file type - only accept JPG/JPEG
		if (!file.type.includes('jpeg') && !file.name.toLowerCase().endsWith('.jpg')) {
			onFileValidationError('Invalid File Type', 'Please select a JPG file only.');
			return false;
		}

		// Check file size (10MB limit)
		const maxSizeInMB = 10;
		const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
		if (file.size > maxSizeInBytes) {
			onFileValidationError('File Too Large', `Please select a file smaller than ${maxSizeInMB}MB.`);
			return false;
		}

		return true;
	};

	const handleFileSelect = (file: File) => {
		if (validateFile(file)) {
			onFileSelect(file);
		}
	};

	const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			handleFileSelect(file);
		}
	};

	const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		setIsDragOver(false);

		const file = event.dataTransfer.files[0];
		if (file) {
			handleFileSelect(file);
		}
	};

	const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		setIsDragOver(true);
	};

	const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		setIsDragOver(false);
	};

	const handleClick = () => {
		if (!disabled) {
			fileInputRef.current?.click();
		}
	};

	return (
		<div>
			<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>

			<div
				className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors overflow-hidden flex items-center justify-center ${
					isDragOver
						? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
						: disabled
							? 'border-gray-300 bg-gray-50 dark:bg-gray-800 cursor-not-allowed'
							: selectedFile
								? 'border-green-400'
								: 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
				}`}
				style={{
					width: '300px',
					height: '410px',
					backgroundImage: previewUrl ? `url(${previewUrl})` : !selectedFile && defaultBackgroundImage ? `url(${defaultBackgroundImage})` : undefined,
					backgroundSize: 'cover',
					backgroundPosition: 'center',
					backgroundRepeat: 'no-repeat',
				}}
				onDrop={handleDrop}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onClick={handleClick}
			>
				<input ref={fileInputRef} type="file" className="hidden" accept={accept} onChange={handleFileInputChange} disabled={disabled} />

				{/* Texture overlay - shows when there's a background image and showOverlay is true */}
				{showOverlay && overlayImage && (previewUrl || (!selectedFile && defaultBackgroundImage)) && (
					<img src={overlayImage} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none rounded-lg" />
				)}

				{/* Content container - positioned at bottom with background when image present */}
				<div
					className={`${
						previewUrl || (!selectedFile && defaultBackgroundImage)
							? mode === 'light'
								? 'absolute bottom-4 left-4 right-4 bg-white/85 rounded-md p-6'
								: 'absolute bottom-4 left-4 right-4 bg-black/70 rounded-md p-6'
							: 'relative z-10'
					}`}
				>
					{selectedFile ? (
						<div className="space-y-2">
							<div className="text-green-400">
								<UploadIcon className="w-8 h-8 mx-auto mb-2" />
							</div>
							<p className={`font-medium truncate ${mode === 'light' ? 'text-gray-800' : 'text-white drop-shadow-md'}`}>{selectedFile.name}</p>
							<p className={`text-sm ${mode === 'light' ? 'text-gray-700' : 'text-white/80 drop-shadow-md'}`}>
								{(selectedFile.size / 1024 / 1024).toFixed(2)} MB
							</p>
							{!disabled && <p className={`text-xs ${mode === 'light' ? 'text-gray-600' : 'text-white/70 drop-shadow-md'}`}>Click to change file</p>}
						</div>
					) : (
						<div className="space-y-2">
							<div
								className={
									disabled
										? 'text-gray-400'
										: previewUrl || defaultBackgroundImage
											? mode === 'light'
												? 'text-gray-800'
												: 'text-white drop-shadow-md'
											: 'text-gray-400'
								}
							>
								<UploadIcon className="w-8 h-8 mx-auto mb-2" />
							</div>
							<p
								className={`font-medium ${disabled ? 'text-gray-400' : previewUrl || defaultBackgroundImage ? (mode === 'light' ? 'text-gray-800' : 'text-white drop-shadow-md') : 'text-gray-600'}`}
							>
								{disabled ? 'Upload disabled' : 'Drop JPG image here or click to browse'}
							</p>
							<p
								className={`text-sm ${disabled ? 'text-gray-400' : previewUrl || defaultBackgroundImage ? (mode === 'light' ? 'text-gray-700' : 'text-white/80 drop-shadow-md') : 'text-gray-500'}`}
							>
								JPG files only (Max 10MB)
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default ImageUploadSection;
