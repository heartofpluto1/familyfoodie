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

				{/* Overlay for background image */}
				{(previewUrl || (!selectedFile && defaultBackgroundImage)) && <div className="absolute inset-0 bg-black/70 rounded-lg" />}

				<div className="relative z-10">
					{selectedFile ? (
						<div className="space-y-2">
							<div className="text-green-400">
								<UploadIcon className="w-8 h-8 mx-auto mb-2" />
							</div>
							<p className="font-medium text-white drop-shadow-md">{selectedFile.name}</p>
							<p className="text-sm text-white/80 drop-shadow-md">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
							{!disabled && <p className="text-xs text-white/70 drop-shadow-md">Click to change file</p>}
						</div>
					) : (
						<div className="space-y-2">
							<div className={disabled ? 'text-gray-400' : 'text-gray-400'}>
								<UploadIcon className="w-8 h-8 mx-auto mb-2" />
							</div>
							<p className={`font-medium ${disabled ? 'text-gray-400' : 'text-foreground'}`}>
								{disabled ? 'Upload disabled' : 'Drop JPG image here or click to browse'}
							</p>
							<p className={`text-sm ${disabled ? 'text-gray-400' : 'text-muted'}`}>JPG files only (Max 10MB)</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default ImageUploadSection;
