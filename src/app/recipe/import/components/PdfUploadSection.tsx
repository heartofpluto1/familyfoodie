'use client';

import { useRef, useState, useEffect } from 'react';
import { UploadIcon } from '@/app/components/Icons';

interface PdfUploadSectionProps {
	selectedFile: File | null;
	isProcessing: boolean;
	processingStep: string;
	pdfImages?: string[]; // Add PDF images for display during processing
	onFileSelect: (file: File) => void;
	onExtractAndPreview: () => void;
	onFileValidationError: (title: string, message: string) => void;
}

// Cooking verbs for animated loading text with emojis
const cookingVerbs = [
	{ verb: 'brewing', emoji: '☕' },
	{ verb: 'broiling', emoji: '🫧' },
	{ verb: 'simmering', emoji: '🔥' },
	{ verb: 'chopping', emoji: '🔪' },
	{ verb: 'baking', emoji: '🍞' },
	{ verb: 'stewing', emoji: '🍲' },
	{ verb: 'seasoning', emoji: '🧂' },
	{ verb: 'stirring', emoji: '🥄' },
	{ verb: 'whisking', emoji: '🥢' },
	{ verb: 'grilling', emoji: '🔥' },
	{ verb: 'roasting', emoji: '🍗' },
	{ verb: 'marinating', emoji: '🥩' },
];

const PdfUploadSection = ({
	selectedFile,
	isProcessing,
	processingStep,
	pdfImages,
	onFileSelect,
	onExtractAndPreview,
	onFileValidationError,
}: PdfUploadSectionProps) => {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isDragOver, setIsDragOver] = useState(false);
	const [currentCookingVerb, setCurrentCookingVerb] = useState(cookingVerbs[0]);

	// Animate cooking verbs when processing
	useEffect(() => {
		if (!isProcessing) return;

		const interval = setInterval(() => {
			setCurrentCookingVerb(prev => {
				const currentIndex = cookingVerbs.findIndex(v => v.verb === prev.verb);
				const nextIndex = (currentIndex + 1) % cookingVerbs.length;
				return cookingVerbs[nextIndex];
			});
		}, 8000);

		return () => clearInterval(interval);
	}, [isProcessing]);

	const validateAndSelectFile = (file: File) => {
		if (file.type !== 'application/pdf') {
			onFileValidationError('Invalid File', 'Please select a PDF file');
			return;
		}
		if (file.size > 10 * 1024 * 1024) {
			onFileValidationError('File Too Large', 'PDF must be smaller than 10MB');
			return;
		}
		onFileSelect(file);
	};

	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			validateAndSelectFile(file);
		}
	};

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
			validateAndSelectFile(files[0]);
		}
	};

	const handleClick = () => {
		fileInputRef.current?.click();
	};

	return (
		<div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-sm shadow-md p-6 mb-8">
			<div className="space-y-4">
				{!isProcessing && (
					<div>
						{/* Hidden file input */}
						<input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={handleFileSelect} className="hidden" />

						{/* Custom drag and drop area */}
						<div
							onClick={handleClick}
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
							className={`
								relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer
								${isDragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'}
							`}
						>
							<div className="text-center">
								<UploadIcon className={`mx-auto h-12 w-12 ${isDragOver ? 'text-blue-400' : 'text-gray-400'}`} />
								<div className="mt-4">
									<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
										{isDragOver ? 'Drop your PDF here' : 'Drop your PDF here or click to browse'}
									</p>
									<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Supports PDF files up to 10MB</p>
								</div>
								{!isDragOver && (
									<button className="mt-3 inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
										Choose File
									</button>
								)}
							</div>
						</div>
					</div>
				)}

				{selectedFile && (
					<>
						<div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-sm space-y-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedFile.name}</p>
									<p className="text-xs text-gray-500 dark:text-gray-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
								</div>
								<button
									onClick={onExtractAndPreview}
									disabled={isProcessing}
									className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								>
									Extract & Preview
								</button>
							</div>
						</div>

						{/* Large cooking verbs display during AI processing */}
						{isProcessing && (
							<div className="p-4 space-y-4 text-center py-6">
								<div className="text-4xl mb-2">{currentCookingVerb.emoji}</div>
								<h3 className="text-2xl text-gray-800 dark:text-gray-200 capitalize tracking-wide font-heading">
									{currentCookingVerb.verb}
									<span className="inline-block">
										<span className="inline-block align-bottom animate-bounce" style={{ animationDelay: '0ms', transform: 'scaleY(-1)' }}>
											.
										</span>
										<span className="inline-block align-bottom animate-bounce" style={{ animationDelay: '200ms', transform: 'scaleY(-1)' }}>
											.
										</span>
										<span className="inline-block align-bottom animate-bounce" style={{ animationDelay: '400ms', transform: 'scaleY(-1)' }}>
											.
										</span>
									</span>
								</h3>
								<div className="text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium">{processingStep || 'AI is working its magic'}</div>
							</div>
						)}

						{/* Show PDF images during AI processing */}
						{isProcessing && pdfImages && pdfImages.length > 0 && (
							<div className="space-y-3">
								<div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(pdfImages.length, 2)}, 1fr)` }}>
									{pdfImages.slice(0, 4).map((imageDataUrl, index) => (
										<div key={index} className="relative">
											<img
												src={imageDataUrl}
												alt={`PDF Page ${index + 1}`}
												className="w-full h-auto max-w-xs mx-auto border border-gray-200 dark:border-gray-600 rounded shadow-sm"
												style={{ maxHeight: '200px', objectFit: 'contain' }}
											/>
											<div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium">
												{index + 1}
											</div>
											{/* Pulse overlay to show AI is analyzing */}
											<div className="absolute inset-0 bg-blue-500/10 animate-pulse rounded" />
										</div>
									))}
								</div>
								{pdfImages.length > 4 && (
									<p className="text-xs text-gray-500 dark:text-gray-400 text-center">...and {pdfImages.length - 4} more pages</p>
								)}
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
};

export default PdfUploadSection;
